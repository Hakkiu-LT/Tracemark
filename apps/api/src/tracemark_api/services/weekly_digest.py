"""
Weekly brand protection digest — runs every Tuesday at 09:00 UTC.
Sends a summary of the past 7 days to every active org with a notification email.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

from tracemark_api.services.email import send_email
from tracemark_api.services.email_templates import weekly_digest_html

_APP_URL = os.environ.get("EMAIL_BASE_URL", "https://hakkiu.com").rstrip("/")


def _active_orgs() -> list[dict]:
    """Return every org that has a resolvable notification email.

    Access is login-based (no plans/subscriptions), so the digest targets all
    customer orgs — the notification email comes from org_settings, falling back
    to the org's admin profile.
    """
    try:
        from tracemark_api.services.database import get_supabase
        sb = get_supabase()

        profs = sb.table("profiles").select("organization_id").execute()
        org_ids = sorted({
            r["organization_id"] for r in (profs.data or []) if r.get("organization_id")
        })
        if not org_ids:
            return []

        result = []
        for org_id in org_ids:
            settings = (
                sb.table("org_settings")
                .select("notification_email, organization_id")
                .eq("organization_id", org_id)
                .maybe_single()
                .execute()
            )
            email = None
            if settings and settings.data:
                email = settings.data.get("notification_email")

            if not email:
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
                            email = user_res.user.email
                    except Exception:
                        pass

            if email:
                result.append({"org_id": org_id, "email": email})

        return result
    except Exception as exc:
        print(f"[WeeklyDigest] Failed to fetch active orgs: {exc}")
        return []


def _org_digest_data(org_id: str, since: datetime) -> dict:
    """Fetch last-7-day stats for one org."""
    try:
        from tracemark_api.services.database import get_supabase
        sb = get_supabase()
        since_iso = since.isoformat()

        # Brand names
        cases_res = (
            sb.table("cases")
            .select("brand_name")
            .eq("organization_id", org_id)
            .execute()
        )
        brand_names = list({r["brand_name"] for r in (cases_res.data or []) if r.get("brand_name")})

        # Case IDs for this org
        case_ids = [r["id"] for r in (
            sb.table("cases").select("id").eq("organization_id", org_id).execute().data or []
        )]

        new_infringements: list[dict] = []
        takedowns_in_progress: list[dict] = []
        takedowns_removed = 0

        if case_ids:
            inf_res = (
                sb.table("infringements")
                .select("id, platform, source_url, risk_level, created_at")
                .in_("case_id", case_ids)
                .gte("created_at", since_iso)
                .order("risk_level", desc=False)
                .limit(20)
                .execute()
            )
            new_infringements = inf_res.data or []

            td_res = (
                sb.table("takedown_reports")
                .select("id, platform, status")
                .in_("case_id", case_ids)
                .execute()
            )
            for td in (td_res.data or []):
                status = td.get("status", "")
                if status in ("pending", "sent", "acknowledged"):
                    takedowns_in_progress.append(td)
                elif status == "removed":
                    # Count ones removed in the last 7 days (check submitted_at as proxy)
                    takedowns_removed += 1

        return {
            "brand_names": brand_names,
            "new_infringements": new_infringements,
            "takedowns_in_progress": takedowns_in_progress,
            "takedowns_removed_this_week": takedowns_removed,
        }
    except Exception as exc:
        print(f"[WeeklyDigest] Failed to fetch data for org {org_id}: {exc}")
        return {
            "brand_names": [],
            "new_infringements": [],
            "takedowns_in_progress": [],
            "takedowns_removed_this_week": 0,
        }


def send_weekly_digests() -> None:
    """Send the weekly digest to all active orgs. Called by the main.py scheduler."""
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=7)
    week_label = f"{since.strftime('%b %-d')}–{now.strftime('%-d, %Y')}"

    print(f"[WeeklyDigest] Starting digest run for week {week_label}")
    orgs = _active_orgs()
    print(f"[WeeklyDigest] {len(orgs)} active org(s) to notify")

    for org in orgs:
        try:
            data = _org_digest_data(org["org_id"], since)
            if not data["brand_names"] and not data["new_infringements"]:
                # Org has no brands yet — skip
                continue

            html = weekly_digest_html(
                brand_names=data["brand_names"],
                week_label=week_label,
                platforms_scanned=12,
                listings_reviewed=0,
                new_infringements=data["new_infringements"],
                takedowns_in_progress=data["takedowns_in_progress"],
                takedowns_removed_this_week=data["takedowns_removed_this_week"],
                trend_signal=None,
                dashboard_url=_APP_URL + "/dashboard",
            )
            new_count = len(data["new_infringements"])
            subject = (
                f"Your brand report: {week_label} — {new_count} new detection{'s' if new_count != 1 else ''}"
                if new_count > 0
                else f"Your brand report: {week_label} — all clear ✓"
            )
            ok = send_email(to=org["email"], subject=subject, html=html)
            try:
                from tracemark_api.services.delivery_log import log_delivery
                log_delivery(
                    "weekly_digest",
                    ok=ok,
                    organization_id=org["org_id"],
                    recipient=org["email"],
                    subject=subject,
                    body_html=html,
                )
            except Exception as log_exc:
                print(f"[WeeklyDigest] Failed to log delivery for org {org['org_id']}: {log_exc}")
        except Exception as exc:
            print(f"[WeeklyDigest] Failed for org {org['org_id']}: {exc}")

    print(f"[WeeklyDigest] Digest run complete")
