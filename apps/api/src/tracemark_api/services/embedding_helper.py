"""
Embedding helpers for Tier 1 semantic similarity scoring.

Uses Google Gemini text embeddings (text-embedding-004, 768 dims) via the
same langchain-google-genai integration already in the codebase.
"""
from __future__ import annotations

import os
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    pass

try:
    import numpy as np
except ImportError:
    np = None

_EMBED_MODEL = "models/gemini-embedding-001"
_EMBED_DIM = 768


def embed_text(text: str) -> list[float] | None:
    """
    Embed a single text string using Gemini gemini-embedding-001.

    Returns a list of 768 floats, or None if the API is unavailable.
    """
    if not text or not text.strip():
        return None

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None

    try:
        from langchain_google_genai import GoogleGenerativeAIEmbeddings

        embeddings_model = GoogleGenerativeAIEmbeddings(
            model=_EMBED_MODEL,
            google_api_key=api_key,
            output_dimensionality=_EMBED_DIM,
        )
        vec = embeddings_model.embed_query(text[:8000])
        if vec and len(vec) == _EMBED_DIM:
            return vec
        return None
    except Exception as e:
        print(f"[Embedding] embed_text failed: {e}")
        return None


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    if not a or not b or len(a) != len(b):
        return 0.0

    if np is not None:
        arr_a = np.array(a, dtype=np.float32)
        arr_b = np.array(b, dtype=np.float32)
        norm_a = np.linalg.norm(arr_a)
        norm_b = np.linalg.norm(arr_b)
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return float(np.dot(arr_a, arr_b) / (norm_a * norm_b))

    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(y * y for y in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


from tracemark_api.services.storage import compute_content_hash
from tracemark_api.services.ssrf import validate_ssrf_url, SSRFError


def _parse_embedding(raw: any) -> list[float] | None:
    """Parse a pgvector embedding from the DB (string or list) into a float list."""
    if raw is None:
        return None
    if isinstance(raw, list):
        return [float(x) for x in raw]
    if isinstance(raw, str):
        try:
            cleaned = raw.strip("[]() ")
            return [float(x.strip()) for x in cleaned.split(",") if x.strip()]
        except (ValueError, IndexError):
            return None
    return None


def get_brand_reference_assets(brand_id: str) -> list[dict]:
    """
    Load brand reference assets from the brand_assets table.

    Returns a list of asset dicts with asset_type, file_url, phash, embedding.
    """
    from tracemark_api.services.database import get_supabase

    sb = get_supabase()
    try:
        res = (
            sb.table("brand_assets")
            .select("id, asset_type, file_url, phash, embedding, metadata")
            .eq("brand_id", brand_id)
            .execute()
        )
        return res.data or []
    except Exception as e:
        print(f"[Embedding] Failed to load brand assets: {e}")
        return []


def _fetch_page_text(url: str) -> str:
    """
    Fetch a page and return clean plain text (max 8000 chars).

    Tries direct httpx first. If the response is mostly JS / empty, falls
    back to Firecrawl for rendered markdown.
    """
    import re

    if not url:
        return ""

    try:
        validate_ssrf_url(url)
    except SSRFError as e:
        print(f"[Embedding] Rejected unsafe URL in _fetch_page_text: {e}")
        return ""

    text = ""
    try:
        import httpx
        from bs4 import BeautifulSoup

        resp = httpx.get(
            url,
            timeout=10.0,
            follow_redirects=False,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
        )
        if resp.status_code == 200 and resp.text:
            soup = BeautifulSoup(resp.text, "html.parser")
            for tag in soup(["script", "style", "noscript", "svg"]):
                tag.decompose()
            text = soup.get_text(separator=" ", strip=True)
    except Exception as e:
        print(f"[Embedding] httpx fetch failed for {url}: {e}")

    if len(text) < 200:
        try:
            from tracemark_api.services.firecrawl_client import scrape_page

            result = scrape_page(url)
            if result and result.success and result.markdown:
                text = result.markdown
        except Exception as e:
            print(f"[Embedding] Firecrawl fetch failed for {url}: {e}")

    text = re.sub(r"\s+", " ", text).strip()
    return text[:8000]


def ensure_official_site_reference(brand_id: str) -> list[float] | None:
    """
    Ensure an auto-generated reference_content asset exists for a brand.

    Uses the brand's ``official_domains`` list (or falls back to ``website``)
    as the source. Fetches the page, extracts plain text, embeds it with
    the Gemini Embedding API, and stores the result as a ``brand_assets``
    row with ``asset_type = 'reference_content'`` and
    ``metadata.auto_generated = true``.

    Caches the result for 30 days. If a fresh-enough auto-generated row
    already exists, returns its embedding without re-fetching.

    Returns the embedding (list of 768 floats) or ``None`` on failure.
    """
    from datetime import datetime, timezone, timedelta
    from tracemark_api.services.database import get_supabase

    sb = get_supabase()
    try:
        brand_res = (
            sb.table("brands")
            .select("id, website, official_domains")
            .eq("id", brand_id)
            .maybe_single()
            .execute()
        )
        brand = brand_res.data if brand_res else None
        if not brand:
            return None

        source_urls: list[str] = []
        for d in brand.get("official_domains") or []:
            d = (d or "").strip()
            if not d:
                continue
            if not d.startswith("http"):
                d = f"https://{d.lstrip('*.')}"
            source_urls.append(d)
        if not source_urls and brand.get("website"):
            w = brand["website"].strip()
            if w:
                if not w.startswith("http"):
                    w = f"https://{w}"
                source_urls.append(w)
        if not source_urls:
            return None
    except Exception as e:
        print(f"[Embedding] Failed to load brand for reference content: {e}")
        return None

    try:
        existing = (
            sb.table("brand_assets")
            .select("id, embedding, metadata")
            .eq("brand_id", brand_id)
            .eq("asset_type", "reference_content")
            .execute()
        )
        for row in existing.data or []:
            meta = row.get("metadata") or {}
            if not meta.get("auto_generated"):
                continue
            last_fetched = meta.get("last_fetched")
            if not last_fetched:
                continue
            try:
                last_dt = datetime.fromisoformat(last_fetched)
                if last_dt.tzinfo is None:
                    last_dt = last_dt.replace(tzinfo=timezone.utc)
            except (ValueError, TypeError):
                continue
            if datetime.now(timezone.utc) - last_dt < timedelta(days=30):
                emb = _parse_embedding(row.get("embedding"))
                if emb:
                    return emb
    except Exception as e:
        print(f"[Embedding] Failed to check existing auto-ref: {e}")

    combined_text = ""
    for url in source_urls[:3]:
        chunk = _fetch_page_text(url)
        if chunk:
            combined_text += f"\n\n--- {url} ---\n\n" + chunk
    if not combined_text.strip():
        return None

    emb = embed_text(combined_text)
    if not emb:
        return None

    now_iso = datetime.now(timezone.utc).isoformat()
    content_hash = compute_content_hash(combined_text)
    try:
        existing_auto_rows = [
            r for r in (existing.data or [])
            if (r.get("metadata") or {}).get("auto_generated")
        ]
        for old in existing_auto_rows:
            try:
                sb.table("brand_assets").delete().eq("id", old["id"]).execute()
            except Exception:
                pass

        sb.table("brand_assets").insert({
            "brand_id": brand_id,
            "asset_type": "reference_content",
            "file_url": source_urls[0],
            "content_hash": content_hash,
            "embedding": str(emb),
            "metadata": {
                "auto_generated": True,
                "last_fetched": now_iso,
                "source_urls": source_urls,
                "text_length": len(combined_text),
            },
        }).execute()
    except Exception as e:
        print(f"[Embedding] Failed to store auto-ref: {e}")

    return emb


def compute_screenshot_phash(screenshot_url: str) -> int | None:
    """
    Download a screenshot and compute its pHash.

    Returns the pHash as a bigint, or None on failure.
    """
    if not screenshot_url:
        return None

    try:
        validate_ssrf_url(screenshot_url)
    except SSRFError as e:
        print(f"[Embedding] Rejected unsafe screenshot URL in compute_screenshot_phash: {e}")
        return None

    try:
        import io
        import httpx
        from PIL import Image
        import imagehash

        resp = httpx.get(screenshot_url, timeout=15.0, follow_redirects=False)
        if resp.status_code != 200:
            return None

        with Image.open(io.BytesIO(resp.content)) as img:
            h = imagehash.phash(img)
            return int(h)
    except Exception as e:
        print(f"[Embedding] Screenshot pHash failed: {e}")
        return None


def phash_similarity(hash_a: int | None, hash_b: int | None, max_distance: int = 10) -> float:
    """
    Compare two pHash bigints and return a similarity score (0.0-1.0).

    Uses Hamming distance: 0 distance = 1.0, 64 distance = 0.0.
    """
    if hash_a is None or hash_b is None:
        return 0.0

    distance = bin(hash_a ^ hash_b).count("1")
    score = 1.0 - (distance / 64.0)
    matched = distance <= max_distance
    return round(score, 4) if matched else round(max(0.0, score), 4)


def extract_logo_phash_from_url(page_url: str) -> int | None:
    """
    Approach A — extract the logo image from a webpage's HTML and compute
    its pHash.

    Fetches the page HTML, searches for ``<img>`` tags with "logo" in the
    class, alt, src, or id attributes. If found, downloads the logo image
    and computes its pHash.  If no logo is found, returns ``None`` (caller
    should fall back to whole-screenshot pHash).

    This is deterministic, free, and works for most static sites. JS-heavy
    sites that load logos dynamically may not expose the ``<img>`` tag in
    the initial HTML — in those cases the caller falls back to screenshot
    pHash comparison.
    """
    if not page_url:
        return None

    try:
        validate_ssrf_url(page_url)
    except SSRFError as e:
        print(f"[Embedding] Rejected unsafe URL in extract_logo_phash_from_url: {e}")
        return None

    try:
        import re
        import httpx
        from PIL import Image
        import imagehash

        resp = httpx.get(page_url, timeout=10.0, follow_redirects=False,
                         headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})
        if resp.status_code != 200 or not resp.text:
            return None

        html = resp.text

        # Parse <img> tags and look for logo-like attributes
        img_pattern = re.compile(
            r'<img\s+([^>]*?)\s*/?>',
            re.IGNORECASE | re.DOTALL,
        )
        src_pattern = re.compile(r'src=["\']([^"\']+)["\']', re.IGNORECASE)
        attr_patterns = re.compile(
            r'(?:class|alt|id|data-src)\s*=\s*["\']([^"\']*logo[^"\']*)["\']',
            re.IGNORECASE,
        )

        logo_urls = []
        base_url = page_url
        for match in img_pattern.finditer(html):
            tag_attrs = match.group(1)
            # Check if any attribute contains "logo"
            if not attr_patterns.search(tag_attrs):
                continue
            src_match = src_pattern.search(tag_attrs)
            if not src_match:
                continue
            src = src_match.group(1)
            # Resolve relative URLs
            if src.startswith("//"):
                src = "https:" + src
            elif src.startswith("/"):
                from urllib.parse import urlparse
                parsed = urlparse(page_url)
                src = f"{parsed.scheme}://{parsed.netloc}{src}"
            elif not src.startswith("http"):
                # Relative path without leading slash
                from urllib.parse import urlparse
                parsed = urlparse(page_url)
                src = f"{parsed.scheme}://{parsed.netloc}/{src.lstrip('/')}"
            logo_urls.append(src)

        if not logo_urls:
            return None

        # Try the first few logo URLs
        for logo_url in logo_urls[:3]:
            try:
                try:
                    validate_ssrf_url(logo_url)
                except SSRFError as ssrf_e:
                    print(f"[Embedding] Rejected unsafe logo URL: {ssrf_e}")
                    continue
                img_resp = httpx.get(logo_url, timeout=10.0, follow_redirects=False)
                if img_resp.status_code != 200:
                    continue
                with Image.open(io.BytesIO(img_resp.content)) as img:
                    h = imagehash.phash(img)
                    return int(h)
            except Exception:
                continue

        return None
    except Exception as e:
        print(f"[Embedding] Logo extraction from {page_url} failed: {e}")
        return None
