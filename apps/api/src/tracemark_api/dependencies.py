from __future__ import annotations

from fastapi import Depends, Header, HTTPException
from tracemark_api.services.database import get_supabase
from tracemark_api.services.entitlements import (
    Entitlement,
    resolve_entitlements_for_user,
)


class AuthUser:
    def __init__(self, id: str, email: str):
        self.id = id
        self.email = email


class CurrentProfile:
    """Authenticated user enriched with their billing plan + resolved
    entitlements. Use this (instead of AuthUser) on any endpoint that needs to
    enforce plan limits."""

    def __init__(
        self,
        id: str,
        email: str,
        organization_id: str,
        plan: str,
        entitlements: Entitlement,
    ):
        self.id = id
        self.email = email
        self.organization_id = organization_id
        self.plan = plan
        self.entitlements = entitlements


def get_current_user(authorization: str = Header(...)) -> AuthUser:
    """
    Validate Supabase JWT from Authorization: Bearer <token> header.
    Returns the authenticated user's id and email.
    """
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")

    sb = get_supabase()
    try:
        user_response = sb.auth.get_user(token)
        user = user_response.user
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return AuthUser(id=user.id, email=user.email or "")


def get_current_profile(user: AuthUser = Depends(get_current_user)) -> CurrentProfile:
    """Like get_current_user, but also resolves the caller's org, plan, and
    effective entitlements (plan base + purchased add-ons) so an endpoint can
    enforce limits. Reuses the JWT validation from get_current_user."""
    org_id, plan, ent = resolve_entitlements_for_user(user.id)
    return CurrentProfile(
        id=user.id,
        email=user.email,
        organization_id=org_id,
        plan=plan,
        entitlements=ent,
    )
