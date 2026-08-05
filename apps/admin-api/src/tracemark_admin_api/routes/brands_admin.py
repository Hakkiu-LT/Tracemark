"""Brand management across ALL organizations (service-role, bypasses RLS)."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel

from tracemark_admin_api import main_api
from tracemark_admin_api.clients import customer_sb
from tracemark_admin_api.dependencies import StaffPrincipal, require_permission
from tracemark_admin_api.services.audit import write_audit_log

router = APIRouter(prefix="/brands", tags=["brands"])

# Fields an admin is allowed to edit on a brand. Never let arbitrary columns through.
_EDITABLE = {
    "brand_name", "website", "registration_number", "status", "platforms",
    "target_regions", "official_domains", "official_advertisers", "logo_color",
}


def _norm_limit(raw) -> int | None:
    """None/-1 (unlimited sentinels) → None; a real >= 0 cap passes through."""
    return None if raw in (None, -1) else raw


def _enforce_per_brand_caps(sb, org_id: str, platforms, target_regions) -> None:
    """Raise 403 if a brand edit exceeds the org's per-brand region/marketplace caps.

    Create goes through create_brand_checked (which enforces the same caps atomically);
    edits bypass that RPC, so mirror the checks here to keep staff edits within plan too.
    """
    row = (
        sb.table("org_entitlement_overrides")
        .select("regions_per_brand_limit, platforms_per_brand_limit")
        .eq("organization_id", org_id).maybe_single().execute()
    )
    data = (row.data if row else None) or {}
    rlim = _norm_limit(data.get("regions_per_brand_limit"))
    plim = _norm_limit(data.get("platforms_per_brand_limit"))
    if rlim is not None and target_regions is not None and len(target_regions) > rlim:
        raise HTTPException(status_code=403, detail=f"This company's plan allows up to {rlim} region(s) per brand. Raise it under Plan & Limits first.")
    if plim is not None and platforms is not None and len(platforms) > plim:
        raise HTTPException(status_code=403, detail=f"This company's plan allows up to {plim} marketplace(s) per brand. Raise it under Plan & Limits first.")


class UpdateBrandRequest(BaseModel):
    brand_name: str | None = None
    website: str | None = None
    registration_number: str | None = None
    status: str | None = None
    platforms: list[str] | None = None
    target_regions: list[str] | None = None
    official_domains: list[str] | None = None
    official_advertisers: list[str] | None = None
    logo_color: str | None = None


class CreateBrandRequest(BaseModel):
    organization_id: str
    brand_name: str
    website: str | None = None
    registration_number: str | None = None
    platforms: list[str] = []
    target_regions: list[str] = []
    official_domains: list[str] = []
    official_advertisers: list[str] = []
    logo_color: str | None = None


@router.post("")
def create_brand(
    request: Request,
    payload: CreateBrandRequest,
    staff: StaffPrincipal = Depends(require_permission("brands.create")),
):
    """Create a brand for a company on the customer's behalf.

    Goes through the SAME create_brand_checked RPC the customer app uses, so the per-org
    brand cap is enforced atomically here too (staff cannot bypass it). The acting user_id
    anchor is the company's first owner, or NULL when the company has no users yet.
    """
    if not payload.brand_name.strip():
        raise HTTPException(status_code=400, detail="Brand name is required")

    sb = customer_sb()
    org = (
        sb.table("organizations").select("id").eq("id", payload.organization_id)
        .maybe_single().execute()
    )
    if not org or not org.data:
        raise HTTPException(status_code=404, detail="Organization not found")

    owner = (
        sb.table("organization_members").select("user_id")
        .eq("organization_id", payload.organization_id).eq("role", "owner")
        .limit(1).execute()
    )
    anchor_user_id = owner.data[0]["user_id"] if owner.data else None

    try:
        res = sb.rpc(
            "create_brand_checked",
            {
                "p_organization_id": payload.organization_id,
                "p_user_id": anchor_user_id,
                "p_brand_name": payload.brand_name.strip(),
                "p_website": payload.website,
                "p_registration_number": payload.registration_number,
                "p_platforms": payload.platforms,
                "p_target_regions": payload.target_regions,
                "p_logo_color": payload.logo_color,
                "p_official_domains": payload.official_domains,
                "p_official_advertisers": payload.official_advertisers,
            },
        ).execute()
    except Exception as exc:  # noqa: BLE001
        msg = str(exc)
        if "BRAND_LIMIT_REACHED" in msg:
            raise HTTPException(status_code=403, detail="Brand limit reached for this company. Raise it under Plan & Limits first.")
        if "REGION_LIMIT_REACHED" in msg:
            raise HTTPException(status_code=403, detail="Too many regions for this brand — raise the per-brand region cap under Plan & Limits first.")
        if "PLATFORM_LIMIT_REACHED" in msg:
            raise HTTPException(status_code=403, detail="Too many marketplaces for this brand — raise the per-brand marketplace cap under Plan & Limits first.")
        raise HTTPException(status_code=400, detail=f"Could not create brand: {exc}")

    created = res.data[0] if isinstance(res.data, list) else res.data
    write_audit_log(
        staff,
        "brands.create",
        target_type="brand",
        target_id=(created or {}).get("id"),
        target_org_id=payload.organization_id,
        metadata={"brand_name": payload.brand_name, "organization_id": payload.organization_id},
        ip=request.client.host if request.client else None,
    )
    return created


@router.get("")
def list_brands(staff: StaffPrincipal = Depends(require_permission("brands.view"))):
    """Every brand across every organization, newest first."""
    rows = (
        customer_sb()
        .table("brands")
        .select("*")
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )
    return rows


@router.patch("/{brand_id}")
def update_brand(
    brand_id: str,
    request: Request,
    payload: UpdateBrandRequest,
    staff: StaffPrincipal = Depends(require_permission("brands.edit")),
):
    updates = {k: v for k, v in payload.model_dump(exclude_none=True).items() if k in _EDITABLE}
    if not updates:
        raise HTTPException(status_code=400, detail="No editable fields provided")
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    sb = customer_sb()
    before = sb.table("brands").select("*").eq("id", brand_id).maybe_single().execute()
    if not before or not before.data:
        raise HTTPException(status_code=404, detail="Brand not found")

    _enforce_per_brand_caps(
        sb, before.data.get("organization_id"), payload.platforms, payload.target_regions
    )

    res = sb.table("brands").update(updates).eq("id", brand_id).execute()
    write_audit_log(
        staff,
        "brands.edit",
        target_type="brand",
        target_id=brand_id,
        target_org_id=before.data.get("organization_id"),
        metadata={"before": before.data, "changes": updates},
        ip=request.client.host if request.client else None,
    )
    return res.data[0]


@router.delete("/{brand_id}")
def delete_brand(
    brand_id: str,
    request: Request,
    staff: StaffPrincipal = Depends(require_permission("brands.delete")),
):
    sb = customer_sb()
    before = sb.table("brands").select("*").eq("id", brand_id).maybe_single().execute()
    if not before or not before.data:
        raise HTTPException(status_code=404, detail="Brand not found")

    sb.table("brands").delete().eq("id", brand_id).execute()
    write_audit_log(
        staff,
        "brands.delete",
        target_type="brand",
        target_id=brand_id,
        target_org_id=before.data.get("organization_id"),
        metadata={"deleted": before.data},
        ip=request.client.host if request.client else None,
    )
    # NOTE: plan brand-lock reconciliation (reconcile_brand_locks) lives in the main
    # API's entitlements service. If deleting a brand should free a locked slot, trigger
    # that via the main API rather than duplicating the logic here.
    return {"success": True}


# ── Brand assets (logos / product images) — proxied to main API for phash+storage ──
@router.get("/{brand_id}/assets")
def list_brand_assets(
    brand_id: str,
    staff: StaffPrincipal = Depends(require_permission("brands.view")),
):
    """List a brand's assets with fresh signed URLs (thumbnails viewable in admin)."""
    return main_api.list_brand_assets(brand_id)


_MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
_ALLOWED_IMAGE_MIMES = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"}
_ALLOWED_TEXT_MIMES = {"text/plain", "text/csv", "text/html"}


@router.post("/{brand_id}/assets")
async def upload_brand_asset(
    brand_id: str,
    request: Request,
    asset_type: str = Form(...),
    file: UploadFile = File(...),
    staff: StaffPrincipal = Depends(require_permission("brands.edit")),
):
    if asset_type not in ("logo", "product_image", "reference_content"):
        raise HTTPException(status_code=400, detail="Invalid asset_type")
    ct = (file.content_type or "").split(";")[0].strip().lower()
    if asset_type in ("logo", "product_image") and ct not in _ALLOWED_IMAGE_MIMES:
        raise HTTPException(status_code=400, detail="Logo/product images must be JPEG, PNG, WebP, GIF, or SVG")
    if asset_type == "reference_content" and ct not in _ALLOWED_TEXT_MIMES:
        raise HTTPException(status_code=400, detail="Reference content must be a plain-text, CSV, or HTML file")
    data = await file.read()
    if len(data) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds 10 MB limit")
    result = main_api.upload_brand_asset(
        brand_id, asset_type, file.filename or "upload", file.content_type or "application/octet-stream", data
    )
    write_audit_log(
        staff, "brands.asset_add", target_type="brand", target_id=brand_id,
        metadata={"asset_type": asset_type, "filename": file.filename},
        ip=request.client.host if request.client else None,
    )
    return result


@router.delete("/{brand_id}/assets/{asset_id}")
def delete_brand_asset(
    brand_id: str,
    asset_id: str,
    request: Request,
    staff: StaffPrincipal = Depends(require_permission("brands.edit")),
):
    result = main_api.delete_brand_asset(brand_id, asset_id)
    write_audit_log(
        staff, "brands.asset_delete", target_type="brand", target_id=brand_id,
        metadata={"asset_id": asset_id},
        ip=request.client.host if request.client else None,
    )
    return result
