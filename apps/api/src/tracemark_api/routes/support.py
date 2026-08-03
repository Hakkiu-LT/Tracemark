"""Contact-support endpoint.

Authenticated users can send a message to the HAKKIU support team
(support@hakkiu.com) via the Settings → Support tab. The email is delivered
through the existing Resend email wrapper.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr

from tracemark_api.dependencies import get_current_user, AuthUser
from tracemark_api.services.rate_limit import limiter

router = APIRouter(prefix="/support", tags=["support"])


class ContactRequest(BaseModel):
    subject: str
    message: str


@router.post("/contact")
@limiter.limit("3/hour")
def contact_support(
    request: Request,
    body: ContactRequest,
    user: AuthUser = Depends(get_current_user),
):
    """Send a support message from the authenticated user to support@hakkiu.com."""
    from tracemark_api.services.email import send_email

    subject = body.subject.strip()
    message = body.message.strip()

    if not subject or not message:
        raise HTTPException(status_code=422, detail="Subject and message are required")

    html = f"""\
<div style="font-family:sans-serif;max-width:600px">
  <p><strong>From:</strong> {user.email}</p>
  <p><strong>User ID:</strong> {user.id}</p>
  <hr style="border:none;border-top:1px solid #e5e5e5;margin:16px 0" />
  <p><strong>Subject:</strong> {subject}</p>
  <div style="white-space:pre-wrap">{message}</div>
</div>
"""

    full_subject = f"[Support] {subject}"
    ok = send_email(
        to="support@hakkiu.com",
        subject=full_subject,
        html=html,
        from_address="support@hakkiu.com",
        from_name="HAKKIU Support",
    )
    # Best-effort audit row so support requests show in the Admin Portal Notification
    # Log alongside every other email; logging must never break the send itself.
    try:
        from tracemark_api.services.delivery_log import log_delivery

        log_delivery(
            "support_contact",
            ok=bool(ok),
            recipient="support@hakkiu.com",
            subject=full_subject,
            body_html=html,
            payload={"from_email": user.email, "from_user_id": user.id},
        )
    except Exception:  # noqa: BLE001
        pass

    if not ok:
        raise HTTPException(
            status_code=502,
            detail="Email provider not configured or send failed",
        )

    return {"success": True, "message": "Your message has been sent to our support team."}
