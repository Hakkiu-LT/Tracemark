from __future__ import annotations

from fastapi import Depends, Header, HTTPException

from tracemark_api.services.database import get_supabase


class AuthUser:
    def __init__(self, id: str, email: str):
        self.id = id
        self.email = email


class CurrentProfile:
    """Authenticated user resolved to their organization and group role."""

    def __init__(self, id: str, email: str, organization_id: str, org_role: str = "owner"):
        self.id = id
        self.email = email
        self.organization_id = organization_id
        self.org_role = org_role


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


def _resolve_org_and_role(user_id: str) -> tuple[str, str]:
    """Resolves the caller's organization_id and their role within that organization ('owner' or 'member')."""
    sb = get_supabase()
    res = (
        sb.table("profiles")
        .select("organization_id")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    org_id = res.data.get("organization_id") if res and res.data else None
    org_id = org_id or user_id

    mem_res = (
        sb.table("organization_members")
        .select("role")
        .eq("organization_id", org_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    role = mem_res.data.get("role") if mem_res and mem_res.data else "owner"
    return org_id, role or "owner"


def get_current_profile(user: AuthUser = Depends(get_current_user)) -> CurrentProfile:
    """Like get_current_user, but also resolves the caller's organization and role.
    Reuses the JWT validation from get_current_user."""
    org_id, role = _resolve_org_and_role(user.id)
    return CurrentProfile(
        id=user.id,
        email=user.email,
        organization_id=org_id,
        org_role=role,
    )


def require_owner(profile: CurrentProfile = Depends(get_current_profile)) -> CurrentProfile:
    """Enforces that the caller has the 'owner' write role in their active organization."""
    if profile.org_role != "owner":
        raise HTTPException(status_code=403, detail="Owner role required for write actions in this organization")
    return profile

