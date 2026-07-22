from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Literal

from tracemark_api.dependencies import get_current_user
from tracemark_api.services.database import get_supabase

router = APIRouter(prefix="/infringements", tags=["infringements"])


class InfringementItem(BaseModel):
    id: str
    case_id: str | None
    platform: str
    source_url: str
    risk_level: Literal["HIGH", "MEDIUM", "LOW"]
    match_score: float
    match_type: str
    status: str
    screenshot_url: str | None
    flagged_at: str
    created_at: str
    case_updated_at: str | None = None
    detection_region: str | None = None


class InfringementsResponse(BaseModel):
    items: list[InfringementItem]
    total: int


class EvidenceItem(BaseModel):
    id: str
    case_id: str | None
    infringement_id: str | None
    source_url: str
    platform: str
    screenshot_url: str | None
    content_hash: str | None
    tier0_score: float | None
    tier1_score: float | None
    tier2_score: float | None
    overall_score: float | None
    verdict: str | None
    category: list | None
    criteria: list | None
    confidence: str | None
    first_seen_at: str | None
    scraped_at: str | None
    status: str
    created_at: str


def _get_user_organization_id(user_id: str) -> str | None:
    """Fetch the organization_id for a given user from the profiles table."""
    sb = get_supabase()
    try:
        res = sb.table("profiles").select("organization_id").eq("id", user_id).maybe_single().execute()
        return res.data.get("organization_id") if res.data else None
    except Exception:
        return None


def _get_user_persona(user_id: str, organization_id: str | None) -> str:
    if not organization_id:
        return "brand_owner"
    sb = get_supabase()
    try:
        res = sb.table("org_settings").select("persona").eq("organization_id", organization_id).maybe_single().execute()
        return res.data.get("persona", "brand_owner") if res.data else "brand_owner"
    except Exception:
        return "brand_owner"


def _infringement_or_404(infringement_id: str, org_id: str | None, user_id: str, sb) -> dict:
    """Fetch an infringement only if its parent case belongs to the caller's org.
    Returns 404 (not 403) to avoid leaking existence of other orgs' data."""
    res = (
        sb.table("infringements")
        .select("*, cases!inner(organization_id, user_id, detection_region, status, updated_at)")
        .eq("id", infringement_id)
        .maybe_single()
        .execute()
    )
    row = res.data if res else None
    if not row:
        raise HTTPException(status_code=404, detail="Infringement not found")

    case_info = row.get("cases") or {}
    if org_id:
        if case_info.get("organization_id") != org_id:
            raise HTTPException(status_code=404, detail="Infringement not found")
    else:
        if case_info.get("user_id") != user_id:
            raise HTTPException(status_code=404, detail="Infringement not found")
    return row


