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

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile
from pydantic import BaseModel

from tracemark_api.services.database import get_supabase
from tracemark_api.services.entitlements import (
    reconcile_brand_locks,
    resolve_entitlements_for_org,
    _addons_for_org,
    _override_for_org,
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


# ── Brand assets (photos) — admin portal manages these via the same storage path ──
@router.get("/brands/{brand_id}/assets")
def internal_list_brand_assets(brand_id: str, _ok: bool = Depends(verify_internal_secret)):
    from tracemark_api.services.storage import get_brand_asset_url

    sb = get_supabase()
    rows = (
        sb.table("brand_assets").select("id, brand_id, asset_type, file_url, metadata, created_at")
        .eq("brand_id", brand_id).order("created_at", desc=True).execute().data or []
    )
    for r in rows:
        r["signed_url"] = get_brand_asset_url(r["file_url"]) if r.get("file_url") else None
    return rows


@router.post("/brands/{brand_id}/assets")
def internal_upload_brand_asset(
    brand_id: str,
    asset_type: str = Form(...),
    file: UploadFile = File(...),
    _ok: bool = Depends(verify_internal_secret),
):
    from tracemark_api.services.storage import (
        upload_brand_asset,
        compute_phash,
        compute_content_hash,
        get_brand_asset_url,
    )

    _MAX_UPLOAD_BYTES = 10 * 1024 * 1024
    _ALLOWED_IMAGE_MIMES = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"}
    _ALLOWED_TEXT_MIMES = {"text/plain", "text/csv", "text/html"}

    content_type = (file.content_type or "application/octet-stream").split(";")[0].strip().lower()
    if asset_type in ("logo", "product_image") and content_type not in _ALLOWED_IMAGE_MIMES:
        raise HTTPException(status_code=400, detail="Logo/product images must be JPEG, PNG, WebP, GIF, or SVG")
    if asset_type == "reference_content" and content_type not in _ALLOWED_TEXT_MIMES:
        raise HTTPException(status_code=400, detail="Reference content must be a plain-text, CSV, or HTML file")
    file_bytes = file.file.read()
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
            embedding_val = embed_text(file_bytes.decode("utf-8", errors="replace"))
        except Exception as e:  # noqa: BLE001
            print(f"[internal] reference embedding failed: {e}")

    payload: dict = {
        "brand_id": brand_id,
        "asset_type": asset_type,
        "file_url": storage_path,
        "content_hash": chash,
        "phash": phash_val,
        "metadata": {"filename": file.filename, "content_type": content_type},
    }
    if embedding_val is not None:
        payload["embedding"] = str(embedding_val)

    row = get_supabase().table("brand_assets").insert(payload).execute().data[0]
    row["signed_url"] = get_brand_asset_url(storage_path)
    return row


@router.delete("/brands/{brand_id}/assets/{asset_id}")
def internal_delete_brand_asset(brand_id: str, asset_id: str, _ok: bool = Depends(verify_internal_secret)):
    from tracemark_api.services.storage import BRAND_ASSETS_BUCKET

    sb = get_supabase()
    res = sb.table("brand_assets").select("file_url").eq("id", asset_id).eq("brand_id", brand_id).maybe_single().execute()
    if not res or not res.data:
        raise HTTPException(status_code=404, detail="Asset not found")
    path = res.data.get("file_url")
    if path:
        try:
            sb.storage.from_(BRAND_ASSETS_BUCKET).remove([path])
        except Exception as e:  # noqa: BLE001
            print(f"[internal] storage delete failed: {e}")
    sb.table("brand_assets").delete().eq("id", asset_id).execute()
    return {"deleted": True, "id": asset_id}


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
    mode: str = "comp"  # "comp" = free override (no Stripe) | "charge" = bill via Stripe (prorated)


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
    if body.mode not in ("comp", "charge"):
        raise HTTPException(status_code=400, detail="mode must be 'comp' or 'charge'")
    sb = get_supabase()

    # ── CHARGE: bill the customer via Stripe (prorated) ──────────────────────
    if body.mode == "charge":
        from tracemark_api.routes.billing import (
            _ACTIVE_STATUSES, _current_subscription_row, _do_stripe, _stripe,
            _as_dict, _sync_subscription_to_db, _upsert_invoice,
        )
        from tracemark_api.services.billing_config import (
            SELF_SERVE_PLANS, get_plan_price_id, price_id_to_plan,
        )
        if body.plan not in SELF_SERVE_PLANS:
            raise HTTPException(status_code=400, detail=f"Plan '{body.plan}' is not self-serve (use comp)")
        row = _current_subscription_row(body.org_id)
        if not row or row.get("status") not in _ACTIVE_STATUSES or not row.get("stripe_subscription_id"):
            raise HTTPException(
                status_code=400,
                detail="No active Stripe subscription to charge. Use comp, or have the customer subscribe via checkout.",
            )
        interval = row.get("interval") or "month"
        desired_price = get_plan_price_id(body.plan, interval)
        stripe_sub_id = row["stripe_subscription_id"]
        sub = _as_dict(_do_stripe(_stripe().Subscription.retrieve, stripe_sub_id, expand=["items"]))
        items = (sub.get("items") or {}).get("data") or []
        old_plan_item = next((it for it in items if price_id_to_plan(it["price"]["id"]) is not None), None)
        mods = []
        if old_plan_item and old_plan_item["price"]["id"] != desired_price:
            mods.append({"id": old_plan_item["id"], "price": desired_price})
        elif not old_plan_item:
            mods.append({"price": desired_price})
        if not mods:
            raise HTTPException(status_code=400, detail="Customer is already on this plan — nothing to charge.")

        # always_invoice bills the proration IMMEDIATELY (creates + attempts to pay an
        # invoice now), instead of deferring it to the next cycle (create_prorations).
        updated = _do_stripe(
            _stripe().Subscription.modify, stripe_sub_id,
            items=mods, proration_behavior="always_invoice",
            cancel_at_period_end=False, expand=["items", "latest_invoice"],
        )
        _sync_subscription_to_db(updated, body.org_id)  # syncs plan + mirrors profiles.plan + reconciles

        # Sync the freshly-created invoice into our DB immediately, so it shows in the
        # admin without waiting for the Stripe webhook (which can't reach localhost).
        invoice_synced = False
        latest = _as_dict(updated).get("latest_invoice")
        try:
            inv_obj = latest if isinstance(latest, dict) else (
                _as_dict(_do_stripe(_stripe().Invoice.retrieve, latest)) if latest else None
            )
            if inv_obj:
                _upsert_invoice(inv_obj, body.org_id)
                invoice_synced = True
        except Exception as exc:  # noqa: BLE001
            print(f"[internal] invoice sync after charge failed: {exc}")

        return {"org_id": body.org_id, "plan": body.plan, "mode": "charge",
                "status": _as_dict(updated).get("status"), "invoice_synced": invoice_synced}

    # ── COMP: free override (no Stripe) ──────────────────────────────────────
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
        sb.table("subscriptions").update({"plan": body.plan, "status": "active", "updated_at": now_iso}).eq(
            "id", sub.data[0]["id"]
        ).execute()
    sb.table("profiles").update({"plan": body.plan}).eq("id", body.org_id).execute()
    result = reconcile_brand_locks(body.org_id)
    return {"org_id": body.org_id, "plan": body.plan, "mode": "comp", "reconciled": result}


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


# ── Per-org entitlement overrides (Pro/Enterprise custom deals) ────────────────

class SetOverrideRequest(BaseModel):
    brands_override: int | None = None       # -1 = unlimited; null = don't override
    platforms_override: int | None = None
    regions_override: int | None = None
    domain_tracking: bool | None = None
    managed_takedown: bool | None = None
    api_access: bool | None = None
    advanced_reports: bool | None = None
    real_time_scans: bool | None = None
    note: str | None = None


@router.get("/orgs/{org_id}/entitlement-override")
def get_entitlement_override(org_id: str, _ok: bool = Depends(verify_internal_secret)):
    """Read the current admin override for an org (empty dict if none set)."""
    return _override_for_org(org_id) or {}


@router.put("/orgs/{org_id}/entitlement-override")
def set_entitlement_override(
    org_id: str, body: SetOverrideRequest, _ok: bool = Depends(verify_internal_secret)
):
    """Set (or update) custom entitlement limits for an org.

    All 8 override fields are always written — null explicitly clears a field back
    to "inherit from plan+addons". This lets the admin UI selectively un-override
    individual flags without deleting the entire row.
    """
    sb = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    # Always write all 8 override fields so null = "revert to plan default".
    row = {
        "organization_id": org_id,
        "updated_at": now,
        "brands_override": body.brands_override,
        "platforms_override": body.platforms_override,
        "regions_override": body.regions_override,
        "domain_tracking": body.domain_tracking,
        "managed_takedown": body.managed_takedown,
        "api_access": body.api_access,
        "advanced_reports": body.advanced_reports,
        "real_time_scans": body.real_time_scans,
    }
    if body.note is not None:
        row["note"] = body.note
    sb.table("org_entitlement_overrides").upsert(row, on_conflict="organization_id").execute()
    reconcile_brand_locks(org_id)
    return {"success": True, "org_id": org_id}


@router.delete("/orgs/{org_id}/entitlement-override")
def clear_entitlement_override(org_id: str, _ok: bool = Depends(verify_internal_secret)):
    """Remove all custom overrides for an org (reverts to plan+addon limits)."""
    sb = get_supabase()
    sb.table("org_entitlement_overrides").delete().eq("organization_id", org_id).execute()
    reconcile_brand_locks(org_id)
    return {"success": True, "org_id": org_id}
