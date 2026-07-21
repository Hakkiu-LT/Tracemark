"""Per-platform scraper health for the admin dashboard (read-only, cross-org).

Aggregates the `scraper_health_log` table (written by the main API — both live customer
scans and the daily reachability probe) into per-platform success rate / latency / last
failure, plus Firecrawl credit usage read from `api_usage_records`.

Also exposes a per-platform event log endpoint so staff can drill into individual scrape
events (which brand was scanned, in which country, success/failure, error detail, latency).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from tracemark_admin_api.clients import customer_sb
from tracemark_admin_api.dependencies import StaffPrincipal, require_permission

router = APIRouter(prefix="/scraper-health", tags=["scraper-health"])

# A platform is flagged degraded when its success rate drops below this, given enough
# samples to be meaningful. Surfaced as an in-page badge only (no push alerting).
_DEGRADED_THRESHOLD = 0.80
_MIN_SAMPLES = 5

_WINDOWS = {"24h": timedelta(hours=24), "7d": timedelta(days=7)}


class PlatformHealth(BaseModel):
    platform: str
    total: int
    failed: int
    success_rate: float          # 0.0–1.0
    avg_latency_ms: int
    last_failure_category: str | None = None
    last_failure_detail: str | None = None
    last_failure_at: str | None = None
    last_checked_at: str | None = None
    is_degraded: bool


class ScraperHealthResponse(BaseModel):
    window: str
    platforms: list[PlatformHealth]
    firecrawl_credits_used: int


@router.get("", response_model=ScraperHealthResponse)
def scraper_health(
    window: str = Query("24h", pattern="^(24h|7d)$"),
    staff: StaffPrincipal = Depends(require_permission("scraper_health.view")),
):
    """Per-platform scraper health over the selected window, across ALL organizations."""
    cutoff = (datetime.now(timezone.utc) - _WINDOWS[window]).isoformat()

    rows = (
        customer_sb()
        .table("scraper_health_log")
        .select("platform,success,latency_ms,error_category,error_detail,checked_at")
        .gte("checked_at", cutoff)
        .order("checked_at", desc=True)
        .limit(50000)
        .execute()
        .data
        or []
    )

    # Group per platform. Rows arrive newest-first, so the first failure we see per
    # platform is the most recent one.
    by_platform: dict[str, dict] = {}
    for r in rows:
        p = r.get("platform") or "unknown"
        agg = by_platform.setdefault(p, {
            "total": 0, "failed": 0, "latency_sum": 0,
            "last_failure": None, "last_checked_at": None,
        })
        agg["total"] += 1
        agg["latency_sum"] += r.get("latency_ms") or 0
        if agg["last_checked_at"] is None:
            agg["last_checked_at"] = r.get("checked_at")
        if not r.get("success"):
            agg["failed"] += 1
            if agg["last_failure"] is None:
                agg["last_failure"] = r

    platforms: list[PlatformHealth] = []
    for p, agg in by_platform.items():
        total = agg["total"]
        failed = agg["failed"]
        rate = (total - failed) / total if total else 0.0
        lf = agg["last_failure"]
        platforms.append(PlatformHealth(
            platform=p,
            total=total,
            failed=failed,
            success_rate=round(rate, 4),
            avg_latency_ms=round(agg["latency_sum"] / total) if total else 0,
            last_failure_category=(lf or {}).get("error_category"),
            last_failure_detail=(lf or {}).get("error_detail"),
            last_failure_at=(lf or {}).get("checked_at"),
            last_checked_at=agg["last_checked_at"],
            is_degraded=(total >= _MIN_SAMPLES and rate < _DEGRADED_THRESHOLD),
        ))

    platforms.sort(key=lambda x: (not x.is_degraded, x.success_rate, x.platform))

    # Firecrawl credit usage over the same window (already tracked per call).
    credit_rows = (
        customer_sb()
        .table("api_usage_records")
        .select("credits_used")
        .eq("api_key", "firecrawl")
        .gte("called_at", cutoff)
        .limit(50000)
        .execute()
        .data
        or []
    )
    firecrawl_credits = sum(r.get("credits_used") or 0 for r in credit_rows)

    return ScraperHealthResponse(
        window=window,
        platforms=platforms,
        firecrawl_credits_used=firecrawl_credits,
    )


# ---------------------------------------------------------------------------
# Per-platform event drill-down
# ---------------------------------------------------------------------------

class ScraperEvent(BaseModel):
    platform: Optional[str] = None
    brand_name: Optional[str] = None
    country: Optional[str] = None
    success: Optional[bool] = None
    latency_ms: Optional[int] = None
    error_category: Optional[str] = None
    error_detail: Optional[str] = None
    source: Optional[str] = None
    caller_id: Optional[str] = None
    checked_at: Optional[str] = None


class ScraperEventsResponse(BaseModel):
    platform: str
    window: str
    events: list[ScraperEvent]


@router.get("/{platform}/events", response_model=ScraperEventsResponse)
def scraper_health_events(
    platform: str,
    window: str = Query("24h", pattern="^(24h|7d)$"),
    status: str = Query("all", pattern="^(all|failed)$"),
    source: str = Query("all", pattern="^(all|live|probe)$"),
    limit: int = Query(200, ge=1, le=1000),
    staff: StaffPrincipal = Depends(require_permission("scraper_health.view")),
):
    """Individual scrape events for a single platform, optionally filtered."""
    cutoff = (datetime.now(timezone.utc) - _WINDOWS[window]).isoformat()

    query = (
        customer_sb()
        .table("scraper_health_log")
        .select("platform,brand_name,country,success,latency_ms,error_category,error_detail,source,caller_id,checked_at")
        .eq("platform", platform)
        .gte("checked_at", cutoff)
    )
    if status == "failed":
        query = query.eq("success", False)
    if source != "all":
        query = query.eq("source", source)

    rows = (
        query
        .order("checked_at", desc=True)
        .limit(limit)
        .execute()
        .data
        or []
    )

    return ScraperEventsResponse(
        platform=platform,
        window=window,
        events=[ScraperEvent(**r) for r in rows],
    )
