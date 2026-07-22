"""Public endpoint for Professional/Enterprise pricing lead capture.

POST /api/v1/leads — no auth required; rate-limited to 3 requests/hour per IP.
"""
from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel, EmailStr
from slowapi import Limiter
from slowapi.util import get_remote_address

from tracemark_api.services.database import get_supabase

router = APIRouter(prefix="/leads", tags=["leads"])

_limiter = Limiter(key_func=get_remote_address)


class LeadRequest(BaseModel):
    tier: str  # "professional" | "enterprise"
    first_name: str
    last_name: str
    email: EmailStr
    company: str
    brand_count_range: str  # "1-5" | "6-20" | "20+"
    message: str | None = None


@router.post("", status_code=201)
@_limiter.limit("3/hour")
async def create_lead(payload: LeadRequest, request: Request) -> dict:
    if payload.tier not in ("professional", "enterprise"):
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail="tier must be 'professional' or 'enterprise'")

    if payload.brand_count_range not in ("1-5", "6-20", "20+"):
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail="invalid brand_count_range")

    sb = get_supabase()
    sb.table("sales_leads").insert({
        "tier": payload.tier,
        "first_name": payload.first_name,
        "last_name": payload.last_name,
        "email": payload.email,
        "company": payload.company,
        "brand_count_range": payload.brand_count_range,
        "message": payload.message,
    }).execute()

    return {"ok": True}
