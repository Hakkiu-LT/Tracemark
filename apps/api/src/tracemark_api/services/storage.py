"""
Supabase Storage helpers for persisting evidence screenshots.

Firecrawl returns temporary signed URLs that expire after a few hours.
This module downloads those screenshots and re-uploads them to Supabase
Storage as compressed WebP.

Security (C5): the ``evidence-screenshots`` bucket is PRIVATE. Uploaders store
the BARE STORAGE PATH (e.g. ``marketplace/<uuid>.webp``) in the database, and
readers mint a short-lived signed URL via :func:`sign_screenshot_url` at
serve-time. ``sign_screenshot_url`` also accepts legacy full public URLs, so no
DB backfill is required when the bucket is flipped to private.
"""
from __future__ import annotations

import io
import uuid
import hashlib
import httpx
from tracemark_api.services.database import get_supabase
from tracemark_api.services.ssrf import validate_ssrf_url, SSRFError

BUCKET = "evidence-screenshots"
BRAND_ASSETS_BUCKET = "brand-assets"
WEBP_QUALITY = 85

# Signed-URL TTLs (seconds). Short for in-app viewing, long for emails whose
# links may be opened days after delivery.
SCREENSHOT_SIGN_TTL = 3600           # 1 hour — in-app image rendering
SCREENSHOT_SIGN_TTL_EMAIL = 604800   # 7 days — links embedded in emails


def _compress_to_webp(image_bytes: bytes) -> bytes:
    """
    Convert any image bytes (PNG, JPEG, etc.) to WebP at WEBP_QUALITY.
    Falls back to the original bytes if conversion fails.
    """
    try:
        from PIL import Image
        with Image.open(io.BytesIO(image_bytes)) as img:
            if img.mode not in ("RGB", "RGBA"):
                img = img.convert("RGBA" if img.mode == "P" else "RGB")
            buf = io.BytesIO()
            img.save(buf, format="WEBP", quality=WEBP_QUALITY, method=4)
            return buf.getvalue()
    except Exception as e:
        print(f"[Storage] WebP compression failed, using original: {e}")
        return image_bytes


def _ensure_bucket() -> None:
    sb = get_supabase()
    existing = [b.name for b in sb.storage.list_buckets()]
    if BUCKET not in existing:
        # PRIVATE bucket (C5): evidence screenshots leak tenant data if world
        # readable. Readers mint short-lived signed URLs via sign_screenshot_url.
        sb.storage.create_bucket(BUCKET, options={"public": False})


def upload_screenshot(image_url: str, prefix: str = "meta") -> str | None:
    """
    Download a screenshot from a temporary URL, compress to WebP, and upload
    to Supabase Storage.

    Returns the BARE STORAGE PATH (e.g. ``marketplace/<uuid>.webp``) — the bucket
    is private, so callers must mint a signed URL via :func:`sign_screenshot_url`
    at serve-time. Returns None on failure.
    """
    try:
        validate_ssrf_url(image_url)
    except SSRFError as e:
        print(f"[Storage] Rejected unsafe screenshot URL: {e}")
        return None

    try:
        response = httpx.get(image_url, timeout=20.0, follow_redirects=False)
        if response.status_code != 200:
            return None

        compressed = _compress_to_webp(response.content)
        path = f"{prefix}/{uuid.uuid4()}.webp"

        _ensure_bucket()
        sb = get_supabase()
        sb.storage.from_(BUCKET).upload(
            path,
            compressed,
            {"content-type": "image/webp", "upsert": "true"},
        )

        # Private bucket — store the bare path; sign at serve-time.
        return path
    except Exception as e:
        print(f"[Storage] Failed to upload screenshot: {e}")
        return None


