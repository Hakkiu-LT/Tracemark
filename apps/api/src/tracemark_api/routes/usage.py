import os
from fastapi import APIRouter, Depends, HTTPException
from tracemark_api.services.api_usage_tracker import tracker
from tracemark_api.dependencies import get_current_user
from pydantic import BaseModel
from datetime import datetime, timezone

router = APIRouter(prefix="/usage-stats", tags=["monitoring"])

# Comma-separated list of emails allowed to view usage stats, e.g.:
# ADMIN_EMAILS=dom@tracemark.io,avery@tracemark.io
_ADMIN_EMAILS: set[str] = {
    e.strip().lower()
    for e in os.environ.get("ADMIN_EMAILS", "").split(",")
    if e.strip()
}


class UsageStatsResponse(BaseModel):
    summary: list[dict]        # serialized list[ApiUsageSummary]
    by_developer: list[dict]   # serialized list[DeveloperUsageSummary]
    hourly: list[dict]         # last 24h hourly buckets, all APIs combined
    generated_at: str


@router.get("", response_model=UsageStatsResponse)
def get_usage_stats(current_user=Depends(get_current_user)) -> UsageStatsResponse:
    """Returns real-time API usage statistics. Restricted to admin emails."""
    user_email = (current_user.email or "").lower()
    if _ADMIN_EMAILS and user_email not in _ADMIN_EMAILS:
        raise HTTPException(status_code=403, detail="Access restricted to admins.")
    return UsageStatsResponse(
        summary=[vars(s) for s in tracker.get_usage_summary()],
        by_developer=[vars(d) for d in tracker.get_by_developer()],
        hourly=[vars(b) for b in tracker.get_hourly_breakdown()],
        generated_at=datetime.now(timezone.utc).isoformat(),
    )
