"""Company-centric admin views: organizations, their members, usage, and billing.

An "organization" is a customer company. Its members are rows in organization_members
(the access/grouping layer); a member's billing anchor stays on profiles.organization_id.
Staff (employees) also technically have a personal org from the backfill, so we EXCLUDE
staff ids from company listings.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from tracemark_admin_api import main_api
from tracemark_admin_api.clients import admin_sb, customer_sb
from tracemark_admin_api.dependencies import StaffPrincipal, require_permission
from tracemark_admin_api.services.audit import write_audit_log

router = APIRouter(prefix="/organizations", tags=["organizations"])


# ── helpers ───────────────────────────────────────────────────────────────────
def _staff_ids() -> set[str]:
    rows = admin_sb().table("staff_accounts").select("id").execute().data or []
    return {r["id"] for r in rows}


def _email_map() -> dict[str, str]:
    users = customer_sb().auth.admin.list_users()
    return {u.id: (u.email or "") for u in users}


def _count(table: str, column: str, value: str) -> int:
    res = customer_sb().table(table).select("id", count="exact").eq(column, value).execute()
    return res.count or 0


# ── models ────────────────────────────────────────────────────────────────────
class OrgRow(BaseModel):
    id: str
    name: str | None
    industry: str | None
    persona: str | None
    plan: str
    member_count: int
    brand_count: int
    mrr: int


class Member(BaseModel):
    user_id: str
    email: str
    full_name: str | None
    org_role: str
    plan: str


class OrgDetail(OrgRow):
    members: list[Member]
    brands: list[dict]
    subscription: dict | None
    invoices: list[dict]


class UpdateOrgRequest(BaseModel):
    name: str | None = None
    industry: str | None = None


class AddMemberRequest(BaseModel):
    user_id: str
    role: str = "member"


class UpdateMemberRequest(BaseModel):
    role: str


# ── list ──────────────────────────────────────────────────────────────────────
@router.get("", response_model=list[OrgRow])
def list_organizations(staff: StaffPrincipal = Depends(require_permission("customers.view"))):
    sb = customer_sb()
    staff_ids = _staff_ids()

    orgs = sb.table("organizations").select("id, name, industry").limit(1000).execute().data or []
    members = sb.table("organization_members").select("organization_id, user_id").limit(5000).execute().data or []
    profiles = sb.table("profiles").select("id, organization_id, plan").limit(1000).execute().data or []
    org_settings = sb.table("org_settings").select("organization_id, persona").limit(1000).execute().data or []
    brands = sb.table("brands").select("organization_id").limit(5000).execute().data or []
    clients = sb.table("clients").select("organization_id, mrr").limit(5000).execute().data or []
    subs = sb.table("subscriptions").select("organization_id, plan, status").limit(1000).execute().data or []

    members_by_org: dict[str, int] = {}
    for m in members:
        members_by_org[m["organization_id"]] = members_by_org.get(m["organization_id"], 0) + 1
    brands_by_org: dict[str, int] = {}
    for b in brands:
        oid = b.get("organization_id")
        if oid:
            brands_by_org[oid] = brands_by_org.get(oid, 0) + 1
    persona_by_org = {r["organization_id"]: r.get("persona") for r in org_settings}
    plan_by_org = {p["organization_id"]: p.get("plan", "free") for p in profiles if p.get("organization_id")}
    # Active subscription plan wins over the mirrored profiles.plan.
    for s in subs:
        if s.get("status") in ("active", "trialing", "past_due") and s.get("plan"):
            plan_by_org[s["organization_id"]] = s["plan"]
    mrr_by_org: dict[str, int] = {}
    for c in clients:
        oid = c.get("organization_id")
        if oid:
            mrr_by_org[oid] = mrr_by_org.get(oid, 0) + int(c.get("mrr") or 0)

    out: list[OrgRow] = []
    for o in orgs:
        if o["id"] in staff_ids:
            continue  # skip staff personal orgs
        out.append(
            OrgRow(
                id=o["id"],
                name=o.get("name"),
                industry=o.get("industry"),
                persona=persona_by_org.get(o["id"]),
                plan=plan_by_org.get(o["id"], "free"),
                member_count=members_by_org.get(o["id"], 0),
                brand_count=brands_by_org.get(o["id"], 0),
                mrr=mrr_by_org.get(o["id"], 0),
            )
        )
    out.sort(key=lambda r: (r.name or "").lower())
    return out


# ── detail ──────────────────────────────────────────────────────────────────
def _org_or_404(org_id: str) -> dict:
    res = customer_sb().table("organizations").select("*").eq("id", org_id).maybe_single().execute()
    if not res or not res.data:
        raise HTTPException(status_code=404, detail="Organization not found")
    return res.data


@router.get("/{org_id}", response_model=OrgDetail)
def get_organization(org_id: str, staff: StaffPrincipal = Depends(require_permission("customers.view"))):
    sb = customer_sb()
    org = _org_or_404(org_id)
    emails = _email_map()

    membership = (
        sb.table("organization_members").select("user_id, role").eq("organization_id", org_id).execute().data
        or []
    )
    prof_rows = sb.table("profiles").select("id, full_name, plan").execute().data or []
    prof_by_id = {p["id"]: p for p in prof_rows}
    members = [
        Member(
            user_id=m["user_id"],
            email=emails.get(m["user_id"], "unknown@example.com"),
            full_name=(prof_by_id.get(m["user_id"]) or {}).get("full_name"),
            org_role=m.get("role", "member"),
            plan=(prof_by_id.get(m["user_id"]) or {}).get("plan", "free"),
        )
        for m in membership
    ]

    persona = (
        sb.table("org_settings").select("persona").eq("organization_id", org_id).maybe_single().execute()
    )
    sub_res = (
        sb.table("subscriptions").select("*").eq("organization_id", org_id)
        .order("created_at", desc=True).limit(1).execute()
    )
    subscription = sub_res.data[0] if sub_res.data else None
    invoices = (
        sb.table("invoices").select("*").eq("organization_id", org_id)
        .order("created_at", desc=True).execute().data or []
    )
    plan = subscription["plan"] if (subscription and subscription.get("status") in ("active", "trialing", "past_due")) else None
    if not plan:
        anyprof = next((p for p in prof_rows if p["id"] in {m["user_id"] for m in membership}), None)
        plan = (anyprof or {}).get("plan", "free")
    clients = sb.table("clients").select("mrr").eq("organization_id", org_id).execute().data or []
    mrr = sum(int(c.get("mrr") or 0) for c in clients)
    brands = (
        sb.table("brands").select("*").eq("organization_id", org_id)
        .order("created_at", desc=True).execute().data or []
    )

    can_view_billing = staff.has("billing.view")
    return OrgDetail(
        id=org["id"],
        name=org.get("name"),
        industry=org.get("industry"),
        persona=(persona.data or {}).get("persona") if persona else None,
        plan=plan,
        member_count=len(members),
        brand_count=len(brands),
        mrr=mrr,
        members=members,
        brands=brands,
        subscription=subscription if can_view_billing else None,
        invoices=invoices if can_view_billing else [],
    )


# ── usage (everything vs limits) ──────────────────────────────────────────────
@router.get("/{org_id}/usage")
def organization_usage(org_id: str, staff: StaffPrincipal = Depends(require_permission("customers.view"))):
    sb = customer_sb()
    _org_or_404(org_id)

    ent = main_api.get_entitlements(org_id)  # {plan, entitlements:{...}, addons:[...]}
    limits = ent.get("entitlements", {})

    brands = sb.table("brands").select("id, target_regions").eq("organization_id", org_id).execute().data or []
    case_count = _count("cases", "organization_id", org_id)
    case_ids = [c["id"] for c in (sb.table("cases").select("id").eq("organization_id", org_id).execute().data or [])]
    infr_count = 0
    if case_ids:
        infr_count = (
            sb.table("infringements").select("id", count="exact").in_("case_id", case_ids).execute().count or 0
        )
    regions_used = sorted({r for b in brands for r in (b.get("target_regions") or [])})

    return {
        "plan": ent.get("plan"),
        "limits": limits,
        "addons": ent.get("addons", []),
        "usage": {
            "brands": len(brands),
            "brands_limit": limits.get("brands"),
            "cases": case_count,
            "infringements": infr_count,
            "regions_used": len(regions_used),
            "regions": regions_used,
            "regions_limit": limits.get("regions"),
            "platforms_limit": limits.get("platforms"),
            "domain_tracking": limits.get("domain_tracking"),
            "managed_takedown": limits.get("managed_takedown"),
            "api_access": limits.get("api_access"),
            "advanced_reports": limits.get("advanced_reports"),
            "real_time_scans": limits.get("real_time_scans"),
        },
    }


# ── edit + members ────────────────────────────────────────────────────────────
@router.patch("/{org_id}", response_model=OrgDetail)
def update_organization(
    org_id: str,
    request: Request,
    payload: UpdateOrgRequest,
    staff: StaffPrincipal = Depends(require_permission("customers.edit")),
):
    before = _org_or_404(org_id)
    updates = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    customer_sb().table("organizations").update(updates).eq("id", org_id).execute()
    write_audit_log(
        staff, "organizations.edit", target_type="organization", target_id=org_id,
        target_org_id=org_id, metadata={"before": before, "changes": updates},
        ip=request.client.host if request.client else None,
    )
    return get_organization(org_id, staff)


_VALID_ROLES = {"owner", "admin", "member"}


@router.post("/{org_id}/members")
def add_member(
    org_id: str,
    request: Request,
    payload: AddMemberRequest,
    staff: StaffPrincipal = Depends(require_permission("customers.edit")),
):
    """Add an existing user to the company (grouping/access only — does NOT move their
    billing anchor). Use invitations (customer app, later) for self-serve onboarding."""
    _org_or_404(org_id)
    if payload.role not in _VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role: {payload.role}")
    customer_sb().table("organization_members").upsert(
        {"organization_id": org_id, "user_id": payload.user_id, "role": payload.role},
        on_conflict="organization_id,user_id",
    ).execute()
    write_audit_log(
        staff, "organizations.add_member", target_type="organization", target_id=org_id,
        target_org_id=org_id, metadata={"user_id": payload.user_id, "role": payload.role},
        ip=request.client.host if request.client else None,
    )
    return {"success": True}


@router.patch("/{org_id}/members/{user_id}")
def update_member(
    org_id: str,
    user_id: str,
    request: Request,
    payload: UpdateMemberRequest,
    staff: StaffPrincipal = Depends(require_permission("customers.edit")),
):
    if payload.role not in _VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role: {payload.role}")
    res = (
        customer_sb().table("organization_members").update({"role": payload.role})
        .eq("organization_id", org_id).eq("user_id", user_id).execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Member not found")
    write_audit_log(
        staff, "organizations.update_member", target_type="organization", target_id=org_id,
        target_org_id=org_id, metadata={"user_id": user_id, "role": payload.role},
        ip=request.client.host if request.client else None,
    )
    return {"success": True}


@router.delete("/{org_id}/members/{user_id}")
def remove_member(
    org_id: str,
    user_id: str,
    request: Request,
    staff: StaffPrincipal = Depends(require_permission("customers.edit")),
):
    customer_sb().table("organization_members").delete().eq("organization_id", org_id).eq(
        "user_id", user_id
    ).execute()
    write_audit_log(
        staff, "organizations.remove_member", target_type="organization", target_id=org_id,
        target_org_id=org_id, metadata={"user_id": user_id},
        ip=request.client.host if request.client else None,
    )
    return {"success": True}