@router.get("", response_model=InfringementsResponse)
def list_infringements(
    risk_level: str | None = Query(None, description="HIGH, MEDIUM or LOW"),
    status: str | None = Query(None, description="flagged, reviewed or dismissed"),
    platform: str | None = Query(None, description="e.g. amazon, instagram"),
    client_id: str | None = Query(None, description="Filter by client_id"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user=Depends(get_current_user),
) -> InfringementsResponse:
    """Return a paginated list of infringements scoped to the user's organization."""
    sb = get_supabase()
    organization_id = _get_user_organization_id(current_user.id)
    persona = _get_user_persona(current_user.id, organization_id)

    query = (
        sb.table("infringements")
        .select("*, cases!inner(organization_id, user_id, status, updated_at)", count="exact")
        .order("flagged_at", desc=True)
        .limit(limit)
        .offset(offset)
    )

    if organization_id:
        query = query.eq("cases.organization_id", organization_id)
    else:
        query = query.eq("cases.user_id", current_user.id)

    # Apply persona mode isolation
    if persona == "law_firm":
        if client_id:
            query = query.eq("client_id", client_id)
        else:
            query = query.not_.is_("client_id", "null")
    else:
        query = query.is_("client_id", "null")

    if risk_level:
        query = query.eq("risk_level", risk_level.upper())
    if status:
        query = query.eq("status", status.lower())
    if platform:
        # Escape LIKE wildcards so user input can't broaden the match.
        safe = platform.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        query = query.ilike("platform", f"%{safe}%")

    result = query.execute()

    # Flatten cases status and updated_at
    items = []
    for row in (result.data or []):
        case_info = row.get("cases") or {}
        row["status"] = case_info.get("status") or row.get("status")
        row["case_updated_at"] = case_info.get("updated_at")
        items.append(row)

    return InfringementsResponse(
        items=items,
        total=result.count or 0,
    )


@router.get("/{infringement_id}", response_model=InfringementItem)
def get_infringement(
    infringement_id: str,
    current_user=Depends(get_current_user),
) -> InfringementItem:
    """Return a single infringement by id."""
    sb = get_supabase()
    organization_id = _get_user_organization_id(current_user.id)
    data = _infringement_or_404(infringement_id, organization_id, current_user.id, sb)

    cases_data = data.get("cases") or {}
    data["detection_region"] = cases_data.get("detection_region")
    data["status"] = cases_data.get("status") or data.get("status")
    data["case_updated_at"] = cases_data.get("updated_at")
    return data


@router.get("/{infringement_id}/evidence", response_model=list[EvidenceItem])
def get_evidence(
    infringement_id: str,
    current_user=Depends(get_current_user),
) -> list[EvidenceItem]:
    """Return all evidence snapshots for an infringement, newest first."""
    sb = get_supabase()
    organization_id = _get_user_organization_id(current_user.id)
    # Verify ownership before returning evidence
    _infringement_or_404(infringement_id, organization_id, current_user.id, sb)

    result = (
        sb.table("evidence_items")
        .select("*")
        .eq("infringement_id", infringement_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []

class UpdateStatusRequest(BaseModel):
    status: str
    decline_reason: str | None = None

@router.patch("/{infringement_id}/status", response_model=InfringementItem)
def update_infringement_status(
    infringement_id: str,
    payload: UpdateStatusRequest,
    current_user=Depends(get_current_user),
) -> InfringementItem:
    """Update the status of an infringement."""
    sb = get_supabase()
    organization_id = _get_user_organization_id(current_user.id)
    # Verify ownership via parent case (prevents cross-tenant status writes).
    _infringement_or_404(infringement_id, organization_id, current_user.id, sb)
        
    updates = {"status": payload.status}
    if payload.decline_reason is not None:
        updates["decline_reason"] = payload.decline_reason

    try:
        result = (
            sb.table("infringements")
            .update(updates)
            .eq("id", infringement_id)
            .execute()
        )
    except Exception as e:
        if "decline_reason" in str(e):
            result = (
                sb.table("infringements")
                .update({"status": payload.status})
                .eq("id", infringement_id)
                .execute()
            )
            print(f"[Infringements] Decline reason fallback: {payload.decline_reason}")
        else:
            raise e
    
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update status")
        
    updated_inf = result.data[0]
    
    # Cascade status update to the linked case (trigger will set updated_at to now)
    case_id = updated_inf.get("case_id")
    if case_id:
        case_updates = {"status": payload.status}
        if payload.decline_reason is not None:
            case_updates["decline_reason"] = payload.decline_reason
        try:
            case_res = (
                sb.table("cases")
                .update(case_updates)
                .eq("id", case_id)
                .select("status, updated_at")
                .execute()
            )
            if case_res.data:
                updated_inf["status"] = case_res.data[0].get("status") or updated_inf["status"]
                updated_inf["case_updated_at"] = case_res.data[0].get("updated_at")
        except Exception as e_case:
            print(f"[Infringements] Failed to sync case status: {e_case}")
            
    return updated_inf
