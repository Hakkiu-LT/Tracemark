from __future__ import annotations

from fastapi import Header, HTTPException
from tracemark_api.services.database import get_supabase


class AuthUser:
    def __init__(self, id: str, email: str):
        self.id = id
        self.email = email


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
