"""Meta (Facebook) token exchange, proxied to the main API.

The exchange writes the long-lived token into the main API's environment, so it must
run there; we call it service-to-service after checking `integrations.manage`.
"""
from __future__ import annotations

import os

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from tracemark_admin_api.dependencies import StaffPrincipal, require_permission
from tracemark_admin_api.services.audit import write_audit_log

router = APIRouter(prefix="/integrations/meta", tags=["integrations"])


class ExchangeTokenRequest(BaseModel):
    short_lived_token: str


@router.post("/exchange-token")
def exchange_token(
    request: Request,
    payload: ExchangeTokenRequest,
    staff: StaffPrincipal = Depends(require_permission("integrations.manage")),
):
    base = os.environ.get("MAIN_API_URL", "http://localhost:8000/api/v1").rstrip("/")
    secret = os.environ.get("INTERNAL_API_SECRET", "")
    try:
        resp = httpx.post(
            f"{base}/internal/meta/exchange-token",
            headers={"X-Internal-Secret": secret, "Content-Type": "application/json"},
            json={"short_lived_token": payload.short_lived_token},
            timeout=30.0,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Main API unreachable: {exc}")
    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)

    result = resp.json()
    write_audit_log(
        staff,
        "integrations.meta_token_exchange",
        target_type="integration",
        target_id="meta",
        metadata={"expires_at": result.get("expires_at")},
        ip=request.client.host if request.client else None,
    )
    return result
