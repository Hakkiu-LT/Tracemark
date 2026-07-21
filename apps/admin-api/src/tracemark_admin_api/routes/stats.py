"""Aggregate stats for the admin dashboard (read-only, cross-org)."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from tracemark_admin_api.clients import customer_sb
from tracemark_admin_api.dependencies import StaffPrincipal, require_permission

router = APIRouter(prefix="/stats", tags=["stats"])

_KNOWN_TAKEDOWN_STATUSES = ("pending", "sent", "acknowledged")


class TakedownStats(BaseModel):
    counts: dict[str, int]
    total: int


@router.get("/takedowns", response_model=TakedownStats)
def takedown_stats(
    staff: StaffPrincipal = Depends(require_permission("customers.view")),
):
    """Counts of takedown_reports by status across ALL organizations."""
    # TODO: paginate if takedown volume grows beyond ~50k rows
    rows = (
        customer_sb()
        .table("takedown_reports")
        .select("status")
        .limit(50000)
        .execute()
        .data
        or []
    )
    counts: dict[str, int] = {s: 0 for s in _KNOWN_TAKEDOWN_STATUSES}
    for r in rows:
        st = r.get("status") or "unknown"
        counts[st] = counts.get(st, 0) + 1
    return TakedownStats(counts=counts, total=len(rows))
