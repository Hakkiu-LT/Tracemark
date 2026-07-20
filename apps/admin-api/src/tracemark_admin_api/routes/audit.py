"""Read the admin audit log (authoritative copy in the staff project)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from tracemark_admin_api.clients import admin_sb
from tracemark_admin_api.dependencies import StaffPrincipal, require_permission

router = APIRouter(prefix="/audit-log", tags=["audit"])


@router.get("")
def list_audit(
    staff: StaffPrincipal = Depends(require_permission("audit.view")),
    action: str | None = Query(default=None),
    staff_id: str | None = Query(default=None),
    limit: int = Query(default=100, le=500),
):
    q = admin_sb().table("admin_audit_log").select("*").order("created_at", desc=True).limit(limit)
    if action:
        q = q.eq("action", action)
    if staff_id:
        q = q.eq("staff_id", staff_id)
    return q.execute().data or []
