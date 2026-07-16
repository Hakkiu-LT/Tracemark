"""Monitored brands ("marks") CRUD, with plan-limit enforcement.

Brands are the unit that plan tiers cap ("1 brand", "5 brands", "20 brands").
Persisting them here — instead of only in the browser's Zustand store — gives
the server an authoritative count so ``POST /brands`` can refuse to create more
than the caller's entitlement allows (base plan + ``addon_brand`` quantity).

Slot accounting: ``active`` and ``on_hold`` brands consume a slot; ``locked``
brands (the excess frozen by a downgrade) do not — see services/entitlements.py
and the reconcile step in routes/billing.py.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Literal

from tracemark_api.dependencies import CurrentProfile, get_current_profile
from tracemark_api.services.database import get_supabase
from tracemark_api.services.storage import (
    upload_brand_asset,
    compute_phash,
    compute_content_hash,
    get_brand_asset_url,
)

router = APIRouter(prefix="/brands", tags=["brands"])

# Statuses that occupy a plan slot (locked = excess, doesn't count).
_SLOT_STATUSES = ("active", "on_hold")


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


def _count_active_brands(org_id: str) -> int:
    """How many brands currently occupy a plan slot for this org."""
    sb = get_supabase()
    res = (
        sb.table("brands")
        .select("id", count="exact")
        .eq("organization_id", org_id)
        .in_("status", list(_SLOT_STATUSES))
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
    """All brands for the caller's org, plus current usage vs. the plan limit."""
    sb = get_supabase()
    res = (
        sb.table("brands")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .order("created_at", desc=True)
        .execute()
    )
    brands = res.data or []
    limit = profile.entitlements.brands
    used = sum(1 for b in brands if b.get("status") in _SLOT_STATUSES)
    return {
        "brands": brands,
        "usage": {"used": used, "limit": limit},
    }


@router.post("")
def create_brand(
    body: BrandCreate, profile: CurrentProfile = Depends(get_current_profile)
):
    ent = profile.entitlements
    used = _count_active_brands(profile.organization_id)
    if ent.brand_limit_reached(used):
        raise HTTPException(
            status_code=402,
            detail=(
                f"Your {profile.plan} plan includes {ent.brands} "
                f"brand{'s' if (ent.brands or 0) != 1 else ''}. "
                "Add the 'Extra brands' add-on or upgrade your plan to monitor more."
            ),
        )

    sb = get_supabase()
    payload = {
        "organization_id": profile.organization_id,
        "user_id": profile.id,
        "client_id": body.client_id,
        "brand_name": body.brand_name,
        "website": body.website,
        "registration_number": body.registration_number,
        "platforms": body.platforms,
        "target_regions": body.target_regions,
        "logo_color": body.logo_color,
        "official_domains": body.official_domains,
        "official_advertisers": body.official_advertisers,
        "status": "active",
    }
    res = sb.table("brands").insert(payload).execute()
    created = (res.data or [None])[0]
    return created


@router.patch("/{brand_id}")
def update_brand(
    brand_id: str,
    body: BrandUpdate,
    profile: CurrentProfile = Depends(get_current_profile),
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
        if body.status not in ("active", "locked", "on_hold"):
            raise HTTPException(status_code=400, detail=f"Invalid status '{body.status}'")
        # Re-activating a locked brand must respect the current plan limit.
        if body.status == "active" and existing.get("status") == "locked":
            ent = profile.entitlements
            if ent.brand_limit_reached(_count_active_brands(profile.organization_id)):
                raise HTTPException(
                    status_code=402,
                    detail=(
                        f"Your {profile.plan} plan is at its brand limit "
                        f"({ent.brands}). Upgrade or remove a brand to unlock this one."
                    ),
                )
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
    brand_id: str, profile: CurrentProfile = Depends(get_current_profile)
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
    profile: CurrentProfile = Depends(get_current_profile),
):
    """
    Force-refresh the auto-generated reference content for a brand.

    Fetches the official websites (from ``brands.official_domains`` or
    ``brands.website``), strips HTML, embeds the text with the Gemini
    Embedding API, and stores the result. Bypasses the 30-day cache.
    """
    from tracemark_api.services.embedding_helper import ensure_official_site_reference
    from tracemark_api.services.database import get_supabase
    from datetime import datetime, timezone

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
    profile: CurrentProfile = Depends(get_current_profile),
):
    """Upload a brand reference asset (logo, reference content, or product image).

    For images (logo, product_image), a perceptual hash (pHash) is computed
    at upload time for fast visual similarity comparison in Tier 1.
    A SHA-256 content hash is always computed for dedup.
    """
    _brand_or_404(profile.organization_id, brand_id)

    file_bytes = file.file.read()
    content_type = file.content_type or "application/octet-stream"

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
    profile: CurrentProfile = Depends(get_current_profile),
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
