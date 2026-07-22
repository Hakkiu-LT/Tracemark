"""Shared SlowAPI rate limiter. Keyed per authenticated user (falls back to client IP)."""
from __future__ import annotations

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address


def _user_key(request: Request) -> str:
    """Rate-limit key: bearer token (unique per user) or remote IP as fallback."""
    auth = request.headers.get("authorization")
    if auth:
        return auth
    return get_remote_address(request)


limiter = Limiter(key_func=_user_key)
