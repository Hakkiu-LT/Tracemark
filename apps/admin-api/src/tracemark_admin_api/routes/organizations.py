"""Company-centric admin views: organizations, their members, and usage.

An "organization" is a customer company. Its members are rows in organization_members
(the access/grouping layer); a member's billing anchor stays on profiles.organization_id.
Staff (employees) also technically have a personal org from the backfill, so we EXCLUDE
staff ids from company listings.
"""
from __future__ import annotations

from datetime import datetime, timezone
import uuid

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


HAKKIU_ORG_ID = "00000000-0000-0000-0000-000000000000"
_VALID_ROLES = {"owner", "member"}


class Member(BaseModel):
    user_id: str
    email: str
    full_name: str | None
    org_role: str
    home_organization_id: str | None = None
    is_staff: bool = False  # a staff/super-admin login attached to this company


class OrgDetail(OrgRow):
    members: list[Member]
    brands: list[dict]


class UpdateOrgRequest(BaseModel):
    name: str | None = None
    industry: str | None = None


class CreateOrgRequest(BaseModel):
    """Create a new customer company organization. Owner login is optional."""
    name: str
    industry: str | None = None
    persona: str = "brand_owner"  # "brand_owner" | "law_firm"
    owner_email: str | None = None
    owner_password: str = ""
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
        if o["id"] in staff_ids or o["id"] == HAKKIU_ORG_ID:
            continue  # skip staff personal orgs & internal Hakkiu org

        m_count = members_by_org.get(o["id"], 0)
        b_count = brands_by_org.get(o["id"], 0)
        ind = o.get("industry")
        name = (o.get("name") or "").strip()

        # Skip default solo personal orgs (auto-generated at signup like gmail.com / example.com
        # with 0 brands, no industry, and 1 or 0 members)
        is_domain_name = ("." in name and " " not in name and len(name.split(".")) == 2)
        if m_count <= 1 and b_count == 0 and not ind and (is_domain_name or not name):
            continue

        out.append(
            OrgRow(
                id=o["id"],
                name=o.get("name"),
                industry=o.get("industry"),
                persona=persona_by_org.get(o["id"]),
                member_count=m_count,
                brand_count=b_count,
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
    """Create a new customer company. Owner login is optional."""
    if payload.persona not in ("brand_owner", "law_firm"):
        raise HTTPException(status_code=400, detail="persona must be brand_owner or law_firm")
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Company name is required")

    sb = customer_sb()
    owner_email = (payload.owner_email or "").strip()

    if owner_email:
        if payload.owner_password and len(payload.owner_password) < 8:
            raise HTTPException(status_code=400, detail="Owner password must be at least 8 characters")

        owner_id = None
        try:
            created = sb.auth.admin.create_user(
                {"email": owner_email, "password": payload.owner_password, "email_confirm": True}
            )
            owner_id = created.user.id
        except Exception as exc:  # noqa: BLE001
            users = sb.auth.admin.list_users()
            match = next((u for u in users if u.email and u.email.lower() == owner_email.lower()), None)
            if match:
                owner_id = match.id
            else:
                raise HTTPException(status_code=400, detail=f"Could not create owner login: {exc}")

        prof_res = sb.table("profiles").select("organization_id, home_organization_id").eq("id", owner_id).maybe_single().execute()
        prof_data = prof_res.data if prof_res else None
        org_id = (prof_data or {}).get("home_organization_id") or (prof_data or {}).get("organization_id") or owner_id

        sb.table("organizations").upsert(
            {
                "id": org_id,
                "name": payload.name.strip(),
                "industry": payload.industry,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            on_conflict="id",
        ).execute()

        if payload.owner_full_name:
            sb.table("profiles").update({"full_name": payload.owner_full_name}).eq("id", owner_id).execute()

        sb.table("organization_members").upsert(
            {
                "organization_id": org_id,
                "user_id": owner_id,
                "role": "owner",
            },
            on_conflict="organization_id, user_id",
        ).execute()

        sb.table("org_settings").upsert(
            {
                "organization_id": org_id,
                "notification_email": owner_email,
                "persona": payload.persona,
            },
            on_conflict="organization_id",
        ).execute()
    else:
        # Create standalone company without requiring an immediate owner user
        org_id = str(uuid.uuid4())
        sb.table("organizations").insert(
            {
                "id": org_id,
                "name": payload.name.strip(),
                "industry": payload.industry,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        ).execute()

        sb.table("org_settings").insert(
            {
                "organization_id": org_id,
                "notification_email": f"org-{org_id[:8]}@internal.hakkiu.com",
                "persona": payload.persona,
            }
        ).execute()

    write_audit_log(
        staff,
        "organizations.create",
        target_type="organization",
        target_id=org_id,
        target_org_id=org_id,
        metadata={
            "name": payload.name,
            "industry": payload.industry,
            "persona": payload.persona,
            "owner_email": owner_email or None,
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
    staff_ids = _staff_ids()
    prof_rows = sb.table("profiles").select("id, full_name, home_organization_id").execute().data or []
    prof_by_id = {p["id"]: p for p in prof_rows}
    members = [
        Member(
            user_id=m["user_id"],
            email=emails.get(m["user_id"], "unknown@example.com"),
            full_name=(prof_by_id.get(m["user_id"]) or {}).get("full_name"),
            org_role=m.get("role", "member"),
            home_organization_id=(prof_by_id.get(m["user_id"]) or {}).get("home_organization_id"),
            is_staff=m["user_id"] in staff_ids,
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


@router.post("/{org_id}/members")
def add_member(
    org_id: str,
    request: Request,
    payload: AddMemberRequest,
    staff: StaffPrincipal = Depends(require_permission("customers.edit")),
):
    """Add a user to a company group and switch their active dashboard via RPC."""
    _org_or_404(org_id)
    if org_id == HAKKIU_ORG_ID:
        raise HTTPException(status_code=400, detail="Cannot add members to internal Hakkiu organization")
    if payload.role not in _VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role: {payload.role}")

    try:
        customer_sb().rpc("assign_user_to_group", {
            "p_user_id": payload.user_id,
            "p_org_id": org_id,
            "p_role": payload.role,
        }).execute()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

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
    sb = customer_sb()
    if payload.role == "member":
        owners = (
            sb.table("organization_members")
            .select("user_id")
            .eq("organization_id", org_id)
            .eq("role", "owner")
            .neq("user_id", user_id)
            .execute()
            .data
            or []
        )
        if not owners:
            raise HTTPException(status_code=400, detail="Cannot change role of the last owner. Assign another owner first.")

    res = (
        sb.table("organization_members").update({"role": payload.role})
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
    if org_id == HAKKIU_ORG_ID:
        raise HTTPException(status_code=400, detail="Cannot remove members from internal Hakkiu organization")

    try:
        customer_sb().rpc("remove_user_from_group", {
            "p_user_id": user_id,
            "p_org_id": org_id,
        }).execute()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    write_audit_log(
        staff, "organizations.remove_member", target_type="organization", target_id=org_id,
        target_org_id=org_id, metadata={"user_id": user_id},
        ip=request.client.host if request.client else None,
    )
    return {"success": True}

