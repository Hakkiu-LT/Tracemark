"""Monitored brands ("marks") CRUD.

Brands are persisted server-side (not only in the browser's Zustand store) so the
API is the authoritative source. A brand is exactly what the UI calls a "monitored
asset". Plan limits are enforced across THREE dimensions (all NULL/-1 = unlimited):
  * ``brands_limit``              — org-total number of brands,
  * ``regions_per_brand_limit``  — max target regions selectable per brand,
  * ``platforms_per_brand_limit``— max marketplaces/platforms selectable per brand.
Creation is enforced atomically inside the ``create_brand_checked`` RPC; edits are
checked here (array-length caps are self-contained, so no advisory lock is needed).
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
    status: str | None = "active"


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


def _norm_limit(raw) -> int | None:
    """None / -1 (the unlimited sentinels) → None; any real >= 0 cap passes through."""
    return None if raw in (None, -1) else raw


def _clean_list(raw) -> list[str] | None:
    """Normalise a stored allow-list: None or empty [] → None (unrestricted); else the list."""
    if not raw:
        return None
    return list(raw)


def _org_limits(org_id: str) -> dict:
    """Plan limits for an org, normalised so None means unrestricted on every axis.

    Reads the (service-role only) org_entitlement_overrides row. A missing row = a
    company with no overrides = unrestricted everywhere. Marketplaces/regions are
    WHITELISTS of allowed values (not counts); ``None`` = all allowed.
    """
    sb = get_supabase()
    row = (
        sb.table("org_entitlement_overrides")
        .select("brands_limit, allowed_platforms, allowed_regions")
        .eq("organization_id", org_id)
        .maybe_single()
        .execute()
    )
    data = (row.data if row else None) or {}
    return {
        "brands": _norm_limit(data.get("brands_limit")),
        "allowed_platforms": _clean_list(data.get("allowed_platforms")),
        "allowed_regions": _clean_list(data.get("allowed_regions")),
    }


def _enforce_allowed_lists(limits: dict, platforms, target_regions) -> None:
    """Raise 403 if a brand selects a marketplace/region outside the plan's whitelist.

    Used on EDIT (create goes through the RPC, which enforces the same whitelists atomically).
    A None whitelist = unrestricted. Only the values actually provided are checked.
    """
    allowed_p = limits.get("allowed_platforms")
    allowed_r = limits.get("allowed_regions")
    if allowed_p and platforms is not None:
        extra = [p for p in platforms if p not in set(allowed_p)]
        if extra:
            raise HTTPException(
                status_code=403,
                detail="Your plan doesn't include these marketplace(s): "
                + ", ".join(extra) + ". Contact HAKKIU to change your plan.",
            )
    if allowed_r and target_regions is not None:
        extra = [r for r in target_regions if r not in set(allowed_r)]
        if extra:
            raise HTTPException(
                status_code=403,
                detail="Your plan doesn't include these region(s): "
                + ", ".join(extra) + ". Contact HAKKIU to change your plan.",
            )


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
    """All brands for the caller's org, plus the org's plan limits so the customer UI
    can reflect usage and cap the pickers.

    ``usage.limit`` mirrors the org-total brand cap (``None`` = unlimited). ``limits``
    carries the brand cap plus the marketplace/region WHITELISTS so the "Add monitored
    asset" form can show ONLY the options the plan allows (``None`` = all allowed)."""
    sb = get_supabase()
    res = (
        sb.table("brands")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .order("created_at", desc=True)
        .execute()
    )
    brands = res.data or []
    limits = _org_limits(profile.organization_id)

    brand_ids = [b["id"] for b in brands if b.get("id")]
    if brand_ids:
        try:
            assets_res = (
                sb.table("brand_assets")
                .select("brand_id, file_url")
                .in_("brand_id", brand_ids)
                .eq("asset_type", "logo")
                .order("created_at", desc=True)
                .execute()
            )
            if assets_res.data:
                logo_map = {}
                from tracemark_api.services.storage import get_brand_asset_url
                for row in assets_res.data:
                    bid = row.get("brand_id")
                    f_url = row.get("file_url")
                    if bid and bid not in logo_map and f_url:
                        logo_map[bid] = get_brand_asset_url(f_url) if not f_url.startswith("http") else f_url
                for b in brands:
                    b["logo_url"] = logo_map.get(b["id"])
        except Exception as exc:
            print(f"[Brands] Failed to resolve logo_urls: {exc}")

    return {
        "brands": brands,
        "usage": {"used": len(brands), "limit": limits["brands"]},
        "limits": limits,
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
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        msg = str(exc)
        if "BRAND_LIMIT_REACHED" in msg:
            raise HTTPException(
                status_code=403,
                detail="Brand limit reached for this organization. Contact HAKKIU to raise it.",
            )
        if "REGION_NOT_ALLOWED" in msg:
            raise HTTPException(
                status_code=403,
                detail="This brand targets a region your plan doesn't include. Contact HAKKIU to change your plan.",
            )
        if "PLATFORM_NOT_ALLOWED" in msg:
            raise HTTPException(
                status_code=403,
                detail="This brand targets a marketplace your plan doesn't include. Contact HAKKIU to change your plan.",
            )
        # Same org, same brand name — a double-submitted "Add asset" form, a retried request,
        # or the customer filling the form in again. The RPC raises BRAND_NAME_TAKEN from
        # inside its per-org advisory lock; brands_org_name_unique is the backstop if any
        # future write path skips the RPC. 409 Conflict, with a message the UI can show as-is.
        if "BRAND_NAME_TAKEN" in msg or "brands_org_name_unique" in msg:
            raise HTTPException(
                status_code=409,
                detail="You're already monitoring a brand with that name. Open the existing one to edit it.",
            )
        raise HTTPException(status_code=400, detail=f"Could not create brand: {exc}")

    created = res.data[0] if isinstance(res.data, list) else res.data

    if body.status and body.status != "active":
        if body.status not in ("on_hold", "locked"):
            raise HTTPException(status_code=400, detail=f"Invalid status '{body.status}'")
        res_update = (
            sb.table("brands")
            .update({"status": body.status})
            .eq("id", created["id"])
            .execute()
        )
        if res_update.data:
            created = res_update.data[0]

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

    # Editing a brand can change its platform/region set — enforce the same whitelists the
    # create RPC uses, so a customer can't slip in a disallowed marketplace/region via edit.
    _enforce_allowed_lists(
        _org_limits(profile.organization_id), body.platforms, body.target_regions
    )

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

    sb = get_supabase()

    # Renaming a brand onto another brand's name is the same duplicate the create path
    # guards against, reached from the edit dialog. brands_org_name_unique would reject it
    # anyway; checking first turns a raw constraint violation into a readable 409. The name
    # is trimmed to match what that index compares on (lower(btrim(brand_name))).
    if "brand_name" in updates:
        updates["brand_name"] = (updates["brand_name"] or "").strip()
        if not updates["brand_name"]:
            raise HTTPException(status_code=400, detail="Brand name is required.")
        wanted = updates["brand_name"].casefold()
        siblings = (
            sb.table("brands")
            .select("id, brand_name")
            .eq("organization_id", profile.organization_id)
            .neq("id", brand_id)
            .execute()
        ).data or []
        if any((r.get("brand_name") or "").strip().casefold() == wanted for r in siblings):
            raise HTTPException(
                status_code=409,
                detail="You're already monitoring a brand with that name. Open the existing one to edit it.",
            )

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    try:
        res = (
            sb.table("brands")
            .update(updates)
            .eq("id", brand_id)
            .eq("organization_id", profile.organization_id)
            .execute()
        )
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        # Lost a race against a concurrent create/rename between the check above and here.
        if "brands_org_name_unique" in str(exc):
            raise HTTPException(
                status_code=409,
                detail="You're already monitoring a brand with that name. Open the existing one to edit it.",
            )
        raise
    return (res.data or [existing])[0]


@router.delete("/{brand_id}")
def delete_brand(
    brand_id: str, profile: CurrentProfile = Depends(require_owner)
):
    brand = _brand_or_404(profile.organization_id, brand_id)
    sb = get_supabase()
    brand_name = brand.get("brand_name", "")
    org_id = profile.organization_id

    # 1. Clean up associated cases & evidence screenshots
    if brand_name and org_id:
        try:
            cases_res = (
                sb.table("cases")
                .select("id")
                .eq("organization_id", org_id)
                .ilike("brand_name", brand_name)
                .execute()
            )
            if cases_res.data:
                for c in cases_res.data:
                    cid = c["id"]
                    try:
                        ev_res = sb.table("evidence").select("marketplaces, ads, domains, social").eq("case_id", cid).execute()
                        urls_to_delete = set()
                        if ev_res.data:
                            for row in ev_res.data:
                                for cat in ["marketplaces", "ads", "domains", "social"]:
                                    items = row.get(cat) or []
                                    if isinstance(items, list):
                                        for item in items:
                                            if isinstance(item, dict) and item.get("screenshot_url"):
                                                urls_to_delete.add(item["screenshot_url"])
                        inf_res = sb.table("infringements").select("screenshot_url").eq("case_id", cid).execute()
                        if inf_res.data:
                            for row in inf_res.data:
                                if row.get("screenshot_url"):
                                    urls_to_delete.add(row["screenshot_url"])
                        paths_to_delete = []
                        marker = "/evidence-screenshots/"
                        for url in urls_to_delete:
                            idx = url.find(marker)
                            if idx != -1:
                                paths_to_delete.append(url[idx + len(marker):])
                            elif not url.startswith("http") and url:
                                paths_to_delete.append(url)
                        if paths_to_delete:
                            sb.storage.from_("evidence-screenshots").remove(paths_to_delete)
                    except Exception as exc:
                        print(f"[Brands] Storage screenshot cleanup failed for case {cid}: {exc}")

                    sb.table("cases").delete().eq("id", cid).execute()
        except Exception as exc:
            print(f"[Brands] Cases purge failed for brand '{brand_name}': {exc}")

    # 2. Clean up brand assets storage
    try:
        from tracemark_api.services.storage import BRAND_ASSETS_BUCKET
        assets_res = sb.table("brand_assets").select("file_url").eq("brand_id", brand_id).execute()
        if assets_res.data:
            asset_paths = [a["file_url"] for a in assets_res.data if a.get("file_url")]
            if asset_paths:
                sb.storage.from_(BRAND_ASSETS_BUCKET).remove(asset_paths)
    except Exception as exc:
        print(f"[Brands] Brand assets storage cleanup failed: {exc}")

    # 3. Delete brand record
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
