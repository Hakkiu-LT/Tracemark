"""Admin edit of individual infringements and their evidence items (incl. AI override)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from tracemark_admin_api.clients import customer_sb
from tracemark_admin_api.dependencies import StaffPrincipal, require_permission
from tracemark_admin_api.services.audit import write_audit_log

router = APIRouter(tags=["infringements"])


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
        metadata={"changes": updates},
    )
    return {"success": True}


@router.patch("/evidence/{evidence_id}")
def update_evidence(
    evidence_id: str,
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
        staff, "evidence.edit", target_type="evidence", target_id=evidence_id, metadata={"changes": updates}
    )
    return {"success": True}
