from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from tracemark_api.services.database import get_supabase

router = APIRouter(tags=["auth"])


class UserProfile(BaseModel):
    id: str
    email: str | None
    full_name: str | None
    avatar_url: str | None
    plan: str
    organization_id: str | None


@router.get("/me", response_model=UserProfile)
def get_me(authorization: str = Header(...)):
    """
    Return the authenticated user's profile.

    Requires: Authorization: Bearer <supabase_jwt>
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

    profile_resp = (
        sb.table("profiles").select("*").eq("id", user.id).maybe_single().execute()
    )
    profile = profile_resp.data or {}

    return UserProfile(
        id=user.id,
        email=user.email,
        full_name=profile.get("full_name"),
        avatar_url=profile.get("avatar_url"),
        plan=profile.get("plan", "free"),
        organization_id=profile.get("organization_id"),
    )
