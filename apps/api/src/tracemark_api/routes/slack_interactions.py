"""Slack interactivity endpoint — powers the "Confirm demo" button + modal.

Two-way flow (the demo notification message → a confirmed demo, without leaving Slack):

  1. Staff click "✅ Confirm demo" on the demo-lead Slack message. Slack sends us a
     ``block_actions`` payload → we open a MODAL (views.open) listing the customer's
     requested slots as radio buttons plus a text field for the video-meeting link.
  2. Staff pick a time, paste the link and hit Confirm. Slack sends a ``view_submission``
     payload → we confirm the demo: update ``sales_leads`` (same row the admin portal
     writes), email the customer their confirmed slot, write an audit row, and rewrite the
     original Slack message to "✅ Confirmed".

Slack demands an HTTP response within 3 seconds, so the slow confirm work (DB write +
Resend email) runs in a FastAPI BackgroundTask; the handler returns immediately.

Auth is the Slack request SIGNATURE (SLACK_SIGNING_SECRET, verified in services/slack.py).
The Slack workspace itself is the trust boundary — only staff are in it — which mirrors
the ``leads.confirm`` permission that gates the same action in the admin portal. The
confirmation writes the SAME ``sales_leads`` table as the admin portal, so it reflects on
both sides (satisfying the admin-parity rule), and audits with the Slack user as the actor.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from urllib.parse import parse_qs

from fastapi import APIRouter, BackgroundTasks, Request, Response
from fastapi.responses import JSONResponse

from tracemark_api.services.database import get_supabase
from tracemark_api.services.slack import (
    respond_via_response_url,
    slack_api,
    verify_slack_signature,
)

router = APIRouter(prefix="/slack", tags=["slack"])
_log = logging.getLogger(__name__)

# These strings tie the button (leads.py) to the modal to this handler. Keep in sync.
CONFIRM_ACTION_ID = "confirm_demo"
CONFIRM_MODAL_CALLBACK = "confirm_demo_modal"

COMPANY_TIMEZONE = "Europe/Vilnius"  # staff-facing "our time" for the slot picker


@router.post("/interactions")
async def slack_interactions(request: Request, background: BackgroundTasks) -> Response:
    """Single Request URL for all Slack interactive payloads (buttons + modals)."""
    raw = await request.body()
    if not verify_slack_signature(
        request.headers.get("X-Slack-Request-Timestamp"),
        request.headers.get("X-Slack-Signature"),
        raw,
    ):
        return Response(status_code=401)

    # Slack delivers interactions form-encoded as a single ``payload=<json>`` field.
    form = parse_qs(raw.decode("utf-8"))
    payload_raw = (form.get("payload") or [""])[0]
    if not payload_raw:
        return Response(status_code=200)
    try:
        payload = json.loads(payload_raw)
    except json.JSONDecodeError:
        return Response(status_code=200)

    ptype = payload.get("type")
    if ptype == "block_actions":
        _handle_block_action(payload)
        return Response(status_code=200)
    if ptype == "view_submission":
        return _handle_view_submission(payload, background)
    return Response(status_code=200)


# ── Step 1: button click → open the confirm modal ────────────────────────────
def _handle_block_action(payload: dict) -> None:
    action = next(
        (a for a in (payload.get("actions") or []) if a.get("action_id") == CONFIRM_ACTION_ID),
        None,
    )
    if not action:
        return
    trigger_id = payload.get("trigger_id")
    response_url = payload.get("response_url")
    try:
        value = json.loads(action.get("value") or "{}")
    except json.JSONDecodeError:
        value = {}

    lead_id = value.get("lead_id")
    slots = value.get("slots") or []
    tz = value.get("tz")
    if not trigger_id or not lead_id or not slots:
        return

    slack_api(
        "views.open",
        {"trigger_id": trigger_id, "view": _confirm_modal(lead_id, slots, tz, response_url)},
    )


def _compact_slot_label(iso: str) -> str:
    """A short, staff-facing label (our time) that fits Slack's 75-char option limit.

    The customer still gets their OWN timezone in the confirmation email; here staff only
    need to recognise which slot to pick, so we show it in the company timezone.
    """
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except ValueError:
        return iso[:75]
    try:
        from zoneinfo import ZoneInfo

        local = dt.astimezone(ZoneInfo(COMPANY_TIMEZONE))
        return (local.strftime("%a %d %b, %H:%M") + " (our time)")[:75]
    except Exception:  # noqa: BLE001
        return (dt.strftime("%a %d %b, %H:%M") + " UTC")[:75]


def _confirm_modal(lead_id: str, slots: list[str], tz: str | None, response_url: str | None) -> dict:
    """Build the Slack modal: a radio list of the requested slots + a meeting-link input."""
    options = [
        {"text": {"type": "plain_text", "text": _compact_slot_label(iso)}, "value": iso}
        for iso in slots[:10]
    ]
    return {
        "type": "modal",
        "callback_id": CONFIRM_MODAL_CALLBACK,
        # Carry everything the submission handler needs — Slack echoes this back verbatim.
        "private_metadata": json.dumps({"lead_id": lead_id, "tz": tz, "response_url": response_url}),
        "title": {"type": "plain_text", "text": "Confirm demo"},
        "submit": {"type": "plain_text", "text": "Confirm & email"},
        "close": {"type": "plain_text", "text": "Cancel"},
        "blocks": [
            {
                "type": "input",
                "block_id": "slot_block",
                "label": {"type": "plain_text", "text": "Which time works?"},
                "element": {
                    "type": "radio_buttons",
                    "action_id": "slot",
                    "options": options,
                    "initial_option": options[0],
                },
            },
            {
                "type": "input",
                "block_id": "link_block",
                "optional": True,
                "label": {"type": "plain_text", "text": "Video meeting link (Meet / Zoom)"},
                "element": {
                    "type": "plain_text_input",
                    "action_id": "meeting_link",
                    "placeholder": {"type": "plain_text", "text": "https://meet.google.com/…"},
                },
            },
        ],
    }


# ── Step 2: modal submit → confirm the demo (in the background) ───────────────
def _handle_view_submission(payload: dict, background: BackgroundTasks) -> Response:
    view = payload.get("view", {})
    if view.get("callback_id") != CONFIRM_MODAL_CALLBACK:
        return Response(status_code=200)

    try:
        meta = json.loads(view.get("private_metadata") or "{}")
    except json.JSONDecodeError:
        meta = {}
    lead_id = meta.get("lead_id")
    tz = meta.get("tz")
    response_url = meta.get("response_url")

    state = view.get("state", {}).get("values", {})
    slot_sel = state.get("slot_block", {}).get("slot", {}).get("selected_option") or {}
    scheduled_at = slot_sel.get("value")
    link_val = state.get("link_block", {}).get("meeting_link", {}).get("value")
    meeting_link = (link_val or "").strip() or None

    user = payload.get("user", {})
    slack_user = user.get("username") or user.get("name") or user.get("id") or "slack"

    if not lead_id or not scheduled_at:
        # Inline modal error on the slot field (keeps the modal open).
        return JSONResponse(
            {"response_action": "errors", "errors": {"slot_block": "Pick a time to confirm."}}
        )

    # Heavy lifting off the 3-second response budget.
    background.add_task(
        _confirm_demo, lead_id, scheduled_at, tz, meeting_link, slack_user, response_url
    )
    # Empty 200 closes the modal immediately.
    return Response(status_code=200)


def _confirm_demo(
    lead_id: str,
    scheduled_at: str,
    tz: str | None,
    meeting_link: str | None,
    slack_user: str,
    response_url: str | None,
) -> None:
    """Confirm the demo end-to-end. Mirrors admin-api ``confirm_lead`` but actor = Slack."""
    from tracemark_api.routes.leads import format_slot

    sb = get_supabase()
    try:
        res = sb.table("sales_leads").select("*").eq("id", lead_id).maybe_single().execute()
    except Exception:  # noqa: BLE001
        _log.exception("[Slack confirm] failed to fetch lead %s", lead_id)
        return
    if not res or not res.data:
        _log.warning("[Slack confirm] lead %s not found", lead_id)
        if response_url:
            respond_via_response_url(
                response_url,
                {"replace_original": False, "text": ":warning: Could not confirm — lead not found."},
            )
        return
    lead = res.data
    scheduled_timezone = tz or lead.get("scheduled_timezone")

    update: dict = {
        "confirmed_at": datetime.now(timezone.utc).isoformat(),
        "meeting_link": meeting_link,
        "status": "contacted",  # confirming means we're now engaged with them
        "scheduled_at": scheduled_at,
    }
    if scheduled_timezone:
        update["scheduled_timezone"] = scheduled_timezone
    try:
        sb.table("sales_leads").update(update).eq("id", lead_id).execute()
    except Exception:  # noqa: BLE001
        _log.exception("[Slack confirm] failed to update lead %s", lead_id)
        return

    email_ok = _send_confirmation_email(
        lead.get("email"), lead.get("first_name"), scheduled_at, scheduled_timezone, meeting_link
    )
    _write_slack_audit(
        lead_id, lead.get("org_id"), scheduled_at, scheduled_timezone, meeting_link, slack_user
    )

    if response_url:
        label = format_slot(scheduled_at, scheduled_timezone) or scheduled_at
        _update_source_message(response_url, lead, label, meeting_link, slack_user, email_ok)


def _send_confirmation_email(
    email: str | None,
    first_name: str | None,
    scheduled_at: str,
    scheduled_timezone: str | None,
    meeting_link: str | None,
) -> bool:
    """Same confirmation email the admin-portal path sends (Resend pipeline)."""
    if not email:
        return False
    try:
        from tracemark_api.routes.leads import format_slot
        from tracemark_api.services.email import send_email
        from tracemark_api.services.email_templates import demo_confirmed_html

        confirmed_time = format_slot(scheduled_at, scheduled_timezone)
        if not confirmed_time:
            return False
        html = demo_confirmed_html(
            first_name=first_name, confirmed_time=confirmed_time, meeting_link=meeting_link
        )
        return bool(send_email(to=email, subject="Your HAKKIU demo is confirmed", html=html))
    except Exception:  # noqa: BLE001
        _log.exception("[Slack confirm] confirmation email failed")
        return False


def _write_slack_audit(
    lead_id: str,
    org_id: str | None,
    scheduled_at: str,
    scheduled_timezone: str | None,
    meeting_link: str | None,
    slack_user: str,
) -> None:
    """Append-only audit row — parity with admin-api confirm_lead; actor is the Slack user."""
    try:
        get_supabase().table("admin_audit_log").insert(
            {
                "staff_id": None,  # no staff session — this came from Slack
                "staff_email": f"slack:{slack_user}",
                "action": "leads.confirm_demo",
                "target_type": "sales_lead",
                "target_id": lead_id,
                "target_org_id": org_id,
                "metadata": {
                    "scheduled_at": scheduled_at,
                    "scheduled_timezone": scheduled_timezone,
                    "meeting_link": meeting_link,
                    "via": "slack",
                },
                "ip": None,
            }
        ).execute()
    except Exception:  # noqa: BLE001
        _log.exception("[Slack confirm] audit write failed")


def _update_source_message(
    response_url: str,
    lead: dict,
    label: str,
    meeting_link: str | None,
    slack_user: str,
    email_ok: bool,
) -> None:
    """Rewrite the original demo notification into a confirmed summary."""
    name = " ".join(p for p in (lead.get("first_name"), lead.get("last_name")) if p) or lead.get(
        "email"
    )
    lines = [f":white_check_mark: *Demo confirmed* — {name}", f"*When:* {label}"]
    if meeting_link:
        lines.append(f"*Link:* {meeting_link}")
    footer = f"*Confirmed by:* {slack_user}"
    if not email_ok:
        footer += "  :warning: _confirmation email failed to send_"
    lines.append(footer)

    respond_via_response_url(
        response_url,
        {
            "replace_original": True,
            "text": f":white_check_mark: Demo confirmed — {name}",
            "blocks": [{"type": "section", "text": {"type": "mrkdwn", "text": "\n".join(lines)}}],
        },
    )
