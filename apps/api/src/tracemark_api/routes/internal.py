"""Internal service-to-service endpoints for the admin portal.

These are NOT for browsers. They are called by the separate admin-api backend, which
authenticates with a shared secret (X-Internal-Secret header == INTERNAL_API_SECRET).
The admin-api is responsible for staff authentication + permission checks BEFORE it
calls here; this layer only verifies the caller is the trusted admin-api.

Why these live in the MAIN api rather than admin-api:
  - Resource + usage metrics reflect in-process state of THIS (scraping) process.
  - SMTP sends run in this process, so send-email operations are proxied here.
"""
from __future__ import annotations

import hmac
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile
from pydantic import BaseModel

from tracemark_api.services.database import get_supabase

router = APIRouter(prefix="/internal", tags=["internal"])


def verify_internal_secret(x_internal_secret: str = Header(...)) -> bool:
    """Constant-time compare of the shared internal secret."""
    expected = os.environ.get("INTERNAL_API_SECRET", "")
    if not expected or not hmac.compare_digest(x_internal_secret, expected):
        raise HTTPException(status_code=401, detail="Invalid internal secret")
    return True


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
        body_html = send_email_notification(
            {"type": "test", "message": report.get("notice_text", ""), "brand_name": "Takedown Notice"},
            recipient,
        )
        submitted_at = datetime.now(timezone.utc).isoformat()
        sb.table("takedown_reports").update({"status": "sent", "submitted_at": submitted_at}).eq(
            "id", takedown_id
        ).execute()
        log_delivery(event_type="takedown_submitted", ok=True, recipient=recipient, body_html=body_html, payload={"takedown_report_id": takedown_id, "recipient": recipient})
        return {"success": True, "recipient": recipient, "submitted_at": submitted_at}
    except Exception as e:  # noqa: BLE001
        log_delivery(event_type="takedown_submitted", ok=False, error=str(e), recipient=recipient, payload={"takedown_report_id": takedown_id})
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
        from tracemark_api.services.storage import sign_legal_document_url

        dispatch_notifications(
            {
                "type": "takedown_generated",
                "document_id": doc["id"],
                "infringement_id": doc.get("infringement_id"),
                "document_type": doc.get("document_type"),
                "file_url": sign_legal_document_url(doc.get("file_url")),
            }
        )
        sent_at = datetime.now(timezone.utc).isoformat()
        sb.table("documents").update({"status": "sent", "sent_at": sent_at}).eq("id", document_id).execute()
        return {"success": True, "sent_at": sent_at}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Failed to send: {e}")


class PasswordResetEmail(BaseModel):
    email: str
    reset_link: str


@router.post("/auth/send-password-reset")
def internal_send_password_reset(body: PasswordResetEmail, _ok: bool = Depends(verify_internal_secret)):
    """Send a staff password-reset email via Resend.

    The admin-api generates the Supabase recovery link (which does NOT itself send an
    email) and hands it here, so delivery goes through our own Resend pipeline rather
    than Supabase's built-in SMTP. Callers stay neutral on failure to avoid leaking
    whether an email exists.
    """
    from tracemark_api.services.email import send_email
    from tracemark_api.services.email_templates import _base, _btn

    if not body.email or not body.reset_link:
        raise HTTPException(status_code=400, detail="Missing email or reset link")

    content = (
        '<h2 style="margin:0 0 8px;font-size:20px;color:#0f172a;">Reset your admin password</h2>'
        '<p style="margin:0 0 4px;color:#334155;font-size:14px;line-height:1.6;">'
        "We received a request to reset the password for your HAKKIU Admin account. "
        "Click the button below to choose a new password — this link expires in 1 hour.</p>"
        f"{_btn('Reset password', body.reset_link)}"
        '<p style="margin:20px 0 0;color:#64748b;font-size:12px;line-height:1.6;">'
        "If you didn't request this, you can safely ignore this email — your password "
        "will stay the same.</p>"
    )
    html = _base(content, preheader="Reset your HAKKIU Admin password")
    ok = send_email(to=body.email, subject="Reset your HAKKIU Admin password", html=html)
    if not ok:
        raise HTTPException(status_code=502, detail="Email provider not configured or send failed")
    return {"success": True}


class DemoConfirmationEmail(BaseModel):
    email: str
    first_name: str | None = None
    scheduled_at: str                    # ISO-8601 UTC instant of the confirmed slot
    scheduled_timezone: str | None = None  # IANA tz to render the slot in for the customer
    meeting_link: str | None = None


@router.post("/leads/send-demo-confirmation")
def internal_send_demo_confirmation(
    body: DemoConfirmationEmail, _ok: bool = Depends(verify_internal_secret)
):
    """Send the customer their CONFIRMED demo slot (+ video link) via Resend.

    Called by admin-api after a staff member confirms a requested slot. The slot
    is formatted in the customer's timezone here so the copy is consistent with
    the "request received" email the same person already got.
    """
    from tracemark_api.routes.leads import format_slot
    from tracemark_api.services.email import send_email
    from tracemark_api.services.email_templates import demo_confirmed_html

    confirmed_time = format_slot(body.scheduled_at, body.scheduled_timezone)
    if not confirmed_time:
        raise HTTPException(status_code=400, detail="Invalid scheduled_at")

    html = demo_confirmed_html(
        first_name=body.first_name,
        confirmed_time=confirmed_time,
        meeting_link=body.meeting_link or None,
    )
    ok = send_email(
        to=body.email,
        subject="Your HAKKIU demo is confirmed",
        html=html,
    )
    if not ok:
        raise HTTPException(status_code=502, detail="Email provider not configured or send failed")
    return {"success": True, "confirmed_time": confirmed_time}


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
