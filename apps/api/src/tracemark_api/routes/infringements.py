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


@router.get("", response_model=InfringementsResponse)
def list_infringements(
    risk_level: str | None = Query(None, description="HIGH, MEDIUM or LOW"),
    status: str | None = Query(None, description="flagged, reviewed or dismissed"),
    platform: str | None = Query(None, description="e.g. amazon, instagram"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user=Depends(get_current_user),
) -> InfringementsResponse:
    """Return a paginated list of infringements, newest first."""
    sb = get_supabase()

    query = (
        sb.table("infringements")
        .select("*", count="exact")
        .order("flagged_at", desc=True)
        .limit(limit)
        .offset(offset)
    )

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
        .select("*")
        .eq("id", infringement_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Infringement not found")
    return result.data


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
