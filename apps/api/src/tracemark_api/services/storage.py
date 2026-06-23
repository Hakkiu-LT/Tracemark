"""
Supabase Storage helpers for persisting evidence screenshots.

Firecrawl returns temporary signed URLs that expire after a few hours.
This module downloads those screenshots and re-uploads them to Supabase
Storage as compressed WebP, returning a permanent public URL.
"""
from __future__ import annotations

import io
import uuid
import httpx
from tracemark_api.services.database import get_supabase

BUCKET = "evidence-screenshots"
WEBP_QUALITY = 85


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
        sb.storage.create_bucket(BUCKET, options={"public": True})


def upload_screenshot(image_url: str, prefix: str = "meta") -> str | None:
    """
    Download a screenshot from a temporary URL, compress to WebP, and upload
    to Supabase Storage. Returns a permanent public URL, or None on failure.
    """
    try:
        response = httpx.get(image_url, timeout=20.0, follow_redirects=True)
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

        return sb.storage.from_(BUCKET).get_public_url(path)
    except Exception as e:
        print(f"[Storage] Failed to upload screenshot: {e}")
        return None


def upload_screenshot_bytes(image_bytes: bytes, prefix: str = "meta") -> str | None:
    """
    Compress raw image bytes to WebP and upload to Supabase Storage.
    Returns a permanent public URL, or None on failure.
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

        return sb.storage.from_(BUCKET).get_public_url(path)
    except Exception as e:
        print(f"[Storage] Failed to upload screenshot bytes: {e}")
        return None
