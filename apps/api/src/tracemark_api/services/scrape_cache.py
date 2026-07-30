"""
scrape_cache.py
===============
Cross-scan, URL-keyed cache of scraped page content.

Goal: avoid re-scraping (and, for Firecrawl, re-paying credits for) URLs we've
already fetched recently. The same page is reused from the cache within its
TTL, so re-scans of the same brand don't re-hit Amazon/Google rate limits or
burn Firecrawl credits on places we just looked at.

Layering (checked in order, cheapest first):
    1. in-memory LRU  — hot recently-scraped URLs (process-local, fast path)
    2. Supabase table — persistent across API restarts/redeploys
    3. live scrape    — only on miss; result is stored back into both layers

The cache stores only the post-fetch ``markdown``/``title`` used by the
detection funnel — not raw HTML — to keep rows small. The funnel is always
re-run on the (possibly cached) content, so changing brand reference assets
still re-evaluate correctly.

TTL is configurable via ``SCRAPE_CACHE_TTL_HOURS`` (default 24h) — set to 0
to effectively disable caching (every fetch goes live).
"""
from __future__ import annotations

import hashlib
import os
import urllib.parse
from collections import OrderedDict
from datetime import datetime, timedelta, timezone
from typing import Optional

from tracemark_api.services.database import get_supabase

# ── Tunables ───────────────────────────────────────────────────────────────────

def _ttl() -> timedelta:
    try:
        hours = int(os.environ.get("SCRAPE_CACHE_TTL_HOURS", "24"))
    except ValueError:
        hours = 24
    return timedelta(hours=hours)

_MEM_MAX = 512  # in-mem LRU capacity (URLs)

# ── Internal state ────────────────────────────────────────────────────────────

# url_hash -> (cached_row_dict, stored_at_utc)
_mem: "OrderedDict[str, tuple[dict, datetime]]" = OrderedDict()


# ── URL normalization (must be stable across token rotation / param order) ─────

def _normalize_url(url: str) -> str:
    """
    Canonicalize a URL so equivalent pages hit the same cache key:
      - strip leading/trailing whitespace
      - lowercase the host, drop 'www.'
      - drop the default http(s) port
      - drop the fragment
      - sort query parameters (so param order doesn't split the cache)
    """
    try:
        u = urllib.parse.urlparse(url.strip())
        host = (u.hostname or "").lower()
        if host.startswith("www."):
            host = host[4:]
        port = f":{u.port}" if u.port and u.port not in (80, 443) else ""
        path = u.path or "/"
        q = urllib.parse.parse_qsl(u.query, keep_blank_values=True)
        q.sort()
        qs = urllib.parse.urlencode(q)
        scheme = u.scheme or "https"
        return f"{scheme}://{host}{port}{path}" + (f"?{qs}" if qs else "")
    except Exception:
        return url.strip()


def _key(url: str) -> str:
    return hashlib.sha256(_normalize_url(url).encode("utf-8")).hexdigest()


# ── Public API ─────────────────────────────────────────────────────────────────

class CachedScrape(dict):
    """Typed-ish dict returned on a cache hit: {markdown, title, scraper_used}."""


def get_cached(url: str) -> Optional[CachedScrape]:
    """Return a cached scrape if fresh, else None. Checks in-mem then DB."""
    if _ttl().total_seconds() <= 0:
        return None
    k = _key(url)
    now = datetime.now(timezone.utc)

    # 1) in-memory hot layer
    if k in _mem:
        row, at = _mem[k]
        if now - at < _ttl():
            _mem.move_to_end(k)
            return CachedScrape(row)
        _mem.pop(k, None)

    # 2) persistent DB layer
    try:
        sb = get_supabase()
        res = (
            sb.table("scrape_cache")
            .select("markdown,title,scraper_used,scraped_at")
            .eq("url_hash", k)
            .maybe_single()
            .execute()
        )
        if res and res.data:
            sa = res.data.get("scraped_at")
            if sa:
                dt = datetime.fromisoformat(str(sa).replace("Z", "+00:00"))
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                if now - dt < _ttl():
                    row = {
                        "markdown": res.data.get("markdown"),
                        "title": res.data.get("title"),
                        "scraper_used": res.data.get("scraper_used"),
                    }
                    _mem[k] = (row, now)
                    _trim()
                    return CachedScrape(row)
    except Exception as e:
        # Cache is best-effort — never let a caching failure break the scrape.
        print(f"[scrape_cache] DB read failed for {url}: {e}")
    return None


def put_cached(url: str, markdown: str, title: Optional[str], scraper_used: str) -> None:
    """Store a fresh scrape into both layers. No-op if there's nothing to cache."""
    if not markdown or _ttl().total_seconds() <= 0:
        return
    k = _key(url)
    now = datetime.now(timezone.utc)
    row = {"markdown": markdown, "title": title, "scraper_used": scraper_used}
    _mem[k] = (row, now)
    _trim()
    try:
        sb = get_supabase()
        sb.table("scrape_cache").upsert(
            {
                "url_hash": k,
                "url": _normalize_url(url),
                "markdown": markdown,
                "title": title,
                "scraper_used": scraper_used,
                "scraped_at": now.isoformat(),
            }
        ).execute()
    except Exception as e:
        print(f"[scrape_cache] DB write failed for {url}: {e}")


# ── housekeeping ───────────────────────────────────────────────────────────────

def _trim() -> None:
    while len(_mem) > _MEM_MAX:
        _mem.popitem(last=False)