"""Admin endpoints for sales leads (Professional/Enterprise request-pricing forms)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from tracemark_admin_api.clients import customer_sb
from tracemark_admin_api.dependencies import StaffPrincipal, require_permission
from tracemark_admin_api.services.audit import write_audit_log

router = APIRouter(prefix="/leads", tags=["leads"])

VALID_STATUSES = frozenset({"pending", "contacted", "closed"})


class UpdateLeadRequest(BaseModel):
    status: str


@router.get("")
def list_leads(
    status: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    principal: StaffPrincipal = Depends(require_permission("leads.view")),
):
    sb = customer_sb()
    q = sb.table("sales_leads").select("*")
    if status:
        q = q.eq("status", status)
    result = q.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    return {"leads": result.data or [], "offset": offset, "limit": limit}


@router.patch("/{lead_id}")
def update_lead(
    lead_id: str,
    body: UpdateLeadRequest,
    request: Request,
    principal: StaffPrincipal = Depends(require_permission("leads.edit")),
):
    if body.status not in VALID_STATUSES:
        raise HTTPException(status_code=422, detail=f"status must be one of {sorted(VALID_STATUSES)}")

    sb = customer_sb()
    existing = sb.table("sales_leads").select("id,status,email").eq("id", lead_id).maybe_single().execute()
    if not existing or not existing.data:
        raise HTTPException(status_code=404, detail="Lead not found")

    sb.table("sales_leads").update({"status": body.status}).eq("id", lead_id).execute()

    write_audit_log(
        principal,
        "leads.update_status",
        target_type="sales_lead",
        target_id=lead_id,
        metadata={"status": body.status},
        ip=request.client.host if request.client else None,
    )

    return {"ok": True}


@router.delete("/{lead_id}")
def delete_lead(
    lead_id: str,
    request: Request,
    principal: StaffPrincipal = Depends(require_permission("leads.delete")),
):
    sb = customer_sb()
    existing = (
        sb.table("sales_leads")
        .select("id,email,org_id")
        .eq("id", lead_id)
        .maybe_single()
        .execute()
    )
    if not existing or not existing.data:
        raise HTTPException(status_code=404, detail="Lead not found")

    sb.table("sales_leads").delete().eq("id", lead_id).execute()

    write_audit_log(
        principal,
        "leads.delete",
        target_type="sales_lead",
        target_id=lead_id,
        target_org_id=existing.data.get("org_id"),
        metadata={"email": existing.data.get("email")},
        ip=request.client.host if request.client else None,
    )

    return {"ok": True}
