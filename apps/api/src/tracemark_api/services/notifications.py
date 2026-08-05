"""
Email Notification Service.

send_email_notification(event, recipient) — sends one specific email to a known address.
dispatch_notifications(event)             — looks up the org's email from the event,
                                            then calls send_email_notification.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone

from tracemark_api.services.email import send_email
from tracemark_api.services.email_templates import (
    first_detection_html,
    infringement_alert_html,
    takedown_failed_html,
    takedown_removed_html,
    takedown_submitted_html,
    test_email_html,
)

_APP_URL = os.environ.get("EMAIL_BASE_URL", "https://hakkiu.com").rstrip("/")


# ─── Recipient lookup ─────────────────────────────────────────────────────────

def _recipient_for_org(org_id: str) -> str | None:
    """Return the notification email for an org — org_settings first, then profile fallback."""
    try:
        from tracemark_api.services.database import get_supabase
        sb = get_supabase()

        settings = (
            sb.table("org_settings")
            .select("notification_email")
            .eq("organization_id", org_id)
            .maybe_single()
            .execute()
        )
        if settings and settings.data:
            email = settings.data.get("notification_email")
            if email:
                return email

        member = (
            sb.table("organization_members")
            .select("user_id")
            .eq("organization_id", org_id)
            .eq("role", "owner")
            .limit(1)
            .execute()
        )
        if member and member.data:
            user_id = member.data[0]["user_id"]
            try:
                user_res = sb.auth.admin.get_user_by_id(user_id)
                if user_res and user_res.user and user_res.user.email:
                    return user_res.user.email
            except Exception:
                pass
    except Exception as exc:
        print(f"[Notifications] Failed to resolve recipient for org {org_id}: {exc}")
    return None


def _org_from_case(case_id: str) -> tuple[str | None, str | None]:
    """Return (organization_id, brand_name) from a case_id."""
    try:
        from tracemark_api.services.database import get_supabase
        sb = get_supabase()
        res = (
            sb.table("cases")
            .select("organization_id, brand_name")
            .eq("id", case_id)
            .maybe_single()
            .execute()
        )
        if res and res.data:
            return res.data.get("organization_id"), res.data.get("brand_name")
    except Exception as exc:
        print(f"[Notifications] Failed to resolve org from case {case_id}: {exc}")
    return None, None


def _infringement_details(infringement_id: str) -> dict:
    """Fetch key fields from an infringement row."""
    try:
        from tracemark_api.services.database import get_supabase
        sb = get_supabase()
        res = (
            sb.table("infringements")
            .select("case_id, platform, source_url, risk_level, match_score, screenshot_url")
            .eq("id", infringement_id)
            .maybe_single()
            .execute()
        )
        return res.data or {}
    except Exception:
        return {}


# ─── Public API ──────────────────────────────────────────────────────────────

def send_email_notification(event: dict, recipient_email: str) -> str | None:
    """
    Send an email for a specific event to a known recipient address.
    Used for: test emails, takedown notices sent to platforms, and admin-triggered sends.

    Returns the rendered HTML body that was sent (or None), so callers that log
    the delivery can persist the actual email body.
    """
    event_type = event.get("type", "unknown")

    if event_type == "test":
        brand_name = event.get("brand_name", "Test Brand")
        html = test_email_html(brand_name=brand_name)
        send_email(to=recipient_email, subject="HAKKIU — test email", html=html)
        return html

    if event_type == "takedown_submitted":
        case_id = event.get("case_id", "")
        html = takedown_submitted_html(
            brand_name=event.get("brand_name", "Your brand"),
            platform=event.get("platform", "marketplace"),
            listing_url=event.get("listing_url", ""),
            submitted_at=event.get("submitted_at", datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")),
            expected_days=event.get("expected_days", 7),
            case_id=case_id,
            dashboard_url=_APP_URL + "/dashboard",
        )
        send_email(
            to=recipient_email,
            subject=f"Takedown submitted — {event.get('platform', 'marketplace').title()}",
            html=html,
        )
        return html

    if event_type == "takedown_removed":
        html = takedown_removed_html(
            brand_name=event.get("brand_name", "Your brand"),
            platform=event.get("platform", "marketplace"),
            listing_url=event.get("listing_url", ""),
            removed_at=event.get("removed_at", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            days_to_removal=event.get("days_to_removal"),
            total_removed=event.get("total_removed"),
            case_id=event.get("case_id", ""),
            dashboard_url=_APP_URL + "/dashboard",
        )
        send_email(
            to=recipient_email,
            subject=f"✓ Listing removed — {event.get('brand_name', 'your brand')}",
            html=html,
        )
        return html

    if event_type == "takedown_failed":
        html = takedown_failed_html(
            brand_name=event.get("brand_name", "Your brand"),
            platform=event.get("platform", "marketplace"),
            listing_url=event.get("listing_url", ""),
            failure_reason=event.get("failure_reason"),
            counter_notice=event.get("counter_notice", False),
            recommended_action=event.get("recommended_action", "Please review this case and contact us if you need assistance."),
            case_id=event.get("case_id", ""),
            dashboard_url=_APP_URL + "/dashboard",
        )
        send_email(
            to=recipient_email,
            subject=f"Action needed: takedown not successful — {event.get('platform', 'marketplace').title()}",
            html=html,
        )
        return html

    # Fallback: send test email for unhandled types
    html = test_email_html(brand_name=event.get("brand_name", "HAKKIU"))
    send_email(to=recipient_email, subject="HAKKIU notification", html=html)
    return html


def dispatch_notifications(event: dict) -> None:
    """
    Resolve the recipient for an org-scoped event and send the appropriate email.
    Called from persist_infringement, case status changes, and document sends.

    Every exit path records one notification_deliveries row so the Admin Portal
    log is a true email log: `sent`/`failed` when an email is attempted, and
    `skipped` (with a reason) when the event intentionally sends nothing (e.g. a
    dismissal, a non-HIGH-risk detection, or a missing recipient).
    """
    from tracemark_api.services.delivery_log import log_delivery

    event_type = event.get("type", "unknown")

    # Resolve case_id from available event fields
    case_id = event.get("case_id")
    infringement_id = event.get("infringement_id")

    inf_data: dict = {}
    if infringement_id and not case_id:
        inf_data = _infringement_details(infringement_id)
        case_id = inf_data.get("case_id")

    def _skip(reason: str, organization_id: str | None = None, recipient: str | None = None) -> None:
        print(f"[Notifications] dispatch_notifications: {reason} (event {event_type})")
        try:
            log_delivery(
                event_type,
                status="skipped",
                infringement_id=infringement_id,
                payload=event,
                error=reason,
                organization_id=organization_id,
                recipient=recipient,
            )
        except Exception as exc:
            print(f"[Notifications] failed to log skipped delivery: {exc}")

    def _sent(subject: str, ok: bool, organization_id: str, recipient: str, body_html: str) -> None:
        try:
            log_delivery(
                event_type,
                ok=ok,
                infringement_id=infringement_id,
                payload=event,
                organization_id=organization_id,
                recipient=recipient,
                subject=subject,
                body_html=body_html,
                error=None if ok else "send_email returned False",
            )
        except Exception as exc:
            print(f"[Notifications] failed to log delivery: {exc}")

    if not case_id:
        return _skip("no case_id")

    org_id, brand_name = _org_from_case(case_id)
    if not org_id:
        return _skip(f"could not resolve org from case {case_id}")

    recipient = _recipient_for_org(org_id)
    if not recipient:
        return _skip(f"no recipient email for org {org_id}", organization_id=org_id)

    if not inf_data and infringement_id:
        inf_data = _infringement_details(infringement_id)

    dashboard_url = _APP_URL + "/dashboard"

    if event_type == "new_infringement":
        source_url = event.get("source_url") or inf_data.get("source_url", "")
        platform = event.get("platform") or inf_data.get("platform", "marketplace")
        risk_level = inf_data.get("risk_level", "HIGH")
        match_score = float(inf_data.get("match_score") or 0.85)
        # Private bucket (C5): the stored value is a bare path. Emails may be
        # opened days later, so mint a 7-day signed URL (a 1h one would 403).
        from tracemark_api.services.storage import sign_screenshot_url_long
        screenshot_url = sign_screenshot_url_long(inf_data.get("screenshot_url"))

        # Only email on HIGH risk to avoid alert fatigue
        if risk_level != "HIGH":
            return _skip(f"risk {risk_level} is not HIGH", organization_id=org_id, recipient=recipient)

        # Check if this is the org's first-ever infringement (aha moment)
        is_first = False
        try:
            from tracemark_api.services.database import get_supabase
            sb = get_supabase()
            case_ids = [
                r["id"] for r in (
                    sb.table("cases").select("id").eq("organization_id", org_id).execute().data or []
                )
            ]
            if case_ids:
                count_res = (
                    sb.table("infringements")
                    .select("id", count="exact")
                    .in_("case_id", case_ids)
                    .execute()
                )
                is_first = (count_res.count or 0) <= 1
        except Exception:
            pass

        if is_first:
            # Resolve user name for personalisation
            user_name = "there"
            try:
                from tracemark_api.services.database import get_supabase
                sb = get_supabase()
                m = sb.table("organization_members").select("user_id").eq("organization_id", org_id).eq("role", "owner").limit(1).execute()
                if m and m.data:
                    u_id = m.data[0]["user_id"]
                    pr = sb.table("profiles").select("full_name").eq("id", u_id).maybe_single().execute()
                    if pr and pr.data:
                        full = pr.data.get("full_name") or ""
                        user_name = full.split()[0] if full.strip() else "there"
            except Exception:
                pass

            html = first_detection_html(
                user_name=user_name,
                brand_name=brand_name or "your brand",
                detection_count=1,
                top_platform=platform,
                dashboard_url=dashboard_url,
            )
            subject = f"First scan complete — infringement detected for {brand_name}"
            ok = send_email(to=recipient, subject=subject, html=html)
        else:
            html = infringement_alert_html(
                brand_name=brand_name or "your brand",
                platform=platform,
                listing_url=source_url,
                risk_level=risk_level,
                match_score=match_score,
                screenshot_url=screenshot_url,
                case_id=case_id,
                infringement_id=infringement_id or "",
                dashboard_url=dashboard_url,
            )
            subject = f"[Alert] Infringement detected on {platform.title()} — {brand_name}"
            ok = send_email(to=recipient, subject=subject, html=html)
        return _sent(subject, ok, org_id, recipient, html)

    if event_type in ("case_escalated", "takedown_generated"):
        source_url = event.get("infringing_url") or inf_data.get("source_url", "")
        platform = event.get("platform") or inf_data.get("platform", "marketplace")
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        html = takedown_submitted_html(
            brand_name=brand_name or "your brand",
            platform=platform or "marketplace",
            listing_url=source_url,
            submitted_at=now_str,
            expected_days=7,
            case_id=case_id,
            dashboard_url=dashboard_url,
        )
        subject = f"Takedown notice prepared — {(platform or 'marketplace').title()}"
        ok = send_email(to=recipient, subject=subject, html=html)
        return _sent(subject, ok, org_id, recipient, html)

    if event_type == "case_dismissed":
        # No email for dismissals — customer took action intentionally
        return _skip("dismissal — no email sent", organization_id=org_id, recipient=recipient)

    return _skip(f"unhandled event '{event_type}'", organization_id=org_id, recipient=recipient)
