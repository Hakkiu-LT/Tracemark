"""Admin edit of individual infringements and their evidence items (incl. AI override)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from tracemark_admin_api.clients import customer_sb
from tracemark_admin_api.dependencies import StaffPrincipal, require_permission
from tracemark_admin_api.services.audit import write_audit_log

router = APIRouter(tags=["infringements"])

# Storage bucket holding per-copycat evidence screenshots. A stored screenshot_url
# always contains this marker; we slice the object path out of it for a best-effort
# cleanup (mirrors deleteInfringementFromSupabase in the customer app's src/lib/supabase.ts).
_SCREENSHOT_BUCKET = "evidence-screenshots"
_SCREENSHOT_MARKER = f"/{_SCREENSHOT_BUCKET}/"


class UpdateInfringementRequest(BaseModel):
    status: str | None = None
    risk_level: str | None = None
    match_score: float | None = None
    match_type: str | None = None


class UpdateEvidenceRequest(BaseModel):
    verdict: str | None = None
    confidence: str | None = None
    overall_score: float | None = None
    status: str | None = None


@router.patch("/infringements/{infringement_id}")
def update_infringement(
    infringement_id: str,
    request: Request,
    payload: UpdateInfringementRequest,
    staff: StaffPrincipal = Depends(require_permission("customers.edit")),
):
    sb = customer_sb()
    before = sb.table("infringements").select("*").eq("id", infringement_id).maybe_single().execute()
    if not before or not before.data:
        raise HTTPException(status_code=404, detail="Infringement not found")
    updates = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    sb.table("infringements").update(updates).eq("id", infringement_id).execute()
    write_audit_log(
        staff, "infringements.edit", target_type="infringement", target_id=infringement_id,
        metadata={"changes": updates}, ip=request.client.host if request.client else None,
    )
    return {"success": True}


def _delete_screenshot(sb, screenshot_url: str | None) -> None:
    """Best-effort removal of the copycat screenshot from storage. Never raises:
    an orphaned file is preferable to a failed delete."""
    if not screenshot_url:
        return
    idx = screenshot_url.find(_SCREENSHOT_MARKER)
    if idx == -1:
        return  # bare path, legacy/foreign URL — nothing safe to remove
    path = screenshot_url[idx + len(_SCREENSHOT_MARKER):]
    if not path:
        return
    try:
        sb.storage.from_(_SCREENSHOT_BUCKET).remove([path])
    except Exception as e:  # noqa: BLE001 — cleanup is best-effort
        print(f"[Admin] Failed to delete screenshot {path}: {e}")


@router.delete("/infringements/{infringement_id}")
def delete_infringement(
    infringement_id: str,
    request: Request,
    staff: StaffPrincipal = Depends(require_permission("infringements.delete")),
):
    """Delete a single copycat infringement (one row) and its screenshot.

    The parent scan case and its other copycats are left untouched; related
    evidence_items / documents rows cascade in the database. Mirrors the customer
    app's deleteInfringementFromSupabase so both sides behave identically.
    """
    sb = customer_sb()
    before = (
        sb.table("infringements")
        .select("id, case_id, screenshot_url")
        .eq("id", infringement_id)
        .maybe_single()
        .execute()
    )
    if not before or not before.data:
        raise HTTPException(status_code=404, detail="Infringement not found")

    # Resolve the owning org for the audit trail (infringements are keyed by case).
    case_id = before.data.get("case_id")
    org_id = None
    if case_id:
        case = sb.table("cases").select("organization_id").eq("id", case_id).maybe_single().execute()
        org_id = case.data.get("organization_id") if case and case.data else None

    _delete_screenshot(sb, before.data.get("screenshot_url"))
    sb.table("infringements").delete().eq("id", infringement_id).execute()

    write_audit_log(
        staff, "infringements.delete", target_type="infringement", target_id=infringement_id,
        target_org_id=org_id, metadata={"case_id": case_id},
        ip=request.client.host if request.client else None,
    )
    return {"success": True}


@router.patch("/evidence/{evidence_id}")
def update_evidence(
    evidence_id: str,
    request: Request,
    payload: UpdateEvidenceRequest,
    staff: StaffPrincipal = Depends(require_permission("customers.edit")),
):
    """Override an evidence item's AI verdict/scores (testing / manual correction)."""
    sb = customer_sb()
    before = sb.table("evidence_items").select("id").eq("id", evidence_id).maybe_single().execute()
    if not before or not before.data:
        raise HTTPException(status_code=404, detail="Evidence item not found")
    updates = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    sb.table("evidence_items").update(updates).eq("id", evidence_id).execute()
    write_audit_log(
        staff, "evidence.edit", target_type="evidence", target_id=evidence_id, metadata={"changes": updates},
        ip=request.client.host if request.client else None,
    )
    return {"success": True}
