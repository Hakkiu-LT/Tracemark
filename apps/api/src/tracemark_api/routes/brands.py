"""Monitored brands ("marks") CRUD.

Brands are persisted server-side (not only in the browser's Zustand store) so the
API is the authoritative source. Every logged-in user can create and monitor an
unlimited number of brands — there are no plan limits.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from tracemark_api.dependencies import (
    CurrentProfile,
    get_current_profile,
    require_owner,
)
from tracemark_api.services.database import get_supabase
from tracemark_api.services.storage import (
    compute_content_hash,
    compute_phash,
    upload_brand_asset,
)

router = APIRouter(prefix="/brands", tags=["brands"])


def _send_welcome_email(profile) -> None:
    """Fire-and-forget welcome email when an org adds their first brand."""
    try:
        import os

        from tracemark_api.services.email import send_email
        from tracemark_api.services.email_templates import welcome_html
        from tracemark_api.services.notifications import _recipient_for_org

        recipient = _recipient_for_org(profile.organization_id)
        if not recipient:
            return
        full_name = getattr(profile, "full_name", "") or ""
        user_name = full_name.split()[0] if full_name.strip() else "there"
        app_url = os.environ.get("CUSTOMER_APP_URL", "https://hakkiu.com").rstrip("/")
        html = welcome_html(user_name=user_name, dashboard_url=app_url + "/dashboard")
        subject = "Welcome to HAKKIU — your monitoring is setting up"
        ok = send_email(to=recipient, subject=subject, html=html)
        try:
            from tracemark_api.services.delivery_log import log_delivery
            log_delivery(
                "welcome",
                ok=ok,
                organization_id=profile.organization_id,
                recipient=recipient,
                subject=subject,
                body_html=html,
            )
        except Exception:
            pass
    except Exception as exc:
        print(f"[Brands] Failed to send welcome email: {exc}")


class BrandCreate(BaseModel):
    brand_name: str
    website: str | None = None
    registration_number: str | None = None
    platforms: list[str] = []
    target_regions: list[str] = []
    logo_color: str | None = None
    client_id: str | None = None
    official_domains: list[str] = []
    official_advertisers: list[str] = []


class BrandUpdate(BaseModel):
    brand_name: str | None = None
    website: str | None = None
    registration_number: str | None = None
    platforms: list[str] | None = None
    target_regions: list[str] | None = None
    logo_color: str | None = None
    status: str | None = None
    official_domains: list[str] | None = None
    official_advertisers: list[str] | None = None


def _count_brands(org_id: str) -> int:
    """How many brands this org currently has (used only to detect the first
    brand so we send the welcome email once)."""
    sb = get_supabase()
    res = (
        sb.table("brands")
        .select("id", count="exact")
        .eq("organization_id", org_id)
        .execute()
    )
    if getattr(res, "count", None) is not None:
        return res.count
    return len(res.data or [])


def _brand_or_404(org_id: str, brand_id: str) -> dict:
    sb = get_supabase()
    res = (
        sb.table("brands")
        .select("*")
        .eq("id", brand_id)
        .eq("organization_id", org_id)
        .maybe_single()
        .execute()
    )
    row = res.data if res else None
    if not row:
        raise HTTPException(status_code=404, detail="Brand not found")
    return row


@router.get("")
def list_brands(profile: CurrentProfile = Depends(get_current_profile)):
    """All brands for the caller's org. There is no plan limit — usage is the
    total brand count and the limit is unlimited (``null``)."""
    sb = get_supabase()
    res = (
        sb.table("brands")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .order("created_at", desc=True)
        .execute()
    )
    brands = res.data or []
    return {
        "brands": brands,
        "usage": {"used": len(brands), "limit": None},
    }


@router.post("")
def create_brand(
    body: BrandCreate, profile: CurrentProfile = Depends(require_owner)
):
    used = _count_brands(profile.organization_id)

    sb = get_supabase()
    # Route through the SECURITY DEFINER create_brand_checked RPC: it takes a per-org
    # advisory lock, enforces org_entitlement_overrides.brands_limit atomically, then inserts.
    # This is the SINGLE brand-create path shared with the admin portal, so the cap can't be
    # bypassed from either side. NULL / -1 limit = unlimited.
    try:
        res = sb.rpc(
            "create_brand_checked",
            {
                "p_organization_id": profile.organization_id,
                "p_user_id": profile.id,
                "p_brand_name": body.brand_name,
                "p_website": body.website,
                "p_registration_number": body.registration_number,
                "p_platforms": body.platforms,
                "p_target_regions": body.target_regions,
                "p_logo_color": body.logo_color,
                "p_official_domains": body.official_domains,
                "p_official_advertisers": body.official_advertisers,
                "p_client_id": body.client_id,
            },
        ).execute()
    except Exception as exc:  # noqa: BLE001
        if "BRAND_LIMIT_REACHED" in str(exc):
            raise HTTPException(
                status_code=403,
                detail="Brand limit reached for this organization. Contact HAKKIU to raise it.",
            )
        raise HTTPException(status_code=400, detail=f"Could not create brand: {exc}")

    created = res.data[0] if isinstance(res.data, list) else res.data

    # Send welcome email only for the first brand the org creates
    if used == 0:
        _send_welcome_email(profile)

    return created


@router.patch("/{brand_id}")
def update_brand(
    brand_id: str,
    body: BrandUpdate,
    profile: CurrentProfile = Depends(require_owner),
):
    existing = _brand_or_404(profile.organization_id, brand_id)

    updates: dict = {}
    for field in (
        "brand_name",
        "website",
        "registration_number",
        "platforms",
        "target_regions",
        "logo_color",
        "official_domains",
        "official_advertisers",
    ):
        val = getattr(body, field)
        if val is not None:
            updates[field] = val

    if body.status is not None:
        if body.status != "active":
            raise HTTPException(status_code=400, detail=f"Invalid status '{body.status}'")
        updates["status"] = body.status

    if not updates:
        return existing

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    sb = get_supabase()
    res = (
        sb.table("brands")
        .update(updates)
        .eq("id", brand_id)
        .eq("organization_id", profile.organization_id)
        .execute()
    )
    return (res.data or [existing])[0]


@router.delete("/{brand_id}")
def delete_brand(
    brand_id: str, profile: CurrentProfile = Depends(require_owner)
):
    _brand_or_404(profile.organization_id, brand_id)
    sb = get_supabase()
    sb.table("brands").delete().eq("id", brand_id).eq(
        "organization_id", profile.organization_id
    ).execute()
    return {"deleted": True, "id": brand_id}


# ── Brand reference assets (logos, reference content, product images) ────────

class BrandAssetResponse(BaseModel):
    id: str
    brand_id: str
    asset_type: str
    file_url: str | None
    content_hash: str | None
    phash: int | None
    metadata: dict | None
    created_at: str


@router.get("/{brand_id}/assets", response_model=list[BrandAssetResponse])
def list_brand_assets(
    brand_id: str,
    profile: CurrentProfile = Depends(get_current_profile),
):
    """List all reference assets for a brand."""
    _brand_or_404(profile.organization_id, brand_id)
    sb = get_supabase()
    res = (
        sb.table("brand_assets")
        .select("*")
        .eq("brand_id", brand_id)
        .order("created_at", desc=True)
        .execute()
    )
    return res.data or []


@router.post("/{brand_id}/reference-content/refresh")
def refresh_reference_content(
    brand_id: str,
    profile: CurrentProfile = Depends(require_owner),
):
    """
    Force-refresh the auto-generated reference content for a brand.

    Fetches the official websites (from ``brands.official_domains`` or
    ``brands.website``), strips HTML, embeds the text with the Gemini
    Embedding API, and stores the result. Bypasses the 30-day cache.
    """

    from tracemark_api.services.database import get_supabase
    from tracemark_api.services.embedding_helper import ensure_official_site_reference

    _brand_or_404(profile.organization_id, brand_id)

    sb = get_supabase()
    try:
        sb.table("brand_assets").delete().eq("brand_id", brand_id).eq("asset_type", "reference_content").execute()
    except Exception as e:
        print(f"[Brands] Failed to clear old auto-ref: {e}")

    ensure_official_site_reference(brand_id)

    res = (
        sb.table("brand_assets")
        .select("id, file_url, metadata, created_at")
        .eq("brand_id", brand_id)
        .eq("asset_type", "reference_content")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    latest = res.data[0] if res.data else None
    if not latest:
        return {"refreshed": False, "message": "No official website configured or fetch failed."}
    meta = latest.get("metadata") or {}
    return {
        "refreshed": True,
        "source_urls": meta.get("source_urls", []),
        "last_fetched": meta.get("last_fetched"),
        "text_length": meta.get("text_length", 0),
    }


@router.post("/{brand_id}/assets", response_model=BrandAssetResponse)
def upload_brand_asset_endpoint(
    brand_id: str,
    asset_type: Literal["logo", "reference_content", "product_image"] = Form(...),
    file: UploadFile = File(...),
    profile: CurrentProfile = Depends(require_owner),
):
    """Upload a brand reference asset (logo, reference content, or product image).

    For images (logo, product_image), a perceptual hash (pHash) is computed
    at upload time for fast visual similarity comparison in Tier 1.
    A SHA-256 content hash is always computed for dedup.
    """
    _brand_or_404(profile.organization_id, brand_id)

    _ALLOWED_MIMES = {
        "image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml",
        "text/plain", "text/csv", "text/html", "application/pdf",
    }
    content_type = (file.content_type or "application/octet-stream").split(";")[0].strip().lower()
    if content_type not in _ALLOWED_MIMES:
        raise HTTPException(status_code=400, detail=f"File type '{content_type}' is not allowed")

    _MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
    file_bytes = file.file.read(_MAX_UPLOAD_BYTES + 1)
    if len(file_bytes) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds 10 MB limit")

    storage_path = upload_brand_asset(file_bytes, content_type, brand_id, asset_type)
    if not storage_path:
        raise HTTPException(status_code=500, detail="Failed to upload asset to storage")

    phash_val = None
    if asset_type in ("logo", "product_image") and content_type.startswith("image/"):
        phash_val = compute_phash(file_bytes)

    chash = compute_content_hash(file_bytes)

    embedding_val = None
    if asset_type == "reference_content" and content_type.startswith("text/"):
        try:
            from tracemark_api.services.embedding_helper import embed_text
            text_content = file_bytes.decode("utf-8", errors="replace")
            embedding_val = embed_text(text_content)
        except Exception as e:
            print(f"[brands] Reference content embedding failed: {e}")

    sb = get_supabase()
    insert_payload: dict = {
        "brand_id": brand_id,
        "asset_type": asset_type,
        "file_url": storage_path,
        "content_hash": chash,
        "phash": phash_val,
        "metadata": {"filename": file.filename, "content_type": content_type},
    }
    if embedding_val is not None:
        insert_payload["embedding"] = str(embedding_val)

    res = (
        sb.table("brand_assets")
        .insert(insert_payload)
        .execute()
    )
    return res.data[0]


@router.delete("/{brand_id}/assets/{asset_id}")
def delete_brand_asset(
    brand_id: str,
    asset_id: str,
    profile: CurrentProfile = Depends(require_owner),
):
    """Delete a brand reference asset and its file from storage."""
    _brand_or_404(profile.organization_id, brand_id)
    sb = get_supabase()
    res = (
        sb.table("brand_assets")
        .select("file_url")
        .eq("id", asset_id)
        .eq("brand_id", brand_id)
        .maybe_single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Asset not found")

    storage_path = res.data.get("file_url")
    if storage_path:
        try:
            from tracemark_api.services.storage import BRAND_ASSETS_BUCKET
            sb.storage.from_(BRAND_ASSETS_BUCKET).remove([storage_path])
        except Exception as e:
            print(f"[brands] Failed to delete asset from storage: {e}")

    sb.table("brand_assets").delete().eq("id", asset_id).execute()
    return {"deleted": True, "id": asset_id}
