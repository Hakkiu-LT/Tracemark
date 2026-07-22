from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from tracemark_api.dependencies import AuthUser, get_current_user
from tracemark_api.services.api_usage_tracker import tracker

router = APIRouter(tags=["usage"])


def _load_admin_emails() -> set[str]:
    raw = os.environ.get("ADMIN_EMAILS", "")
    return {e.strip().lower() for e in raw.split(",") if e.strip()}


def _require_admin(current_user: AuthUser = Depends(get_current_user)) -> AuthUser:
    if current_user.email.lower() not in _load_admin_emails():
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


@dataclass
class UsageStatsResponse:
    generated_at: str
    summary: list
    by_developer: list


@router.get("/usage-stats")
def get_usage_stats(admin_user: AuthUser = Depends(_require_admin)):
    """Return aggregate API usage stats. Restricted to admin emails via ADMIN_EMAILS env var."""
    summary = tracker.get_usage_summary()
    by_developer = [
        {
            "caller_id": d.caller_id,
            "total_calls_today": d.total_calls_today,
            "by_api": d.by_api,
        }
        for d in tracker.get_by_developer()
    ]
    return UsageStatsResponse(
        generated_at=datetime.now(timezone.utc).isoformat(),
        summary=summary,
        by_developer=by_developer,
    )
