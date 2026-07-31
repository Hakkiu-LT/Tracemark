"""Contact-support endpoint.

Authenticated users can send a message to the HAKKIU support team
(info@hakkiu.com) via the Settings → Support tab. The email is delivered
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
    """Send a support message from the authenticated user to info@hakkiu.com."""
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

    ok = send_email(
        to="info@hakkiu.com",
        subject=f"[Support] {subject}",
        html=html,
        from_address="support@hakkiu.com",
        from_name="HAKKIU Support",
    )
    if not ok:
        raise HTTPException(
            status_code=502,
            detail="Email provider not configured or send failed",
        )

    return {"success": True, "message": "Your message has been sent to our support team."}
