"""Company-centric admin views: organizations, their members, and usage.

An "organization" is a customer company. Its members are rows in organization_members
(the access/grouping layer); a member's billing anchor stays on profiles.organization_id.
Staff (employees) also technically have a personal org from the backfill, so we EXCLUDE
staff ids from company listings.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

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
    member_count: int
    brand_count: int


class Member(BaseModel):
    user_id: str
    email: str
    full_name: str | None
    org_role: str


class OrgDetail(OrgRow):
    members: list[Member]
    brands: list[dict]


class UpdateOrgRequest(BaseModel):
    name: str | None = None
    industry: str | None = None


class CreateOrgRequest(BaseModel):
    """Create a new customer company together with its first (owner) login."""
    name: str
    industry: str | None = None
    persona: str = "brand_owner"  # "brand_owner" | "law_firm"
    owner_email: str
    owner_password: str
    owner_full_name: str | None = None


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
    org_settings = sb.table("org_settings").select("organization_id, persona").limit(1000).execute().data or []
    brands = sb.table("brands").select("organization_id").limit(5000).execute().data or []

    members_by_org: dict[str, int] = {}
    for m in members:
        members_by_org[m["organization_id"]] = members_by_org.get(m["organization_id"], 0) + 1
    brands_by_org: dict[str, int] = {}
    for b in brands:
        oid = b.get("organization_id")
        if oid:
            brands_by_org[oid] = brands_by_org.get(oid, 0) + 1
    persona_by_org = {r["organization_id"]: r.get("persona") for r in org_settings}

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
                member_count=members_by_org.get(o["id"], 0),
                brand_count=brands_by_org.get(o["id"], 0),
            )
        )
    out.sort(key=lambda r: (r.name or "").lower())
    return out


# ── create ────────────────────────────────────────────────────────────────────
@router.post("", response_model=OrgDetail, status_code=201)
def create_organization(
    request: Request,
    payload: CreateOrgRequest,
    staff: StaffPrincipal = Depends(require_permission("customers.create")),
):
    """Create a new customer company AND its owner login in one step.

    Creating the owner auth user fires the DB trigger (handle_new_user) that
    auto-creates the organization (id = owner's user id), the profile, and an
    'owner' membership row. We then brand those trigger-created rows with the
    company name / industry / persona so the company is immediately usable.
    """
    if payload.persona not in ("brand_owner", "law_firm"):
        raise HTTPException(status_code=400, detail="persona must be brand_owner or law_firm")
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Company name is required")
    if len(payload.owner_password) < 8:
        raise HTTPException(status_code=400, detail="Owner password must be at least 8 characters")

    sb = customer_sb()

    # 1. Create the owner auth user (email confirmed, no confirmation email).
    #    The DB trigger creates organizations/profiles/organization_members for us.
    try:
        created = sb.auth.admin.create_user(
            {"email": payload.owner_email, "password": payload.owner_password, "email_confirm": True}
        )
        owner_id = created.user.id
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Could not create owner login: {exc}")

    # The trigger anchors the personal org id to the owner's user id.
    org_id = owner_id

    # 2. Brand the trigger-created organization.
    sb.table("organizations").update(
        {
            "name": payload.name.strip(),
            "industry": payload.industry,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    ).eq("id", org_id).execute()

    # 3. Owner display name (profile already exists via the trigger).
    if payload.owner_full_name:
        sb.table("profiles").update({"full_name": payload.owner_full_name}).eq("id", owner_id).execute()

    # 4. Org settings — notification_email is NOT NULL; persona defaults to brand_owner.
    sb.table("org_settings").upsert(
        {
            "organization_id": org_id,
            "notification_email": payload.owner_email,
            "persona": payload.persona,
        },
        on_conflict="organization_id",
    ).execute()

    write_audit_log(
        staff, "organizations.create", target_type="organization", target_id=org_id,
        target_org_id=org_id,
        metadata={
            "name": payload.name, "industry": payload.industry, "persona": payload.persona,
            "owner_email": payload.owner_email, "owner_id": owner_id,
        },
        ip=request.client.host if request.client else None,
    )
    return get_organization(org_id, staff)


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
    prof_rows = sb.table("profiles").select("id, full_name").execute().data or []
    prof_by_id = {p["id"]: p for p in prof_rows}
    members = [
        Member(
            user_id=m["user_id"],
            email=emails.get(m["user_id"], "unknown@example.com"),
            full_name=(prof_by_id.get(m["user_id"]) or {}).get("full_name"),
            org_role=m.get("role", "member"),
        )
        for m in membership
    ]

    persona = (
        sb.table("org_settings").select("persona").eq("organization_id", org_id).maybe_single().execute()
    )
    brands = (
        sb.table("brands").select("*").eq("organization_id", org_id)
        .order("created_at", desc=True).execute().data or []
    )

    return OrgDetail(
        id=org["id"],
        name=org.get("name"),
        industry=org.get("industry"),
        persona=(persona.data or {}).get("persona") if persona else None,
        member_count=len(members),
        brand_count=len(brands),
        members=members,
        brands=brands,
    )


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
