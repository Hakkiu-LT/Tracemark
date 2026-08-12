"""
Typed scraper errors — shared convention across all marketplace scrapers.

WHY THIS EXISTS
---------------
Before this, a live anti-bot block (HTTP 403/429) on a scan was indistinguishable
from "the brand genuinely has 0 listings". A blocked scraper would `break`/`return []`,
`scraper_health.probe()` saw no exception raised and recorded `success=True`, and the
customer was told "we checked eBay, found nothing" — a silent lie.

`ScraperBlockedError` makes a block a first-class, typed signal:
  - raise it from a scraper when the platform is actively blocking us (403/429) or
    an API keyset is unauthorized/quota-exhausted (401 after refresh),
  - `scraper_health.classify_error` buckets it as "blocked" (red health row),
  - `batch_detect`/`scan_all` catch it and append the platform to `blocked_apis`,
    so the customer sees "couldn't check <platform>" instead of a false "0 found".

This is intentionally a plain Exception subclass (not tied to `ApiLimitError`, which
is about our own free-tier budget guard) so any scraper — API-based or HTML — can raise it.
"""
from __future__ import annotations


class ScraperBlockedError(Exception):
    """
    Raised when a marketplace actively blocks a scan (anti-bot 403/429) or an API
    keyset is unauthorized / over quota — i.e. we could NOT determine results, as
    opposed to determining that there are zero results.

    Attributes:
        platform: short platform key (e.g. "ebay", "amazon") for health/blocked_apis.
        detail:   human-readable reason (status code, message) for logs/health rows.
    """

    def __init__(self, platform: str, detail: str = ""):
        self.platform = platform
        self.detail = detail
        super().__init__(f"{platform} blocked: {detail}" if detail else f"{platform} blocked")