def upload_screenshot_bytes(image_bytes: bytes, prefix: str = "meta") -> str | None:
    """
    Compress raw image bytes to WebP and upload to Supabase Storage.

    Returns the BARE STORAGE PATH (private bucket) or None on failure. Callers
    mint a signed URL via :func:`sign_screenshot_url` at serve-time.
    """
    try:
        compressed = _compress_to_webp(image_bytes)
        path = f"{prefix}/{uuid.uuid4()}.webp"

        _ensure_bucket()
        sb = get_supabase()
        sb.storage.from_(BUCKET).upload(
            path,
            compressed,
            {"content-type": "image/webp", "upsert": "true"},
        )

        # Private bucket — store the bare path; sign at serve-time.
        return path
    except Exception as e:
        print(f"[Storage] Failed to upload screenshot bytes: {e}")
        return None


def _extract_screenshot_path(stored: str) -> str:
    """Resolve a stored screenshot reference to a bucket-relative path.

    Handles all three shapes seen in the DB:
      * bare path (new)           → ``marketplace/x.webp``
      * legacy full public URL    → ``.../evidence-screenshots/marketplace/x.webp``
      * foreign / mock http URL   → returned unchanged (caller must special-case)
    """
    marker = "/evidence-screenshots/"
    idx = stored.find(marker)
    if idx != -1:
        return stored[idx + len(marker):]
    return stored


def sign_screenshot_url(stored: str | None, ttl: int = SCREENSHOT_SIGN_TTL) -> str | None:
    """Return a short-lived signed URL for a stored evidence-screenshot reference.

    Backward-compatible with BOTH new bare paths and legacy full public URLs, so
    no data backfill is needed when the bucket is flipped to private:
      * falsy               → None
      * contains the bucket marker → sign the path after ``/evidence-screenshots/``
      * else starts with ``http`` → foreign/mock URL (e.g. placehold.co) → return as-is
      * else                → treat the whole value as a bare path and sign it

    Mirrors :func:`get_brand_asset_url` (dict handling + defensive try/except).
    """
    if not stored:
        return None
    if "/evidence-screenshots/" not in stored and stored.startswith("http"):
        # Foreign/mock URL that never lived in our bucket — nothing to sign.
        return stored
    path = _extract_screenshot_path(stored)
    if not path:
        return stored
    try:
        sb = get_supabase()
        res = sb.storage.from_(BUCKET).create_signed_url(path, expires_in=ttl)
        signed = res.get("signedURL", "") if isinstance(res, dict) else ""
        return signed or None
    except Exception as e:
        print(f"[Storage] Failed to sign screenshot url: {e}")
        return None


def sign_screenshot_url_long(stored: str | None) -> str | None:
    """7-day signed-URL variant for EMAIL contexts (a 1h URL would 403 in an inbox)."""
    return sign_screenshot_url(stored, ttl=SCREENSHOT_SIGN_TTL_EMAIL)


def resolve_screenshot_fetch_url(stored: str | None) -> str | None:
    """Resolve a stored reference to a URL the BACKEND can fetch (AI vision, pHash).

    Same logic as :func:`sign_screenshot_url` but named for internal pipeline use:
    a bare path must be signed before ``httpx.get`` can download it.
    """
    return sign_screenshot_url(stored, ttl=SCREENSHOT_SIGN_TTL)


def _ensure_brand_assets_bucket() -> None:
    sb = get_supabase()
    existing = [b.name for b in sb.storage.list_buckets()]
    if BRAND_ASSETS_BUCKET not in existing:
        sb.storage.create_bucket(BRAND_ASSETS_BUCKET, options={"public": False})


def upload_brand_asset(
    file_bytes: bytes,
    content_type: str,
    brand_id: str,
    asset_type: str,
) -> str | None:
    """
    Upload a brand reference asset (logo, reference content, product image)
    to the private brand-assets bucket.

    Returns the Supabase storage path (not a public URL — the bucket is private).
    """
    try:
        _ensure_brand_assets_bucket()
        ext = "webp" if content_type.startswith("image/") else "txt"
        if content_type == "application/pdf":
            ext = "pdf"
        path = f"{brand_id}/{asset_type}/{uuid.uuid4()}.{ext}"

        sb = get_supabase()
        sb.storage.from_(BRAND_ASSETS_BUCKET).upload(
            path,
            file_bytes,
            {"content-type": content_type, "upsert": "true"},
        )
        return path
    except Exception as e:
        print(f"[Storage] Failed to upload brand asset: {e}")
        return None


