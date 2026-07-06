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
    detection_region: str | None = None


class InfringementsResponse(BaseModel):
    items: list[InfringementItem]
    total: int


class EvidenceItem(BaseModel):
    id: str
    infringement_id: str
    screenshot_url: str | None
    ai_analysis: dict | None
    captured_at: str
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
        .select("*, cases!inner(organization_id, user_id)", count="exact")
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
        query = query.ilike("platform", f"%{platform}%")

    result = query.execute()

    return InfringementsResponse(
        items=result.data or [],
        total=result.count or 0,
    )


@router.get("/{infringement_id}", response_model=InfringementItem)
def get_infringement(
    infringement_id: str,
    current_user=Depends(get_current_user),
) -> InfringementItem:
    """Return a single infringement by id."""
    sb = get_supabase()
    result = (
        sb.table("infringements")
        .select("*, cases(detection_region)")
        .eq("id", infringement_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Infringement not found")
        
    data = result.data
    cases_data = data.get("cases")
    detection_region = cases_data.get("detection_region") if cases_data else None
    data["detection_region"] = detection_region
    return data


@router.get("/{infringement_id}/evidence", response_model=list[EvidenceItem])
def get_evidence(
    infringement_id: str,
    current_user=Depends(get_current_user),
) -> list[EvidenceItem]:
    """Return all evidence snapshots for an infringement, newest first."""
    sb = get_supabase()
    result = (
        sb.table("evidence")
        .select("*")
        .eq("infringement_id", infringement_id)
        .order("captured_at", desc=True)
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
    
    # Verify it exists
    existing = sb.table("infringements").select("id").eq("id", infringement_id).maybe_single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Infringement not found")
        
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
        
    return result.data[0]
