"""
Supabase Storage helpers for persisting evidence screenshots.

Firecrawl returns temporary signed URLs that expire after a few hours.
This module downloads those screenshots and re-uploads them to Supabase
Storage, returning a permanent public URL.
"""
from __future__ import annotations

import uuid
import httpx
from tracemark_api.services.database import get_supabase

BUCKET = "evidence-screenshots"


def _ensure_bucket() -> None:
    sb = get_supabase()
    existing = [b.name for b in sb.storage.list_buckets()]
    if BUCKET not in existing:
        sb.storage.create_bucket(BUCKET, options={"public": True})


def upload_screenshot(image_url: str, prefix: str = "meta") -> str | None:
    """
    Download a screenshot from a temporary URL and upload it to Supabase Storage.
    Returns a permanent public URL, or None if anything fails.
    """
    try:
        response = httpx.get(image_url, timeout=20.0, follow_redirects=True)
        if response.status_code != 200:
            return None

        content_type = response.headers.get("content-type", "image/png")
        ext = "jpg" if "jpeg" in content_type else "png"
        path = f"{prefix}/{uuid.uuid4()}.{ext}"

        _ensure_bucket()
        sb = get_supabase()
        sb.storage.from_(BUCKET).upload(
            path,
            response.content,
            {"content-type": content_type, "upsert": "true"},
        )

        public_url = sb.storage.from_(BUCKET).get_public_url(path)
        return public_url
    except Exception as e:
        print(f"[Storage] Failed to upload screenshot: {e}")
        return None
