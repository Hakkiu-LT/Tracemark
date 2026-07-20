"""Internal service-to-service endpoints for the admin portal.

These are NOT for browsers. They are called by the separate admin-api backend, which
authenticates with a shared secret (X-Internal-Secret header == INTERNAL_API_SECRET).
The admin-api is responsible for staff authentication + permission checks BEFORE it
calls here; this layer only verifies the caller is the trusted admin-api.

Why these live in the MAIN api rather than admin-api:
  - Resource + usage metrics reflect in-process state of THIS (scraping) process.
  - Billing entitlements resolve through this project's subscriptions table +
    reconcile_brand_locks. Keeping the logic here avoids duplicating it and drifting.
"""
from __future__ import annotations

import hmac
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from tracemark_api.services.database import get_supabase
from tracemark_api.services.entitlements import (
    reconcile_brand_locks,
    resolve_entitlements_for_org,
    _addons_for_org,
)

router = APIRouter(prefix="/internal", tags=["internal"])


def verify_internal_secret(x_internal_secret: str = Header(...)) -> bool:
    """Constant-time compare of the shared internal secret."""
    expected = os.environ.get("INTERNAL_API_SECRET", "")
    if not expected or not hmac.compare_digest(x_internal_secret, expected):
        raise HTTPException(status_code=401, detail="Invalid internal secret")
    return True


# ── Entitlements (plan + effective limits + add-ons for an org) ───────────────
@router.get("/entitlements/{org_id}")
def internal_entitlements(org_id: str, _ok: bool = Depends(verify_internal_secret)):
    """Resolved plan + effective limits + purchased add-ons for an org.

    Used by the admin portal to render 'usage vs limit' per company.
    """
    plan, ent = resolve_entitlements_for_org(org_id)
    return {
        "plan": plan,
        "entitlements": ent.to_dict(),
        "addons": _addons_for_org(org_id),
    }


# ── Send-email (SMTP runs here; admin-api calls these) ───────────────────────
@router.post("/takedowns/{takedown_id}/send-email")
def internal_send_takedown_email(takedown_id: str, _ok: bool = Depends(verify_internal_secret)):
    sb = get_supabase()
    res = sb.table("takedown_reports").select("*").eq("id", takedown_id).maybe_single().execute()
    if not res or not res.data:
        raise HTTPException(status_code=404, detail="Takedown report not found")
    report = res.data
    recipient = report.get("submission_email")
    if not recipient:
        raise HTTPException(status_code=400, detail="No submission email for this platform")

    from tracemark_api.services.notifications import send_email_notification
    from tracemark_api.services.delivery_log import log_delivery

    try:
        send_email_notification(
            {"type": "test", "message": report.get("notice_text", ""), "brand_name": "Takedown Notice"},
            recipient,
        )
        submitted_at = datetime.now(timezone.utc).isoformat()
        sb.table("takedown_reports").update({"status": "sent", "submitted_at": submitted_at}).eq(
            "id", takedown_id
        ).execute()
        log_delivery(event_type="takedown_submitted", ok=True, payload={"takedown_report_id": takedown_id, "recipient": recipient})
        return {"success": True, "recipient": recipient, "submitted_at": submitted_at}
    except Exception as e:  # noqa: BLE001
        log_delivery(event_type="takedown_submitted", ok=False, error=str(e), payload={"takedown_report_id": takedown_id})
        raise HTTPException(status_code=500, detail=f"Failed to send: {e}")


@router.post("/documents/{document_id}/send-email")
def internal_send_document_email(document_id: str, _ok: bool = Depends(verify_internal_secret)):
    sb = get_supabase()
    res = sb.table("documents").select("*").eq("id", document_id).maybe_single().execute()
    if not res or not res.data:
        raise HTTPException(status_code=404, detail="Document not found")
    doc = res.data
    from tracemark_api.services.notifications import dispatch_notifications

    try:
        dispatch_notifications(
            {
                "type": "takedown_generated",
                "document_id": doc["id"],
                "infringement_id": doc.get("infringement_id"),
                "document_type": doc.get("document_type"),
                "file_url": doc.get("file_url"),
            }
        )
        sent_at = datetime.now(timezone.utc).isoformat()
        sb.table("documents").update({"status": "sent", "sent_at": sent_at}).eq("id", document_id).execute()
        return {"success": True, "sent_at": sent_at}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Failed to send: {e}")


# ── Resource + usage metrics (read-only passthrough of in-process state) ───────
@router.get("/resources/metrics")
def internal_resource_metrics(_ok: bool = Depends(verify_internal_secret)):
    from tracemark_api.services import resource_monitor

    return resource_monitor.get_metrics()


