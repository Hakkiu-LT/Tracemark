"""Customer-facing organization endpoints: list the companies the caller belongs to
and switch which one is *active*.

Why this exists: a user can be a member of several organizations (their own personal
org created at signup PLUS any shared company they were invited to). The whole customer
API scopes data by a SINGLE column — ``profiles.organization_id`` (see
``dependencies._resolve_org_and_role``). Without a way to change that column, a user who
belongs to more than one company can only ever see the first one, so brands added to a
*different* company (e.g. via the admin portal) never appear in their monitoring list.

These two endpoints are the switch: ``GET /organizations/mine`` lists the memberships and
``POST /organizations/switch`` repoints ``profiles.organization_id`` at another org the
caller actually belongs to. Every org-scoped query downstream then follows automatically.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from tracemark_api.dependencies import CurrentProfile, get_current_profile
from tracemark_api.services.database import get_supabase

router = APIRouter(prefix="/organizations", tags=["organizations"])

# The internal HAKKIU staff "organization". Staff accounts are parked here
# (migration 20260802000001_groups_v1.sql). It is an implementation artifact, never a
# real customer company, so it must never appear in — or be switchable to from — the
# customer app.
SENTINEL_ORG_ID = "00000000-0000-0000-0000-000000000000"


class OrgSummary(BaseModel):
    id: str
    name: str
    role: str
    is_active: bool


class SwitchOrgRequest(BaseModel):
    organization_id: str


@router.get("/mine")
def list_my_organizations(profile: CurrentProfile = Depends(get_current_profile)):
    """Every company the caller is a member of (excluding the staff sentinel org),
    with the currently-active one flagged."""
    sb = get_supabase()
    mem = (
        sb.table("organization_members")
        .select("organization_id, role")
        .eq("user_id", profile.id)
        .execute()
    )
    rows = [r for r in (mem.data or []) if r["organization_id"] != SENTINEL_ORG_ID]

    names: dict[str, str] = {}
    org_ids = [r["organization_id"] for r in rows]
    if org_ids:
        orgs = sb.table("organizations").select("id, name").in_("id", org_ids).execute()
        names = {o["id"]: (o.get("name") or "") for o in (orgs.data or [])}

    result = [
        OrgSummary(
            id=r["organization_id"],
            name=names.get(r["organization_id"]) or "Untitled company",
            role=r.get("role") or "member",
            is_active=r["organization_id"] == profile.organization_id,
        )
        for r in rows
    ]
    # Active first, then alphabetical — stable order for the switcher UI.
    result.sort(key=lambda o: (not o.is_active, o.name.lower()))
    return {
        "organizations": result,
        "active_organization_id": profile.organization_id,
    }


@router.post("/switch")
def switch_organization(
    body: SwitchOrgRequest,
    profile: CurrentProfile = Depends(get_current_profile),
):
    """Repoint the caller's active org. Only orgs the caller is genuinely a member of are
    allowed (membership is re-checked server-side — the client cannot switch into a
    company it does not belong to), and never the staff sentinel org."""
    target = body.organization_id
    if target == SENTINEL_ORG_ID:
        raise HTTPException(status_code=400, detail="That organization cannot be selected")
    if target == profile.organization_id:
        return {"active_organization_id": target}  # already active — no-op

    sb = get_supabase()
    mem = (
        sb.table("organization_members")
        .select("role")
        .eq("user_id", profile.id)
        .eq("organization_id", target)
        .maybe_single()
        .execute()
    )
    if not mem or not mem.data:
        raise HTTPException(status_code=403, detail="You are not a member of that organization")

    sb.table("profiles").update({"organization_id": target}).eq("id", profile.id).execute()
    return {"active_organization_id": target}
