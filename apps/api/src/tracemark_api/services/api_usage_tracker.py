import os
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from typing import Callable, Awaitable, TypeVar, Any

T = TypeVar("T")

RESET_DAILY = "midnight_utc"
RESET_MONTHLY = "monthly"

@dataclass
class ApiDefinition:
    key: str
    label: str
    free_limit: int
    reset_period: str           # "midnight_utc" or "monthly"
    category: str               # "search" | "whois" | "ads" | "ai" | "scraper"
    requires_env_var: str | None = None  # env var that must be set to use this API

API_REGISTRY: list[ApiDefinition] = [
    ApiDefinition("google_serp",     "Google SERP Scraper",              100,  RESET_DAILY,   "search"),
    ApiDefinition("whois",           "WHOIS Lookup",                     500,  RESET_DAILY,   "whois"),
    ApiDefinition("google_ads",      "Google Ads Transparency",          100,  RESET_DAILY,   "ads"),
    ApiDefinition("meta_ads",        "Meta Ad Library API",              200,  RESET_DAILY,   "ads",     "META_ADS_ACCESS_TOKEN"),
    ApiDefinition("firecrawl",       "Firecrawl JS Scraper",             400,  RESET_MONTHLY, "scraper", "FIRECRAWL_API_KEY"),
    ApiDefinition("gemini_flash",    "Gemini API 2.5 Flash (Parsing)",   1500, RESET_DAILY,   "ai",      "GEMINI_API_KEY"),
    ApiDefinition("gemini_pro",      "Gemini API 2.5 Pro (Decision)",    50,   RESET_DAILY,   "ai",      "GEMINI_API_KEY"),
    ApiDefinition("html_scraper",    "HTML Scraper (Local)",             999_999,  RESET_DAILY,   "scraper"),
]

@dataclass
class UsageRecord:
    api_key: str
    caller_id: str       # user email or user id from JWT; "system" if unauthenticated
    called_at: str       # ISO 8601 timestamp
    success: bool
    latency_ms: int
    endpoint: str        # which FastAPI endpoint triggered this call
    credits_used: int = 1  # for Firecrawl, pass actual credits; default 1 for others

@dataclass
class ApiUsageSummary:
    api_key: str
    label: str
    category: str
    free_limit: int
    reset_period: str
    used_today: int           # for monthly APIs (firecrawl): used this month
    remaining: int
    percent_used: float       # 0.0 to 100.0
    is_blocked: bool
    last_called_at: str | None
    requires_env_var: str | None
    env_var_present: bool     # True if the required env var is set

@dataclass
class DeveloperUsageSummary:
    caller_id: str
    total_calls_today: int
    by_api: dict[str, int]    # api_key → call count

@dataclass
class HourlyBucket:
    hour: str   # "HH:00" format, UTC
    count: int


def parse_iso(iso_str: str) -> datetime:
    # Replace Z with +00:00 for older Python versions
    if iso_str.endswith("Z"):
        iso_str = iso_str[:-1] + "+00:00"
    dt = datetime.fromisoformat(iso_str)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


class ApiUsageTracker:
    def __init__(self):
        self._records: list[UsageRecord] = []
        # TODO: replace with Redis/PostgreSQL for persistence in production.
        # When doing so, replace _records with async DB queries in each method below.

    def record(self, entry: UsageRecord) -> None:
        """Append a usage record."""
        self._records.append(entry)

    def _get_window_records(self, api_key: str) -> list[UsageRecord]:
        """
        Returns records in the current reset window for api_key.
        For RESET_DAILY: records since UTC midnight today.
        For RESET_MONTHLY: records since the 1st of the current UTC month.
        """
        defn = next((d for d in API_REGISTRY if d.key == api_key), None)
        if not defn:
            return []

        now_utc = datetime.now(timezone.utc)
        if defn.reset_period == RESET_DAILY:
            window_start = datetime(now_utc.year, now_utc.month, now_utc.day, tzinfo=timezone.utc)
        else:
            window_start = datetime(now_utc.year, now_utc.month, 1, tzinfo=timezone.utc)

        matching_records = []
        for r in self._records:
            if r.api_key != api_key:
                continue
            try:
                r_dt = parse_iso(r.called_at)
                if r_dt >= window_start:
                    matching_records.append(r)
            except Exception:
                # Fallback if invalid timestamp
                pass
        return matching_records

    def get_used_count(self, api_key: str) -> int:
        """Total calls (or credits for firecrawl) in the current window."""
        records = self._get_window_records(api_key)
        return sum(r.credits_used for r in records)

    def is_blocked(self, api_key: str) -> bool:
        """True if used_count >= free_limit for this api_key."""
        defn = next((d for d in API_REGISTRY if d.key == api_key), None)
        if not defn:
            return False
        return self.get_used_count(api_key) >= defn.free_limit

    def get_usage_summary(self) -> list[ApiUsageSummary]:
        """Returns one ApiUsageSummary per entry in API_REGISTRY."""
        summaries = []
        for defn in API_REGISTRY:
            used_today = self.get_used_count(defn.key)
            remaining = max(0, defn.free_limit - used_today)
            percent_used = min(100.0, (used_today / defn.free_limit) * 100.0) if defn.free_limit > 0 else 0.0
            is_blocked = used_today >= defn.free_limit

            # find last called
            last_record = None
            for r in reversed(self._records):
                if r.api_key == defn.key:
                    last_record = r
                    break
            last_called_at = last_record.called_at if last_record else None
            env_var_present = True if defn.requires_env_var is None else bool(os.environ.get(defn.requires_env_var))

            summaries.append(ApiUsageSummary(
                api_key=defn.key,
                label=defn.label,
                category=defn.category,
                free_limit=defn.free_limit,
                reset_period=defn.reset_period,
                used_today=used_today,
                remaining=remaining,
                percent_used=percent_used,
                is_blocked=is_blocked,
                last_called_at=last_called_at,
                requires_env_var=defn.requires_env_var,
                env_var_present=env_var_present
            ))
        return summaries

    def get_by_developer(self) -> list[DeveloperUsageSummary]:
        """Groups today's records by caller_id."""
        now_utc = datetime.now(timezone.utc)
        today_start = datetime(now_utc.year, now_utc.month, now_utc.day, tzinfo=timezone.utc)

        by_caller: dict[str, list[UsageRecord]] = {}
        for r in self._records:
            try:
                r_dt = parse_iso(r.called_at)
                if r_dt >= today_start:
                    by_caller.setdefault(r.caller_id, []).append(r)
            except Exception:
                pass

        summaries = []
        for caller_id, records in by_caller.items():
            total_calls_today = len(records)
            by_api: dict[str, int] = {}
            for r in records:
                by_api[r.api_key] = by_api.get(r.api_key, 0) + 1
            summaries.append(DeveloperUsageSummary(
                caller_id=caller_id,
                total_calls_today=total_calls_today,
                by_api=by_api
            ))
        return summaries

    def get_hourly_breakdown(self, api_key: str | None = None) -> list[HourlyBucket]:
        """
        Returns the last 24 hours broken into 1-hour UTC buckets.
        If api_key is None, aggregates all APIs.
        """
        now_utc = datetime.now(timezone.utc)
        current_hour = now_utc.replace(minute=0, second=0, microsecond=0)
        
        buckets = []
        for i in range(24):
            h = current_hour - timedelta(hours=23 - i)
            hour_label = h.strftime("%H:00")
            count = 0
            for r in self._records:
                try:
                    r_dt = parse_iso(r.called_at)
                    if h <= r_dt < h + timedelta(hours=1):
                        if api_key is None or r.api_key == api_key:
                            count += 1
                except Exception:
                    pass
            buckets.append(HourlyBucket(hour=hour_label, count=count))
        return buckets

    def reset_all(self) -> None:
        """Clears all records. For testing/manual reset only."""
        self._records.clear()


