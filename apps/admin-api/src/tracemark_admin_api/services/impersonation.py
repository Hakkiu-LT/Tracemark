"""Customer impersonation ("log in as customer").

Mints a short-lived magic link against the MAIN project for the target customer, with a
redirect_to pointing at the CUSTOMER app's callback so the link actually lands somewhere
that establishes the session. Restricted to super-admins and always audit-logged.
"""
from __future__ import annotations

import os

from fastapi import HTTPException

from tracemark_admin_api.clients import customer_sb
from tracemark_admin_api.services.auth_users import get_email


def _customer_app_url() -> str:
    # Where the customer app runs. Dev: http://localhost:8080. Prod: set via env.
    return os.environ.get("CUSTOMER_APP_URL", "http://localhost:8080").rstrip("/")


def _extract_action_link(link) -> str | None:
    """Pull properties.action_link out of supabase-py's response (shape varies)."""
    # Object with .properties (object or dict)
    props = getattr(link, "properties", None)
    if props is not None:
        val = getattr(props, "action_link", None)
        if val:
            return val
        if isinstance(props, dict) and props.get("action_link"):
            return props["action_link"]
    # Whole response as a dict
    if isinstance(link, dict):
        p = link.get("properties") or {}
        if isinstance(p, dict) and p.get("action_link"):
            return p["action_link"]
        if link.get("action_link"):
            return link["action_link"]
    # Direct attribute fallback
    return getattr(link, "action_link", None)


def generate_impersonation_link(user_id: str) -> dict:
    """Return {email, action_link} a super-admin can use to log in as the customer."""
    sb = customer_sb()

    email = get_email(sb, user_id)
    if not email:
        raise HTTPException(status_code=404, detail="Customer not found")

    redirect_to = f"{_customer_app_url()}/auth/callback"
    try:
        link = sb.auth.admin.generate_link(
            {
                "type": "magiclink",
                "email": email,
                "options": {"redirect_to": redirect_to},
            }
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Could not generate link: {exc}")

    action_link = _extract_action_link(link)
    if not action_link:
        raise HTTPException(
            status_code=502,
            detail=f"Supabase returned no action_link (response type={type(link).__name__})",
        )

    return {"email": email, "action_link": action_link, "redirect_to": redirect_to}


def generate_recovery_link(email: str) -> str:
    """Return a Supabase recovery (set-password) action_link for a customer.

    Lands on the customer app's /auth/reset-password, where the customer chooses their own
    password. Used for onboarding invites and "resend login link". Recovery (not invite) is
    correct because admin-created users are already email-confirmed.
    """
    sb = customer_sb()
    redirect_to = f"{_customer_app_url()}/auth/reset-password"
    try:
        link = sb.auth.admin.generate_link(
            {
                "type": "recovery",
                "email": email,
                "options": {"redirect_to": redirect_to},
            }
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Could not generate login link: {exc}")

    action_link = _extract_action_link(link)
    if not action_link:
        raise HTTPException(status_code=502, detail="Supabase returned no action_link for recovery")
    return action_link
