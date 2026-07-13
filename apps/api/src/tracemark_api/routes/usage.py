from fastapi import APIRouter, Depends
from tracemark_api.services.api_usage_tracker import tracker
from pydantic import BaseModel
from datetime import datetime, timezone

router = APIRouter(prefix="/usage-stats", tags=["monitoring"])

from tracemark_api.routes.admin import verify_admin


class UsageStatsResponse(BaseModel):
    summary: list[dict]  # serialized list[ApiUsageSummary]
    by_developer: list[dict]  # serialized list[DeveloperUsageSummary]
    hourly: list[dict]  # last 24h hourly buckets, all APIs combined
    generated_at: str


@router.get("", response_model=UsageStatsResponse)
def get_usage_stats(admin_user=Depends(verify_admin)) -> UsageStatsResponse:
    """Returns real-time API usage statistics. Restricted to admin emails."""
    return UsageStatsResponse(
        summary=[vars(s) for s in tracker.get_usage_summary()],
        by_developer=[vars(d) for d in tracker.get_by_developer()],
        hourly=[vars(b) for b in tracker.get_hourly_breakdown()],
        generated_at=datetime.now(timezone.utc).isoformat(),
    )
