"""
Scraper health recording + lightweight reachability probing.

Every scraper run — whether triggered by a real customer scan (source='live', from
marketplace.batch_detect) or by the daily reachability cron (source='probe', from
main.py startup) — writes one best-effort row into the `scraper_health_log` table.
The Admin Portal "Scraper Health" page aggregates these into per-platform success
rate, latency, and recent-failure views.

Recording is intentionally best-effort: any failure to write a health row is swallowed
so it can NEVER break an actual scan (same philosophy as delivery_log.py).
"""
from __future__ import annotations

import time
from typing import Awaitable, Callable, TypeVar

import requests

from tracemark_api.services.api_usage_tracker import ApiLimitError
from tracemark_api.services.database import get_supabase
from tracemark_api.services.scraper_errors import ScraperBlockedError

T = TypeVar("T")


def classify_error(exc: Exception) -> str:
    """Bucket an exception into a coarse error category for the health dashboard."""
    # A live anti-bot block (403/429) or unauthorized/over-quota API keyset. This is
    # NOT "0 results" — surface it red so staff know the platform is unavailable.
    if isinstance(exc, ScraperBlockedError):
        return "blocked"
    if isinstance(exc, ApiLimitError):
        return "blocked"
    name = type(exc).__name__.lower()
    text = str(exc).lower()
    if "timeout" in name or "timeout" in text or "timed out" in text:
        return "timeout"
    if isinstance(exc, requests.HTTPError) or "status" in text and ("403" in text or "429" in text or "503" in text):
        return "http_error"
    if isinstance(exc, (requests.ConnectionError, requests.RequestException)):
        return "api_error"
    return "parse_error"


def record_scrape(
    platform: str,
    success: bool,
    latency_ms: int,
    *,
    country: str | None = None,
    error_category: str | None = None,
    error_detail: str | None = None,
    source: str = "live",
    brand_name: str | None = None,
    caller_id: str | None = None,
) -> None:
    """Insert one scraper_health_log row. Best-effort — never raises."""
    try:
        get_supabase().table("scraper_health_log").insert({
            "platform": platform,
            "country": country,
            "success": success,
            "latency_ms": max(0, int(latency_ms)),
            "error_category": error_category,
            "error_detail": (error_detail or None) and error_detail[:500],
            "source": source,
            "brand_name": brand_name,
            "caller_id": caller_id,
        }).execute()
    except Exception as ex:  # noqa: BLE001 — health logging must never break a scan
        print(f"[ScraperHealth] failed to record {platform}: {ex}")


async def probe(
    platform: str,
    country: str | None,
    coro_factory: Callable[[], Awaitable[T]],
    *,
    source: str = "live",
    brand_name: str | None = None,
    caller_id: str | None = None,
) -> T:
    """
    Time an async scrape, record its health, then return its result (or re-raise).

    `coro_factory` is a zero-arg callable returning the awaitable to run, e.g.
    `lambda: asyncio.to_thread(self.amazon.search, brand, caller_id=cid, country=c)`.
    The caller keeps its own try/except (e.g. to append to blocked_apis) — this helper
    re-raises so that existing behavior is preserved.
    """
    t0 = time.monotonic()
    try:
        result = await coro_factory()
        record_scrape(platform, True, (time.monotonic() - t0) * 1000, country=country, source=source,
                      brand_name=brand_name, caller_id=caller_id)
        return result
    except Exception as exc:  # noqa: BLE001 — categorize + record, then re-raise
        record_scrape(
            platform,
            False,
            (time.monotonic() - t0) * 1000,
            country=country,
            error_category=classify_error(exc),
            error_detail=str(exc),
            source=source,
            brand_name=brand_name,
            caller_id=caller_id,
        )
        raise


# --- Daily reachability probe -------------------------------------------------------
# Cheap HTTP GET against a stable per-platform URL. This intentionally does NOT run a
# full scan or any Firecrawl JS scrape — it only answers "is this platform reachable
# and not hard-blocking us today?" so health data exists even without customer traffic.
_PROBE_URLS: dict[str, str] = {
    "amazon": "https://www.amazon.com/s?k=test",
    "ebay": "https://www.ebay.com/sch/i.html?_nkw=test",
    "etsy": "https://www.etsy.com/search?q=test",
    "shopify": "https://www.shopify.com/",
    "google_shopping": "https://www.google.com/search?tbm=shop&q=test",
    "alibaba": "https://www.alibaba.com/trade/search?SearchText=test",
    "aliexpress": "https://www.aliexpress.com/",
    "facebook_marketplace": "https://www.facebook.com/marketplace/",
    "tiktok": "https://www.tiktok.com/",
    "instagram": "https://www.instagram.com/",
    "google_ads": "https://adstransparency.google.com/",
    "meta_ads": "https://www.facebook.com/ads/library/",
}

_PROBE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    )
}


def run_reachability_probes() -> None:
    """Probe every platform once and record a 'probe' health row for each. Never raises."""
    for platform, url in _PROBE_URLS.items():
        t0 = time.monotonic()
        try:
            resp = requests.get(url, headers=_PROBE_HEADERS, timeout=10, allow_redirects=True)
            latency = (time.monotonic() - t0) * 1000
            if resp.status_code in (403, 429):
                record_scrape(platform, False, latency, error_category="blocked",
                              error_detail=f"HTTP {resp.status_code}", source="probe",
                              caller_id="system")
            elif resp.status_code >= 400:
                record_scrape(platform, False, latency, error_category="http_error",
                              error_detail=f"HTTP {resp.status_code}", source="probe",
                              caller_id="system")
            else:
                record_scrape(platform, True, latency, source="probe", caller_id="system")
        except Exception as exc:  # noqa: BLE001
            record_scrape(platform, False, (time.monotonic() - t0) * 1000,
                          error_category=classify_error(exc), error_detail=str(exc), source="probe",
                          caller_id="system")
