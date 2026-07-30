"""Public endpoint for demo/call lead capture.

POST /api/v1/leads — no auth required; rate-limited to 3 requests/hour per IP.
Stores exactly what the Book-a-demo / Talk-to-sales forms submit; the lead's
origin is carried by `source` (request_demo / call_request).
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

# Anti-spam rate limit for the public lead endpoint. Defaults to 3/hour per IP
# in production; override locally (e.g. LEADS_RATE_LIMIT=1000/hour) so testing
# the demo/sales forms isn't blocked after a few submits.
_RATE_LIMIT = os.environ.get("LEADS_RATE_LIMIT", "3/hour")

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
    email: EmailStr
    source: str | None = None           # "pricing_modal" | "request_demo" | "call_request"
    first_name: str | None = None
    last_name: str | None = None
    company: str | None = None
    brand_count_range: str | None = None
    message: str | None = None
    # Pre-demo qualification fields (captured by the /request-demo wizard)
    role: str | None = None             # job title / role
    website: str | None = None          # company website / domain
    phone: str | None = None            # optional phone number
    regions: list[str] | None = None    # markets they sell in
    brand_names: str | None = None      # free-text list of brands to protect
    marketplaces: list[str] | None = None   # marketplaces where they see abuse
    current_solution: str | None = None      # how they handle it today
    primary_goal: list[str] | None = None    # what they want to solve
    # Demo scheduling (Book-a-demo "Select a Date & Time" step). A REQUEST, not a
    # locked booking — the visitor offers several times they're free and staff
    # confirm one later in the Admin Portal.
    proposed_slots: list[str] | None = None   # ISO-8601 UTC instants the visitor is available
    scheduled_at: str | None = None           # legacy single slot (kept for back-compat)
    scheduled_timezone: str | None = None     # IANA tz the visitor picked in (e.g. "Europe/Vilnius")


# Friendly labels for the staff notification subject line, keyed by lead source.
_SOURCE_SUBJECTS = {
    "request_demo": "Book a demo",
    "call_request": "Talk to sales",
    "pricing_modal": "Pricing enquiry",
}


def _lead_kind(lead: LeadRequest) -> str:
    """Which confirmation copy to send the lead: 'sales' for Talk-to-sales,
    'demo' for everything else (Book-a-demo / pricing)."""
    return "sales" if lead.source == "call_request" else "demo"


def format_slot(iso: str | None, tz: str | None) -> str | None:
    """Render a stored UTC slot in the visitor's timezone for humans.

    e.g. ("2026-08-05T11:00:00+00:00", "Europe/Vilnius") ->
         "Tuesday, 05 August 2026 at 14:00 (Europe/Vilnius)".
    Falls back to UTC (or None) if the input can't be parsed.
    """
    if not iso:
        return None
    from datetime import datetime

    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except ValueError:
        return None
    if tz:
        try:
            from zoneinfo import ZoneInfo

            dt = dt.astimezone(ZoneInfo(tz))
            return dt.strftime("%A, %d %B %Y at %H:%M") + f" ({tz})"
        except Exception:  # noqa: BLE001 — unknown tz name, fall through to UTC
            pass
    return dt.strftime("%A, %d %B %Y at %H:%M") + " (UTC)"


def _lead_slots(lead: LeadRequest) -> list[str]:
    """The visitor's offered slots, formatted for humans (multi- or single-slot)."""
    raw = lead.proposed_slots or ([lead.scheduled_at] if lead.scheduled_at else [])
    formatted = [format_slot(iso, lead.scheduled_timezone) for iso in raw]
    return [f for f in formatted if f]


def _send_lead_notification(lead: LeadRequest) -> None:
    """Internal alert to the sales team that a new lead came in."""
    try:
        from tracemark_api.services.email import send_email
        from tracemark_api.services.email_templates import new_lead_html

        html = new_lead_html(
            source=lead.source,
            first_name=lead.first_name,
            last_name=lead.last_name,
            email=str(lead.email),
            company=lead.company,
            brand_count_range=lead.brand_count_range,
            message=lead.message,
            role=lead.role,
            website=lead.website,
            phone=lead.phone,
            regions=lead.regions,
            brand_names=lead.brand_names,
            marketplaces=lead.marketplaces,
            current_solution=lead.current_solution,
            primary_goal=lead.primary_goal,
            requested_times=_lead_slots(lead),
        )
        kind_label = _SOURCE_SUBJECTS.get(lead.source or "", "sales")
        subject = f"New {kind_label} lead — {lead.email}"
        for recipient in _NOTIFY_EMAILS:
            send_email(to=recipient, subject=subject, html=html)
    except Exception:
        _log.exception("Failed to send lead notification email")


def _send_lead_confirmation(lead: LeadRequest) -> None:
    """Auto-confirmation to the person who submitted the form."""
    try:
        from tracemark_api.services.email import send_email
        from tracemark_api.services.email_templates import lead_confirmation_html

        kind = _lead_kind(lead)
        html = lead_confirmation_html(
            kind=kind,
            first_name=lead.first_name,
            requested_times=_lead_slots(lead),
        )
        subject = (
            "Thanks for booking a demo with HAKKIU"
            if kind == "demo"
            else "We've received your message — HAKKIU"
        )
        send_email(to=str(lead.email), subject=subject, html=html)
    except Exception:
        _log.exception("Failed to send lead confirmation email")


@router.post("", status_code=201)
@_limiter.limit(_RATE_LIMIT)
async def create_lead(payload: LeadRequest, request: Request) -> dict:
    from fastapi import HTTPException

    if payload.brand_count_range is not None and payload.brand_count_range not in VALID_BRAND_RANGES:
        raise HTTPException(status_code=422, detail="invalid brand_count_range")

    if payload.source is not None and payload.source not in VALID_SOURCES:
        raise HTTPException(status_code=422, detail="invalid source")

    sb = get_supabase()
    sb.table("sales_leads").insert({
        "source": payload.source,
        "first_name": payload.first_name or None,
        "last_name": payload.last_name or None,
        "email": str(payload.email),
        "company": payload.company or None,
        "brand_count_range": payload.brand_count_range or None,
        "message": payload.message,
        "role": payload.role or None,
        "website": payload.website or None,
        "phone": payload.phone or None,
        "regions": payload.regions or None,
        "brand_names": payload.brand_names or None,
        "marketplaces": payload.marketplaces or None,
        "current_solution": payload.current_solution or None,
        "primary_goal": payload.primary_goal or None,
        "proposed_slots": payload.proposed_slots or None,
        "scheduled_at": payload.scheduled_at or None,
        "scheduled_timezone": payload.scheduled_timezone or None,
    }).execute()

    _send_lead_notification(payload)
    _send_lead_confirmation(payload)

    return {"ok": True}
