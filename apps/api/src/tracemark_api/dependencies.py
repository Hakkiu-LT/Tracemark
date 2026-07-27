from __future__ import annotations

from fastapi import Depends, Header, HTTPException
from tracemark_api.services.database import get_supabase


class AuthUser:
    def __init__(self, id: str, email: str):
        self.id = id
        self.email = email


class CurrentProfile:
    """Authenticated user resolved to their organization. Every logged-in user
    has full access — there are no plan/entitlement limits."""

    def __init__(self, id: str, email: str, organization_id: str):
        self.id = id
        self.email = email
        self.organization_id = organization_id


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


def _resolve_org_id(user_id: str) -> str:
    """The caller's organization, or their own id as a single-member fallback
    when no organization is configured."""
    sb = get_supabase()
    res = (
        sb.table("profiles")
        .select("organization_id")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    org_id = res.data.get("organization_id") if res and res.data else None
    return org_id or user_id


def get_current_profile(user: AuthUser = Depends(get_current_user)) -> CurrentProfile:
    """Like get_current_user, but also resolves the caller's organization.
    Reuses the JWT validation from get_current_user."""
    return CurrentProfile(
        id=user.id,
        email=user.email,
        organization_id=_resolve_org_id(user.id),
    )
