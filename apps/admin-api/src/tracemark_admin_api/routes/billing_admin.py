"""Billing control for customers, proxied to the main API's internal endpoints.

Plan/entitlement logic lives in the main API (subscriptions table + reconcile_brand_
locks); we call it service-to-service after checking `billing.manage` and audit the
result here.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from tracemark_admin_api import main_api
from tracemark_admin_api.clients import customer_sb
from tracemark_admin_api.dependencies import StaffPrincipal, require_permission
from tracemark_admin_api.services.audit import write_audit_log

router = APIRouter(prefix="/customers", tags=["billing"])


class SetPlanRequest(BaseModel):
    plan: str


class CancelRequest(BaseModel):
    cancel: bool = True


def _org_for_user(user_id: str) -> str:
    """Billing anchor: the user's org, or their own id as single-member fallback."""
    prof = (
        customer_sb()
        .table("profiles")
        .select("organization_id")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    if not prof or not prof.data:
        raise HTTPException(status_code=404, detail="Customer not found")
    return prof.data.get("organization_id") or user_id


@router.put("/{user_id}/plan")
def change_plan(
    user_id: str,
    payload: SetPlanRequest,
    staff: StaffPrincipal = Depends(require_permission("billing.manage")),
):
    org_id = _org_for_user(user_id)
    result = main_api.set_plan(org_id, payload.plan)
    write_audit_log(
        staff,
        "billing.plan_change",
        target_type="customer",
        target_id=user_id,
        target_org_id=org_id,
        metadata={"plan": payload.plan, "result": result},
    )
    return result


@router.post("/{user_id}/cancel-subscription")
def cancel_subscription(
    user_id: str,
    payload: CancelRequest,
    staff: StaffPrincipal = Depends(require_permission("billing.manage")),
):
    org_id = _org_for_user(user_id)
    result = main_api.cancel_subscription(org_id, payload.cancel)
    write_audit_log(
        staff,
        "billing.cancel" if payload.cancel else "billing.resume",
        target_type="customer",
        target_id=user_id,
        target_org_id=org_id,
        metadata={"cancel": payload.cancel, "result": result},
    )
    return result
