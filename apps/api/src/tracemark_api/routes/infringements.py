from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Literal

from tracemark_api.dependencies import get_current_profile, CurrentProfile
from tracemark_api.services.database import get_supabase
from tracemark_api.services.storage import sign_screenshot_url

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
    updated_at: str | None = None
    brand_name: str | None = None
    client_id: str | None = None
    case_status: str | None = None
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
        .select("*, cases!inner(organization_id, user_id, brand_name, detection_region, status, updated_at)")
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


def _flatten_case_fields(row: dict) -> dict:
    """Lift joined case fields onto the infringement row (non-mutating copy).

    The item keeps its OWN status (per-copycat management); the parent scan
    case's status is exposed separately as ``case_status``.
    """
    case_info = row.get("cases") or {}
    flattened = {k: v for k, v in row.items() if k != "cases"}
    flattened["brand_name"] = case_info.get("brand_name")
    flattened["case_status"] = case_info.get("status")
    flattened["case_updated_at"] = case_info.get("updated_at")
    # Private bucket (C5): mint a short-lived signed URL for the client to render.
    flattened["screenshot_url"] = sign_screenshot_url(flattened.get("screenshot_url"))
    # Prefer the item's own per-copycat region (multi-region scans); fall back
    # to the parent case's region for rows persisted before that column existed.
    if not flattened.get("detection_region"):
        flattened["detection_region"] = case_info.get("detection_region")
    return flattened


@router.get("", response_model=InfringementsResponse)
def list_infringements(
    risk_level: str | None = Query(None, description="HIGH, MEDIUM or LOW"),
    status: str | None = Query(None, description="flagged, reviewed or dismissed"),
    platform: str | None = Query(None, description="e.g. amazon, instagram"),
    client_id: str | None = Query(None, description="Filter by client_id"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    profile: CurrentProfile = Depends(get_current_profile),
) -> InfringementsResponse:
    """Return a paginated list of infringements scoped to the user's organization."""
    sb = get_supabase()
    persona = _get_user_persona(profile.id, profile.organization_id)

    query = (
        sb.table("infringements")
        .select("*, cases!inner(organization_id, user_id, brand_name, detection_region, status, updated_at)", count="exact")
        .order("flagged_at", desc=True)
        .limit(limit)
        .offset(offset)
        .eq("cases.organization_id", profile.organization_id)
    )

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

    # Lift joined case fields (brand_name, case_status, …) onto each item.
    # The item keeps its own per-copycat status.
    items = [_flatten_case_fields(row) for row in (result.data or [])]

    return InfringementsResponse(
        items=items,
        total=result.count or 0,
    )


@router.get("/{infringement_id}", response_model=InfringementItem)
def get_infringement(
    infringement_id: str,
    profile: CurrentProfile = Depends(get_current_profile),
) -> InfringementItem:
    """Return a single infringement by id (with its own per-copycat status)."""
    sb = get_supabase()
    data = _infringement_or_404(infringement_id, profile.organization_id, profile.id, sb)
    return _flatten_case_fields(data)


@router.get("/{infringement_id}/evidence", response_model=list[EvidenceItem])
def get_evidence(
    infringement_id: str,
    profile: CurrentProfile = Depends(get_current_profile),
) -> list[EvidenceItem]:
    """Return all evidence snapshots for an infringement, newest first."""
    sb = get_supabase()
    # Verify ownership before returning evidence
    _infringement_or_404(infringement_id, profile.organization_id, profile.id, sb)

    result = (
        sb.table("evidence_items")
        .select("*")
        .eq("infringement_id", infringement_id)
        .order("created_at", desc=True)
        .execute()
    )
    rows = result.data or []
    # Private bucket (C5): sign each screenshot for client rendering.
    for r in rows:
        r["screenshot_url"] = sign_screenshot_url(r.get("screenshot_url"))
    return rows

class SignScreenshotsRequest(BaseModel):
    paths: list[str]


@router.post("/screenshots/sign")
def sign_screenshots(
    payload: SignScreenshotsRequest,
    profile: CurrentProfile = Depends(get_current_profile),
) -> dict[str, str | None]:
    """Batch-sign evidence-screenshot references for the scan-result dialog.

    The customer scan-result view reads the ``evidence`` JSONB directly from
    Supabase (not API-mediated). Those screenshots were uploaded by the
    service-role key, so they have no per-user storage owner — client-side
    signing / owner-RLS cannot work. The frontend therefore posts the collected
    references here and gets back short-lived signed URLs.

    Auth-gated (any logged-in user). We only mint signed URLs; we don't leak
    which paths exist (unknown/failed paths map to null).
    """
    paths = [p for p in (payload.paths or []) if p]
    if len(paths) > 100:
        raise HTTPException(status_code=400, detail="Too many paths (max 100)")
    # De-duplicate while preserving determinism; return a map keyed by the
    # original reference so the client can look each one up.
    out: dict[str, str | None] = {}
    for p in dict.fromkeys(paths):
        out[p] = sign_screenshot_url(p)
    return out


class UpdateStatusRequest(BaseModel):
    status: str
    decline_reason: str | None = None

@router.patch("/{infringement_id}/status", response_model=InfringementItem)
def update_infringement_status(
    infringement_id: str,
    payload: UpdateStatusRequest,
    profile: CurrentProfile = Depends(get_current_profile),
) -> InfringementItem:
    """Update the status of a single infringement (per-copycat).

    The parent scan case is intentionally NOT updated — each copycat is managed
    independently in the customer frontend; scan-level status changes happen on
    the scan-result page via the monitoring routes.
    """
    sb = get_supabase()
    # Verify ownership via parent case (prevents cross-tenant status writes).
    _infringement_or_404(infringement_id, profile.organization_id, profile.id, sb)

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

    # Return the fully hydrated item (brand_name, case_status, detection_region…)
    # so clients can refresh their cache with a single consistent shape.
    updated = _infringement_or_404(infringement_id, profile.organization_id, profile.id, sb)
    return _flatten_case_fields(updated)