@router.get("/resources/status")
def internal_resource_status(_ok: bool = Depends(verify_internal_secret)):
    from tracemark_api.services import resource_monitor

    return resource_monitor.get_status()


@router.get("/usage-stats")
def internal_usage_stats(_ok: bool = Depends(verify_internal_secret)):
    from tracemark_api.services.api_usage_tracker import tracker

    return {
        "summary": [vars(s) for s in tracker.get_usage_summary()],
        "by_developer": [vars(d) for d in tracker.get_by_developer()],
        "hourly": [vars(b) for b in tracker.get_hourly_breakdown()],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ── Billing overrides (admin full control, keyed by org) ───────────────────────
class SetPlanRequest(BaseModel):
    org_id: str
    plan: str


class CancelRequest(BaseModel):
    org_id: str
    cancel: bool = True


_VALID_PLANS = ("free", "starter", "growth", "pro", "agency", "enterprise")


@router.post("/billing/set-plan")
def internal_set_plan(body: SetPlanRequest, _ok: bool = Depends(verify_internal_secret)):
    """Admin plan override for an org.

    Behavior: if the org has a subscription row, update its plan; otherwise fall back
    to mirroring profiles.plan (which entitlements use when there's no active sub).
    Always mirrors profiles.plan and reconciles brand locks.

    CAVEAT: this does NOT modify Stripe. If the org has a live Stripe subscription,
    overriding the plan here creates a mismatch with Stripe until the next webhook.
    Use for comps/support overrides, not routine plan changes.
    """
    if body.plan not in _VALID_PLANS:
        raise HTTPException(status_code=400, detail=f"Invalid plan: {body.plan}")
    sb = get_supabase()

    now_iso = datetime.now(timezone.utc).isoformat()
    sub = (
        sb.table("subscriptions")
        .select("id, stripe_subscription_id")
        .eq("organization_id", body.org_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if sub.data:
        sb.table("subscriptions").update({"plan": body.plan, "updated_at": now_iso}).eq(
            "id", sub.data[0]["id"]
        ).execute()

    # Mirror onto profiles.plan (UI + entitlement fallback). profiles.id == org_id for
    # single-member accounts; for real orgs this is a best-effort mirror.
    sb.table("profiles").update({"plan": body.plan}).eq("id", body.org_id).execute()

    result = reconcile_brand_locks(body.org_id)
    return {"org_id": body.org_id, "plan": body.plan, "reconciled": result}


class MetaTokenRequest(BaseModel):
    short_lived_token: str


@router.post("/meta/exchange-token")
def internal_exchange_meta_token(
    body: MetaTokenRequest, _ok: bool = Depends(verify_internal_secret)
):
    """Exchange a short-lived Meta token for a long-lived one and persist it.

    Runs in the main API because it writes the token to this process's .env.
    """
    from tracemark_api.services.marketplace import (
        exchange_short_lived_meta_token,
        update_env_meta_token,
    )

    try:
        result = exchange_short_lived_meta_token(body.short_lived_token)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Unexpected error: {exc}")

    new_token = result.get("access_token")
    if not new_token:
        raise HTTPException(status_code=400, detail="Meta API did not return an access token.")

    expires_in = result.get("expires_in")
    expires_at_str = None
    if expires_in:
        from datetime import timedelta

        expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
        expires_at_str = expires_at.strftime("%Y-%m-%d %H:%M:%S UTC")

    update_env_meta_token(new_token)
    return {
        "success": True,
        "expires_in_seconds": expires_in,
        "expires_at": expires_at_str,
        "token_type": result.get("token_type"),
    }


@router.post("/billing/cancel")
def internal_cancel(body: CancelRequest, _ok: bool = Depends(verify_internal_secret)):
    """Cancel (or resume) an org's Stripe subscription at period end."""
    from tracemark_api.routes.billing import (
        _ACTIVE_STATUSES,
        _current_subscription_row,
        _do_stripe,
        _stripe,
        _ts_to_iso,
        int_now,
    )

    sb = get_supabase()
    row = _current_subscription_row(body.org_id)
    if not row or row.get("status") not in _ACTIVE_STATUSES or not row.get("stripe_subscription_id"):
        raise HTTPException(status_code=404, detail="No active subscription")

    stripe_sub_id = row["stripe_subscription_id"]
    _do_stripe(_stripe().Subscription.modify, stripe_sub_id, cancel_at_period_end=body.cancel)
    sb.table("subscriptions").update(
        {"cancel_at_period_end": body.cancel, "updated_at": _ts_to_iso(int_now())}
    ).eq("organization_id", body.org_id).eq("stripe_subscription_id", stripe_sub_id).execute()
    return {"org_id": body.org_id, "cancel_at_period_end": body.cancel}