# Singleton — import this from other modules
tracker = ApiUsageTracker()


class ApiLimitError(Exception):
    def __init__(self, api_key: str, label: str, limit: int, reset_period: str):
        super().__init__(
            f"Daily free limit reached for {label} ({limit} calls/{reset_period}). "
            f"Blocking further calls until the next reset window."
        )
        self.api_key = api_key
        self.label = label
        self.limit = limit
        self.reset_period = reset_period


def call_with_tracking(
    api_key: str,
    caller_id: str,
    endpoint: str,
    fn: Callable[[], T],
    credits_used: int = 1,
) -> T:
    """
    Synchronous wrapper. Steps:
    1. Check tracker.is_blocked(api_key) → raise ApiLimitError if blocked.
    2. Record start time.
    3. Call fn() inside try/except.
    4. Record result via tracker.record(...) regardless of success/failure.
    5. Re-raise original exception if fn() failed.
    """
    if tracker.is_blocked(api_key):
        defn = next((d for d in API_REGISTRY if d.key == api_key), None)
        label = defn.label if defn else api_key
        limit = defn.free_limit if defn else 0
        reset_period = defn.reset_period if defn else "midnight_utc"
        raise ApiLimitError(api_key, label, limit, reset_period)

    start_time = time.time()
    called_at = datetime.now(timezone.utc).isoformat()
    try:
        res = fn()
        latency_ms = int((time.time() - start_time) * 1000)
        tracker.record(UsageRecord(
            api_key=api_key,
            caller_id=caller_id,
            called_at=called_at,
            success=True,
            latency_ms=latency_ms,
            endpoint=endpoint,
            credits_used=credits_used
        ))
        return res
    except Exception as e:
        latency_ms = int((time.time() - start_time) * 1000)
        tracker.record(UsageRecord(
            api_key=api_key,
            caller_id=caller_id,
            called_at=called_at,
            success=False,
            latency_ms=latency_ms,
            endpoint=endpoint,
            credits_used=credits_used
        ))
        raise e


async def async_call_with_tracking(
    api_key: str,
    caller_id: str,
    endpoint: str,
    fn: Callable[[], Awaitable[T]],
    credits_used: int = 1,
) -> T:
    """Async variant of call_with_tracking for use with async FastAPI routes."""
    if tracker.is_blocked(api_key):
        defn = next((d for d in API_REGISTRY if d.key == api_key), None)
        label = defn.label if defn else api_key
        limit = defn.free_limit if defn else 0
        reset_period = defn.reset_period if defn else "midnight_utc"
        raise ApiLimitError(api_key, label, limit, reset_period)

    start_time = time.time()
    called_at = datetime.now(timezone.utc).isoformat()
    try:
        res = await fn()
        latency_ms = int((time.time() - start_time) * 1000)
        tracker.record(UsageRecord(
            api_key=api_key,
            caller_id=caller_id,
            called_at=called_at,
            success=True,
            latency_ms=latency_ms,
            endpoint=endpoint,
            credits_used=credits_used
        ))
        return res
    except Exception as e:
        latency_ms = int((time.time() - start_time) * 1000)
        tracker.record(UsageRecord(
            api_key=api_key,
            caller_id=caller_id,
            called_at=called_at,
            success=False,
            latency_ms=latency_ms,
            endpoint=endpoint,
            credits_used=credits_used
        ))
        raise e
