"""Admin view/edit of takedown notices and legal documents."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from tracemark_admin_api import main_api
from tracemark_admin_api.clients import customer_sb
from tracemark_admin_api.dependencies import StaffPrincipal, require_permission
from tracemark_admin_api.services.audit import write_audit_log

router = APIRouter(tags=["takedowns"])


class UpdateTakedownRequest(BaseModel):
    notice_text: str | None = None
    status: str | None = None


@router.get("/takedowns")
def list_takedowns(
    case_id: str = Query(...),
    staff: StaffPrincipal = Depends(require_permission("customers.view")),
):
    return (
        customer_sb().table("takedown_reports").select("*").eq("case_id", case_id)
        .order("created_at", desc=True).execute().data or []
    )


@router.patch("/takedowns/{takedown_id}")
def update_takedown(
    takedown_id: str,
    request: Request,
    payload: UpdateTakedownRequest,
    staff: StaffPrincipal = Depends(require_permission("customers.edit")),
):
    sb = customer_sb()
    before = sb.table("takedown_reports").select("id").eq("id", takedown_id).maybe_single().execute()
    if not before or not before.data:
        raise HTTPException(status_code=404, detail="Takedown not found")
    updates = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    if updates.get("status") == "sent":
        updates["submitted_at"] = datetime.now(timezone.utc).isoformat()
    sb.table("takedown_reports").update(updates).eq("id", takedown_id).execute()
    write_audit_log(
        staff, "takedowns.edit", target_type="takedown", target_id=takedown_id, metadata={"changes": updates},
        ip=request.client.host if request.client else None,
    )
    return {"success": True}


@router.post("/takedowns/{takedown_id}/send-email")
def send_takedown_email(
    takedown_id: str,
    request: Request,
    staff: StaffPrincipal = Depends(require_permission("customers.edit")),
):
    result = main_api.send_takedown_email(takedown_id)
    write_audit_log(
        staff, "takedowns.send_email", target_type="takedown", target_id=takedown_id, metadata=result,
        ip=request.client.host if request.client else None,
    )
    return result


@router.get("/documents")
def list_documents(
    infringement_id: str = Query(...),
    staff: StaffPrincipal = Depends(require_permission("customers.view")),
):
    return (
        customer_sb().table("documents").select("*").eq("infringement_id", infringement_id)
        .order("created_at", desc=True).execute().data or []
    )


@router.post("/documents/{document_id}/send-email")
def send_document_email(
    document_id: str,
    request: Request,
    staff: StaffPrincipal = Depends(require_permission("customers.edit")),
):
    result = main_api.send_document_email(document_id)
    write_audit_log(
        staff, "documents.send_email", target_type="document", target_id=document_id, metadata=result,
        ip=request.client.host if request.client else None,
    )
    return result
