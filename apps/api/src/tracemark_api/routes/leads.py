"""Public endpoint for Professional/Enterprise pricing lead capture.

POST /api/v1/leads — no auth required; rate-limited to 3 requests/hour per IP.
"""
from __future__ import annotations

import logging
import os

from fastapi import APIRouter, Request
from pydantic import BaseModel, EmailStr
from slowapi import Limiter
from slowapi.util import get_remote_address

from tracemark_api.services.database import get_supabase

router = APIRouter(prefix="/leads", tags=["leads"])

_limiter = Limiter(key_func=get_remote_address)
_log = logging.getLogger(__name__)

VALID_TIERS = frozenset({"professional", "enterprise"})
VALID_BRAND_RANGES = frozenset({"1", "2-3", "4-5", "6-10", "11-20", "20+"})
VALID_SOURCES = frozenset({"pricing_modal", "request_demo", "call_request"})

_NOTIFY_EMAILS = [
    e.strip()
    for e in os.environ.get(
        "LEADS_NOTIFY_EMAILS",
        "mantas@hakkiu.com,modestas@hakkiu.com,gabriel@hakkiu.com,martynas@hakkiu.com,domantas@hakkiu.com",
    ).split(",")
    if e.strip()
]


class LeadRequest(BaseModel):
    tier: str                           # "professional" | "enterprise"
    email: EmailStr
    source: str | None = None           # "pricing_modal" | "request_demo" | "call_request"
    first_name: str | None = None
    last_name: str | None = None
    company: str | None = None
    brand_count_range: str | None = None
    message: str | None = None


def _send_lead_notification(lead: LeadRequest) -> None:
    try:
        from tracemark_api.services.email import send_email
        from tracemark_api.services.email_templates import new_lead_html

        html = new_lead_html(
            source=lead.source,
            tier=lead.tier,
            first_name=lead.first_name,
            last_name=lead.last_name,
            email=str(lead.email),
            company=lead.company,
            brand_count_range=lead.brand_count_range,
            message=lead.message,
        )
        subject = f"New {lead.tier.capitalize()} Lead — {lead.email}"
        for recipient in _NOTIFY_EMAILS:
            send_email(to=recipient, subject=subject, html=html)
    except Exception:
        _log.exception("Failed to send lead notification email")


@router.post("", status_code=201)
@_limiter.limit("3/hour")
async def create_lead(payload: LeadRequest, request: Request) -> dict:
    from fastapi import HTTPException

    if payload.tier not in VALID_TIERS:
        raise HTTPException(status_code=422, detail="tier must be 'professional' or 'enterprise'")

    if payload.brand_count_range is not None and payload.brand_count_range not in VALID_BRAND_RANGES:
        raise HTTPException(status_code=422, detail="invalid brand_count_range")

    if payload.source is not None and payload.source not in VALID_SOURCES:
        raise HTTPException(status_code=422, detail="invalid source")

    sb = get_supabase()
    sb.table("sales_leads").insert({
        "tier": payload.tier,
        "source": payload.source,
        "first_name": payload.first_name or None,
        "last_name": payload.last_name or None,
        "email": str(payload.email),
        "company": payload.company or None,
        "brand_count_range": payload.brand_count_range or None,
        "message": payload.message,
    }).execute()

    _send_lead_notification(payload)

    return {"ok": True}
