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
