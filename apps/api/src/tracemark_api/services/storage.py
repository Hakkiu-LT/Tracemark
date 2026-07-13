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


def cleanup_old_cases() -> None:
    """
    Find completed cases older than 100 days, delete their evidence screenshots
    from Supabase Storage, and nullify/clear their heavy data in the database.
    """
    try:
        import datetime
        from tracemark_api.services.database import get_supabase

        sb = get_supabase()

        # 100 days ago
        cutoff = (
            datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=100)
        ).isoformat()

        # Get cases that are completed (complete or resolved) and older than 100 days
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
        print(
            f"[Cleanup] Found {len(case_ids)} completed cases older than 100 days to clean up: {case_ids}"
        )

        for case_id in case_ids:
            # 1. Fetch all screenshot URLs from evidence table for this case
            ev_res = (
                sb.table("evidence")
                .select("marketplaces, ads, domains, social")
                .eq("case_id", case_id)
                .execute()
            )
            urls_to_delete = set()
            if ev_res.data:
                for row in ev_res.data:
                    for cat in ["marketplaces", "ads", "domains", "social"]:
                        items = row.get(cat) or []
                        if isinstance(items, list):
                            for item in items:
                                if isinstance(item, dict) and item.get(
                                    "screenshot_url"
                                ):
                                    urls_to_delete.add(item["screenshot_url"])

            # 2. Fetch screenshots from infringements table for this case
            inf_res = (
                sb.table("infringements")
                .select("screenshot_url")
                .eq("case_id", case_id)
                .execute()
            )
            if inf_res.data:
                for row in inf_res.data:
                    if row.get("screenshot_url"):
                        urls_to_delete.add(row["screenshot_url"])

            # 3. Parse relative paths for Supabase Storage
            paths_to_delete = []
            marker = "/evidence-screenshots/"
            for url in urls_to_delete:
                idx = url.find(marker)
                if idx != -1:
                    path = url[idx + len(marker) :]
                    if path:
                        paths_to_delete.append(path)

            # 4. Remove from storage
            if paths_to_delete:
                try:
                    sb.storage.from_("evidence-screenshots").remove(paths_to_delete)
                    print(
                        f"[Cleanup] Deleted {len(paths_to_delete)} screenshots from storage for case {case_id}"
                    )
                except Exception as storage_err:
                    print(
                        f"[Cleanup] Error deleting screenshots from storage for case {case_id}: {storage_err}"
                    )

            # 5. Delete heavy evidence logs from database
            sb.table("evidence").delete().eq("case_id", case_id).execute()

            # 6. Nullify screenshot_url in infringements table for this case
            sb.table("infringements").update({"screenshot_url": None}).eq(
                "case_id", case_id
            ).execute()

            print(
                f"[Cleanup] Successfully cleaned up heavy information for case {case_id}"
            )

    except Exception as e:
        print(f"[Cleanup] Error during automatic 100-day cleanup: {e}")