def compute_phash(image_bytes: bytes) -> int | None:
    """
    Compute the 64-bit perceptual hash (pHash) of an image and return it
    as a bigint suitable for storage in the ``brand_assets.phash`` column.

    Returns None if the image cannot be parsed.
    """
    try:
        from PIL import Image
        import imagehash
        with Image.open(io.BytesIO(image_bytes)) as img:
            h = imagehash.phash(img)
            return int(h)
    except Exception as e:
        print(f"[Storage] pHash computation failed: {e}")
        return None


def compute_content_hash(content: bytes | str) -> str:
    """Return the SHA-256 hex digest of the given content."""
    if isinstance(content, str):
        content = content.encode("utf-8")
    return hashlib.sha256(content).hexdigest()


def get_brand_asset_url(storage_path: str) -> str:
    """Return a signed URL for a private brand-assets path."""
    sb = get_supabase()
    res = sb.storage.from_(BRAND_ASSETS_BUCKET).create_signed_url(storage_path, expires_in=3600)
    return res.get("signedURL", "") if isinstance(res, dict) else ""


def cleanup_old_cases() -> None:
    """
    Find completed cases older than 100 days, delete their evidence screenshots
    from Supabase Storage, and nullify/clear their heavy data in the database.
    """
    try:
        import datetime
        from tracemark_api.services.database import get_supabase
        sb = get_supabase()

        cutoff = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=100)).isoformat()

        res = (
            sb.table("cases")
            .select("id")
            .in_("status", ["complete", "completed", "resolved"])
            .lt("updated_at", cutoff)
            .execute()
        )

        if not res.data:
            print("[Cleanup] No old completed cases found for cleanup.")
            return

        case_ids = [row["id"] for row in res.data]
        print(f"[Cleanup] Found {len(case_ids)} completed cases older than 100 days to clean up: {case_ids}")

        for case_id in case_ids:
            ev_res = sb.table("evidence").select("marketplaces, ads, domains, social").eq("case_id", case_id).execute()
            urls_to_delete = set()
            if ev_res.data:
                for row in ev_res.data:
                    for cat in ["marketplaces", "ads", "domains", "social"]:
                        items = row.get(cat) or []
                        if isinstance(items, list):
                            for item in items:
                                if isinstance(item, dict) and item.get("screenshot_url"):
                                    urls_to_delete.add(item["screenshot_url"])

            inf_res = sb.table("infringements").select("screenshot_url").eq("case_id", case_id).execute()
            if inf_res.data:
                for row in inf_res.data:
                    if row.get("screenshot_url"):
                        urls_to_delete.add(row["screenshot_url"])

            paths_to_delete = []
            marker = "/evidence-screenshots/"
            for url in urls_to_delete:
                idx = url.find(marker)
                if idx != -1:
                    # Legacy full URL → path after the bucket marker.
                    path = url[idx + len(marker):]
                elif url.startswith("http"):
                    # Foreign/mock URL that never lived in our bucket — skip.
                    continue
                else:
                    # New bare path stored directly.
                    path = url
                if path:
                    paths_to_delete.append(path)

            if paths_to_delete:
                try:
                    sb.storage.from_("evidence-screenshots").remove(paths_to_delete)
                    print(f"[Cleanup] Deleted {len(paths_to_delete)} screenshots from storage for case {case_id}")
                except Exception as storage_err:
                    print(f"[Cleanup] Error deleting screenshots from storage for case {case_id}: {storage_err}")

            sb.table("evidence").delete().eq("case_id", case_id).execute()
            sb.table("infringements").update({"screenshot_url": None}).eq("case_id", case_id).execute()

            print(f"[Cleanup] Successfully cleaned up heavy information for case {case_id}")

    except Exception as e:
        print(f"[Cleanup] Error during automatic 100-day cleanup: {e}")
