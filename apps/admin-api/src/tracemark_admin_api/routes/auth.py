"""Staff identity endpoint: who am I + what can I do."""
from __future__ import annotations

import time
from collections import deque

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from tracemark_admin_api import main_api
from tracemark_admin_api.clients import admin_sb
from tracemark_admin_api.dependencies import StaffPrincipal, get_current_staff

router = APIRouter(prefix="/staff", tags=["staff-auth"])

# Per-IP limiter for the PUBLIC password-reset route (email-bomb / Resend abuse).
# Its 429 is handled by the app-level handler registered in main.py.
_limiter = Limiter(key_func=get_remote_address)

# Defense-in-depth per-EMAIL throttle (slowapi keys by IP only). In-process,
# per-container — enough to stop mail-bombing a single staff member. Returns the
# same neutral response when exceeded, preserving the anti-enumeration contract.
_EMAIL_MAX_PER_HOUR = 3
_EMAIL_WINDOW_SECONDS = 3600
_email_hits: dict[str, deque[float]] = {}


def _email_throttled(email: str) -> bool:
    now = time.monotonic()
    hits = _email_hits.setdefault(email, deque())
    while hits and now - hits[0] > _EMAIL_WINDOW_SECONDS:
        hits.popleft()
    if len(hits) >= _EMAIL_MAX_PER_HOUR:
        return True
    hits.append(now)
    return False

# Origins we will hand to Supabase as the recovery redirect base. Supabase ALSO
# enforces its own allow-list, so this is a second, defence-in-depth gate.
_ALLOWED_RESET_ORIGINS = {
    "https://admin.hakkiu.com",
    "https://admin.tracemark.ai",
    "http://localhost:8082",
}
_DEFAULT_RESET_ORIGIN = "https://admin.hakkiu.com"


class StaffMe(BaseModel):
    id: str
    email: str
    full_name: str | None
    role: str
    is_super_admin: bool
    permissions: list[str]


@router.get("/me", response_model=StaffMe)
def me(staff: StaffPrincipal = Depends(get_current_staff)) -> StaffMe:
    """Return the authenticated staff member + their resolved permission set.

    The frontend uses `permissions` to show/hide nav items and action buttons.
    """
    return StaffMe(
        id=staff.id,
        email=staff.email,
        full_name=staff.full_name,
        role=staff.role,
        is_super_admin=staff.is_super_admin,
        permissions=sorted(staff.permissions),
    )


class PasswordResetRequest(BaseModel):
    email: str
    # The admin app's origin (window.location.origin); the reset page path is appended.
    origin: str | None = None


# Never reveals whether the email maps to a staff account (anti-enumeration).
_NEUTRAL = {"message": "If that email belongs to a staff account, a reset link is on its way."}


@router.post("/request-password-reset")
@_limiter.limit("5/hour")
def request_password_reset(request: Request, body: PasswordResetRequest) -> dict:
    """PUBLIC endpoint (no auth): email a staff password-reset link.

    Flow: verify the email is an ACTIVE staff account → generate a Supabase recovery
    link via the service-role admin API (this does NOT send an email) → deliver it
    through the main API's Resend pipeline. This makes reset independent of Supabase's
    built-in SMTP. Always returns the same neutral message to prevent user enumeration.
    """
    email = (body.email or "").strip().lower()
    if not email:
        return _NEUTRAL

    # Per-email throttle (defense-in-depth on top of the per-IP slowapi limit).
    if _email_throttled(email):
        return _NEUTRAL

    base = body.origin if body.origin in _ALLOWED_RESET_ORIGINS else _DEFAULT_RESET_ORIGIN
    redirect_to = f"{base}/auth/reset-password"

    sb = admin_sb()

    # 1. Is this an active staff account? If not, stay silent.
    try:
        acct = (
            sb.table("staff_accounts")
            .select("id, is_active")
            .eq("email", email)
            .eq("is_active", True)
            .maybe_single()
            .execute()
        )
    except Exception as exc:  # noqa: BLE001
        print(f"[password-reset] staff lookup failed for {email}: {exc}")
        return _NEUTRAL
    if not acct or not acct.data:
        return _NEUTRAL

    # 2. Generate the recovery link (no email sent by Supabase).
    try:
        link = sb.auth.admin.generate_link(
            {"type": "recovery", "email": email, "options": {"redirect_to": redirect_to}}
        )
        action_link = link.properties.action_link
    except Exception as exc:  # noqa: BLE001
        print(f"[password-reset] generate_link failed for {email}: {exc}")
        return _NEUTRAL

    # 3. Deliver it via our own Resend pipeline (main API).
    try:
        main_api.send_password_reset_email(email=email, reset_link=action_link)
    except Exception as exc:  # noqa: BLE001
        print(f"[password-reset] email delivery failed for {email}: {exc}")

    return _NEUTRAL
