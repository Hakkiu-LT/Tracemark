"""
HTML email templates for HAKKIU.
All templates use the same base layout with the HAKKIU logo header.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone

# EMAIL_BASE_URL is used for all links/images in emails.
# Defaults to https://hakkiu.com so emails always contain real URLs even in local dev.
# Override in .env if needed: EMAIL_BASE_URL=https://hakkiu.com
_APP_URL = os.environ.get("EMAIL_BASE_URL", "https://hakkiu.com").rstrip("/")
# Logo is served from the customer app's public/ dir. It previously lived in the
# evidence-screenshots bucket via a public URL, but that bucket is now PRIVATE
# (C5) so the public logo URL would 400/404. The app-hosted asset is always
# reachable and needs no signing.
_LOGO_URL = f"{_APP_URL}/hakkiu-lockup.png"

_BRAND_COLOR = "#16a34a"   # green-600
_DARK = "#0f172a"          # slate-900
_LIGHT_BG = "#f8fafc"      # slate-50
_BORDER = "#e2e8f0"        # slate-200
_TEXT = "#334155"          # slate-700
_MUTED = "#64748b"         # slate-500


# ─── Base layout ─────────────────────────────────────────────────────────────

def _base(content: str, preheader: str = "") -> str:
    """Wrap content in the shared HAKKIU email shell."""
    preheader_html = (
        f'<span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">'
        f'{preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</span>'
    ) if preheader else ""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>HAKKIU</title>
</head>
<body style="margin:0;padding:0;background:{_LIGHT_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
{preheader_html}
<table width="100%" cellpadding="0" cellspacing="0" style="background:{_LIGHT_BG};padding:32px 0;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:{_DARK};border-radius:8px 8px 0 0;padding:24px 32px;text-align:left;">
            <img src="{_LOGO_URL}" alt="HAKKIU" height="36"
                 style="display:block;height:36px;border:0;" />
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;border-left:1px solid {_BORDER};border-right:1px solid {_BORDER};padding:32px;">
            {content}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:{_LIGHT_BG};border:1px solid {_BORDER};border-top:none;border-radius:0 0 8px 8px;padding:20px 32px;text-align:center;">
            <p style="margin:0;font-size:12px;color:{_MUTED};">
              © {datetime.now(timezone.utc).year} HAKKIU · Brand Protection Platform<br />
              <a href="{_APP_URL}/settings/notifications" style="color:{_MUTED};">Manage notification preferences</a>
              &nbsp;·&nbsp;
              <a href="{_APP_URL}/dashboard" style="color:{_MUTED};">Open dashboard</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>"""


def _btn(label: str, url: str, color: str = _BRAND_COLOR) -> str:
    return (
        f'<a href="{url}" style="display:inline-block;background:{color};color:#ffffff;'
        f'text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;'
        f'border-radius:6px;margin-top:16px;">{label} →</a>'
    )


def _divider() -> str:
    return f'<hr style="border:none;border-top:1px solid {_BORDER};margin:24px 0;" />'


def _risk_badge(risk: str) -> str:
    colors = {"HIGH": "#dc2626", "MEDIUM": "#d97706", "LOW": "#059669"}
    bg = colors.get(risk.upper(), "#6b7280")
    return (
        f'<span style="background:{bg};color:#fff;font-size:11px;font-weight:700;'
        f'padding:2px 8px;border-radius:4px;text-transform:uppercase;">{risk}</span>'
    )


def _stat(label: str, value: str) -> str:
    return (
        f'<td style="text-align:center;padding:16px;">'
        f'<div style="font-size:28px;font-weight:700;color:{_DARK};">{value}</div>'
        f'<div style="font-size:12px;color:{_MUTED};margin-top:4px;">{label}</div>'
        f'</td>'
    )


# ─── Templates ───────────────────────────────────────────────────────────────

def infringement_alert_html(
    *,
    brand_name: str,
    platform: str,
    listing_url: str,
    risk_level: str,
    match_score: float,
    screenshot_url: str | None,
    platform_display: str | None = None,
    case_id: str,
    infringement_id: str,
    dashboard_url: str,
) -> str:
    platform_label = platform_display or platform.title()
    score_pct = f"{int(match_score * 100)}%"
    screenshot_html = ""
    if screenshot_url:
        screenshot_html = (
            f'<p style="margin:16px 0 4px;font-size:13px;color:{_MUTED};">Evidence screenshot:</p>'
            f'<a href="{screenshot_url}"><img src="{screenshot_url}" alt="Screenshot" '
            f'style="max-width:100%;border-radius:4px;border:1px solid {_BORDER};" /></a>'
        )

    content = f"""
<h2 style="margin:0 0 4px;font-size:20px;color:{_DARK};">Possible infringement detected</h2>
<p style="margin:0 0 20px;color:{_MUTED};font-size:14px;">
  Brand: <strong>{brand_name}</strong> &nbsp;·&nbsp; Platform: <strong>{platform_label}</strong>
  &nbsp;·&nbsp; {_risk_badge(risk_level)} &nbsp; AI confidence: <strong>{score_pct}</strong>
</p>

<table width="100%" cellpadding="0" cellspacing="0"
       style="border:1px solid {_BORDER};border-radius:6px;background:{_LIGHT_BG};">
  <tr>
    <td style="padding:16px;">
      <p style="margin:0 0 8px;font-size:13px;color:{_MUTED};text-transform:uppercase;letter-spacing:.05em;">Infringing listing</p>
      <p style="margin:0;word-break:break-all;">
        <a href="{listing_url}" style="color:{_BRAND_COLOR};font-size:14px;">{listing_url}</a>
      </p>
    </td>
  </tr>
</table>

{screenshot_html}
{_divider()}
<p style="margin:0;font-size:14px;color:{_TEXT};">
  Choose an action — no login required:
</p>
{_btn("Review &amp; Approve Takedown", f"{dashboard_url}/monitoring/{case_id}")}
&nbsp;&nbsp;
<a href="{dashboard_url}/monitoring/{case_id}?dismiss=1"
   style="display:inline-block;color:{_MUTED};font-size:13px;margin-top:16px;text-decoration:underline;">
  Mark as false positive
</a>
<p style="margin:20px 0 0;font-size:12px;color:{_MUTED};">Case ID: {case_id}</p>
"""
    return _base(content, preheader=f"Possible infringement on {platform_label} — {brand_name}")


def domain_alert_html(
    *,
    brand_name: str,
    domain: str,
    risk_level: str,
    registration_date: str | None,
    has_mx: bool = False,
    case_id: str,
    dashboard_url: str,
) -> str:
    mx_warning = ""
    if has_mx:
        mx_warning = (
            f'<p style="margin:8px 0 0;font-size:13px;color:#dc2626;">'
            f'⚠ This domain has mail servers configured — potential phishing setup.</p>'
        )
    reg_html = (
        f'<p style="margin:4px 0 0;font-size:13px;color:{_MUTED};">Registered: {registration_date}</p>'
        if registration_date else ""
    )

    content = f"""
<h2 style="margin:0 0 4px;font-size:20px;color:{_DARK};">Lookalike domain detected</h2>
<p style="margin:0 0 20px;color:{_MUTED};font-size:14px;">
  Brand: <strong>{brand_name}</strong> &nbsp;·&nbsp; {_risk_badge(risk_level)}
</p>

<table width="100%" cellpadding="0" cellspacing="0"
       style="border:1px solid {_BORDER};border-radius:6px;background:{_LIGHT_BG};">
  <tr>
    <td style="padding:16px;">
      <p style="margin:0 0 4px;font-size:13px;color:{_MUTED};text-transform:uppercase;letter-spacing:.05em;">Suspicious domain</p>
      <p style="margin:0;font-size:18px;font-weight:700;color:{_DARK};">{domain}</p>
      {reg_html}
      {mx_warning}
    </td>
  </tr>
</table>

{_divider()}
<p style="margin:0 0 4px;font-size:14px;color:{_TEXT};">
  This domain closely resembles your brand and could be used for phishing or to sell counterfeit products.
</p>
{_btn("Review Domain Case", f"{dashboard_url}/monitoring/{case_id}")}
<p style="margin:20px 0 0;font-size:12px;color:{_MUTED};">Case ID: {case_id}</p>
"""
    return _base(content, preheader=f"Suspicious domain '{domain}' may be impersonating {brand_name}")


def takedown_submitted_html(
    *,
    brand_name: str,
    platform: str,
    listing_url: str,
    submitted_at: str,
    expected_days: int = 7,
    case_id: str,
    dashboard_url: str,
) -> str:
    content = f"""
<h2 style="margin:0 0 4px;font-size:20px;color:{_DARK};">Takedown notice sent ✓</h2>
<p style="margin:0 0 20px;color:{_MUTED};font-size:14px;">
  We've formally notified <strong>{platform.title()}</strong> about the infringing listing for <strong>{brand_name}</strong>.
</p>

<table width="100%" cellpadding="0" cellspacing="0"
       style="border:1px solid {_BORDER};border-radius:6px;background:{_LIGHT_BG};">
  <tr>
    <td style="padding:16px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:4px 0;font-size:13px;color:{_MUTED};width:140px;">Platform</td>
          <td style="padding:4px 0;font-size:13px;color:{_DARK};font-weight:600;">{platform.title()}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;font-size:13px;color:{_MUTED};">Submitted</td>
          <td style="padding:4px 0;font-size:13px;color:{_DARK};">{submitted_at}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;font-size:13px;color:{_MUTED};">Expected response</td>
          <td style="padding:4px 0;font-size:13px;color:{_DARK};">{expected_days} business days</td>
        </tr>
        <tr>
          <td style="padding:4px 0;font-size:13px;color:{_MUTED};">Listing URL</td>
          <td style="padding:4px 0;font-size:13px;word-break:break-all;">
            <a href="{listing_url}" style="color:{_BRAND_COLOR};">{listing_url[:80]}{'...' if len(listing_url) > 80 else ''}</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>

{_divider()}
<p style="margin:0;font-size:14px;color:{_TEXT};">
  We'll notify you as soon as the listing is removed. You can track this case in your dashboard.
</p>
{_btn("Track Case", f"{dashboard_url}/monitoring/{case_id}")}
<p style="margin:20px 0 0;font-size:12px;color:{_MUTED};">Case ID: {case_id}</p>
"""
    return _base(content, preheader=f"Takedown notice submitted to {platform.title()} for {brand_name}")


def takedown_removed_html(
    *,
    brand_name: str,
    platform: str,
    listing_url: str,
    removed_at: str,
    days_to_removal: int | None = None,
    total_removed: int | None = None,
    case_id: str,
    dashboard_url: str,
) -> str:
    timing_html = ""
    if days_to_removal is not None:
        timing_html = (
            f'<p style="margin:4px 0 0;font-size:13px;color:{_MUTED};">'
            f'Time to removal: <strong>{days_to_removal} day{"s" if days_to_removal != 1 else ""}</strong></p>'
        )
    total_html = ""
    if total_removed:
        total_html = (
            f'<p style="margin:16px 0 0;font-size:14px;color:{_MUTED};text-align:center;">'
            f'🛡 <strong>{total_removed}</strong> total listings removed for your brand</p>'
        )

    content = f"""
<h2 style="margin:0 0 4px;font-size:20px;color:#16a34a;">Listing removed 🎉</h2>
<p style="margin:0 0 20px;color:{_MUTED};font-size:14px;">
  The infringing listing on <strong>{platform.title()}</strong> has been taken down.
  Your brand <strong>{brand_name}</strong> is protected.
</p>

<table width="100%" cellpadding="0" cellspacing="0"
       style="border:2px solid #16a34a;border-radius:6px;background:#f0fdf4;">
  <tr>
    <td style="padding:20px;text-align:center;">
      <div style="font-size:40px;margin-bottom:8px;">✓</div>
      <div style="font-size:16px;font-weight:700;color:#166534;">Listing Successfully Removed</div>
      <div style="font-size:13px;color:#166534;margin-top:4px;">{platform.title()} · {removed_at}</div>
      {timing_html}
    </td>
  </tr>
</table>

{total_html}
{_divider()}
{_btn("View Dashboard", f"{dashboard_url}/monitoring/{case_id}")}
<p style="margin:20px 0 0;font-size:12px;color:{_MUTED};">Case ID: {case_id}</p>
"""
    return _base(content, preheader=f"✓ Infringing listing removed from {platform.title()} — {brand_name}")


def takedown_failed_html(
    *,
    brand_name: str,
    platform: str,
    listing_url: str,
    failure_reason: str | None,
    counter_notice: bool = False,
    recommended_action: str = "Please review this case and contact us if you need assistance.",
    case_id: str,
    dashboard_url: str,
) -> str:
    reason_html = ""
    if failure_reason:
        reason_html = f'<p style="margin:8px 0 0;font-size:13px;color:#dc2626;">Reason: {failure_reason}</p>'
    counter_html = ""
    if counter_notice:
        counter_html = (
            f'<div style="margin-top:16px;padding:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;">'
            f'<p style="margin:0;font-size:13px;color:#991b1b;font-weight:600;">Counter-notice filed</p>'
            f'<p style="margin:4px 0 0;font-size:13px;color:#991b1b;">'
            f'The seller has filed a counter-notice. Under DMCA, you have 10 business days to seek a court order. '
            f'Contact a legal professional if you wish to proceed.</p>'
            f'</div>'
        )

    content = f"""
<h2 style="margin:0 0 4px;font-size:20px;color:#dc2626;">Takedown not successful</h2>
<p style="margin:0 0 20px;color:{_MUTED};font-size:14px;">
  The takedown notice for a listing on <strong>{platform.title()}</strong> was not actioned
  for <strong>{brand_name}</strong>.
</p>

<table width="100%" cellpadding="0" cellspacing="0"
       style="border:1px solid #fecaca;border-radius:6px;background:#fef2f2;">
  <tr>
    <td style="padding:16px;">
      <p style="margin:0;font-size:13px;color:#991b1b;font-weight:600;">Status: Not removed</p>
      {reason_html}
      <p style="margin:8px 0 0;font-size:13px;word-break:break-all;">
        <a href="{listing_url}" style="color:#dc2626;">{listing_url[:80]}{'...' if len(listing_url) > 80 else ''}</a>
      </p>
    </td>
  </tr>
</table>

{counter_html}
{_divider()}
<p style="margin:0 0 8px;font-size:14px;color:{_TEXT};font-weight:600;">Recommended next step</p>
<p style="margin:0;font-size:14px;color:{_TEXT};">{recommended_action}</p>
{_btn("Review Case", f"{dashboard_url}/monitoring/{case_id}")}
<p style="margin:20px 0 0;font-size:12px;color:{_MUTED};">Case ID: {case_id}</p>
"""
    return _base(content, preheader=f"Action needed: takedown not successful on {platform.title()}")


def weekly_digest_html(
    *,
    brand_names: list[str],
    week_label: str,
    platforms_scanned: int,
    listings_reviewed: int,
    new_infringements: list[dict],
    takedowns_in_progress: list[dict],
    takedowns_removed_this_week: int,
    trend_signal: str | None,
    dashboard_url: str,
) -> str:
    brand_label = ", ".join(brand_names[:3]) if brand_names else "your brand"
    new_count = len(new_infringements)
    headline = (
        f"{new_count} new infringement{'s' if new_count != 1 else ''} detected"
        if new_count > 0
        else "Your brand was clean this week ✓"
    )
    headline_color = "#dc2626" if new_count > 0 else "#16a34a"

    detections_html = ""
    if new_infringements:
        rows = ""
        for inf in new_infringements[:5]:
            url = inf.get("source_url", "")
            platform = inf.get("platform", "").title()
            risk = inf.get("risk_level", "MEDIUM")
            rows += f"""
<tr>
  <td style="padding:10px 0;border-bottom:1px solid {_BORDER};font-size:13px;color:{_TEXT};">
    {platform} &nbsp; {_risk_badge(risk)} &nbsp;
    <a href="{url}" style="color:{_BRAND_COLOR};word-break:break-all;">{url[:60]}{'...' if len(url) > 60 else ''}</a>
  </td>
</tr>"""
        if len(new_infringements) > 5:
            rows += f'<tr><td style="padding:8px 0;font-size:13px;color:{_MUTED};">+ {len(new_infringements) - 5} more — <a href="{dashboard_url}" style="color:{_BRAND_COLOR};">view all</a></td></tr>'
        detections_html = f"""
{_divider()}
<p style="margin:0 0 12px;font-size:14px;font-weight:600;color:{_DARK};">New detections this week</p>
<table width="100%" cellpadding="0" cellspacing="0">{rows}</table>"""

    in_progress_html = ""
    if takedowns_in_progress:
        rows = ""
        for td in takedowns_in_progress[:3]:
            platform = td.get("platform", "").title()
            status = td.get("status", "pending").title()
            rows += f'<p style="margin:4px 0;font-size:13px;color:{_TEXT};">• {platform} — <span style="color:{_MUTED};">{status}</span></p>'
        in_progress_html = f"""
{_divider()}
<p style="margin:0 0 8px;font-size:14px;font-weight:600;color:{_DARK};">Active takedowns</p>
{rows}"""

    trend_html = ""
    if trend_signal:
        trend_html = f'<p style="margin:16px 0 0;font-size:13px;color:{_MUTED};font-style:italic;">{trend_signal}</p>'

    cta_label = f"Review {new_count} detection{'s' if new_count != 1 else ''}" if new_count > 0 else "Open Dashboard"

    content = f"""
<h2 style="margin:0 0 4px;font-size:20px;color:{_DARK};">Weekly Brand Report</h2>
<p style="margin:0 0 20px;color:{_MUTED};font-size:14px;">{week_label} · {brand_label}</p>

<div style="text-align:center;padding:20px 0;border:1px solid {_BORDER};border-radius:6px;background:{_LIGHT_BG};">
  <div style="font-size:32px;font-weight:800;color:{headline_color};">{new_count}</div>
  <div style="font-size:14px;color:{_MUTED};margin-top:4px;">{headline}</div>
</div>

<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
  <tr>
    {_stat("Platforms scanned", str(platforms_scanned))}
    {_stat("Listings reviewed", f"{listings_reviewed:,}")}
    {_stat("Removed this week", str(takedowns_removed_this_week))}
  </tr>
</table>

{detections_html}
{in_progress_html}
{trend_html}
{_divider()}
{_btn(cta_label, dashboard_url)}
"""
    return _base(content, preheader=headline)


def welcome_html(
    *,
    user_name: str,
    dashboard_url: str,
) -> str:
    content = f"""
<h2 style="margin:0 0 4px;font-size:20px;color:{_DARK};">Welcome to HAKKIU, {user_name}!</h2>
<p style="margin:0 0 20px;color:{_MUTED};font-size:14px;">
  Your brand protection platform is ready. Here's how to get started:
</p>

<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid {_BORDER};border-radius:6px;">
  <tr>
    <td style="padding:16px;border-bottom:1px solid {_BORDER};">
      <span style="font-size:20px;">1️⃣</span>
      <strong style="color:{_DARK};margin-left:8px;">Add your trademark</strong>
      <p style="margin:4px 0 0 30px;font-size:13px;color:{_MUTED};">
        Tell us what brand names, keywords, and images to protect.
      </p>
    </td>
  </tr>
  <tr>
    <td style="padding:16px;border-bottom:1px solid {_BORDER};">
      <span style="font-size:20px;">2️⃣</span>
      <strong style="color:{_DARK};margin-left:8px;">Choose your marketplaces</strong>
      <p style="margin:4px 0 0 30px;font-size:13px;color:{_MUTED};">
        Select which platforms to monitor — Amazon is always included.
      </p>
    </td>
  </tr>
  <tr>
    <td style="padding:16px;">
      <span style="font-size:20px;">3️⃣</span>
      <strong style="color:{_DARK};margin-left:8px;">Launch your first scan</strong>
      <p style="margin:4px 0 0 30px;font-size:13px;color:{_MUTED};">
        We'll email you the moment we find anything suspicious.
      </p>
    </td>
  </tr>
</table>

{_divider()}
{_btn("Go to Dashboard", dashboard_url)}
<p style="margin:20px 0 0;font-size:13px;color:{_MUTED};">
  Questions? Reply to this email — we read every message.
</p>
"""
    return _base(content, preheader=f"Welcome {user_name} — your brand protection is ready to set up")


def first_detection_html(
    *,
    user_name: str,
    brand_name: str,
    detection_count: int,
    top_platform: str,
    dashboard_url: str,
) -> str:
    plural = "s" if detection_count != 1 else ""
    content = f"""
<h2 style="margin:0 0 4px;font-size:20px;color:{_DARK};">
  We found {detection_count} potential infringement{plural}
</h2>
<p style="margin:0 0 20px;color:{_MUTED};font-size:14px;">
  Hi {user_name}, HAKKIU just completed its first scan for <strong>{brand_name}</strong>.
</p>

<div style="text-align:center;padding:24px;border:2px solid {_BRAND_COLOR};border-radius:8px;background:#f0fdf4;">
  <div style="font-size:48px;font-weight:800;color:{_BRAND_COLOR};">{detection_count}</div>
  <div style="font-size:15px;color:#166534;margin-top:4px;">
    potential infringement{plural} found on {top_platform.title()} and other platforms
  </div>
</div>

{_divider()}
<p style="margin:0 0 8px;font-size:14px;color:{_TEXT};">
  Review each listing and approve a takedown with one click — we handle the rest.
</p>
<p style="margin:0;font-size:13px;color:{_MUTED};">
  You are never charged per detection or per takedown. Your monthly subscription covers everything.
</p>
{_btn(f"Review {detection_count} Detection{plural}", dashboard_url)}
"""
    return _base(content, preheader=f"First scan complete — {detection_count} potential infringement{plural} found for {brand_name}")


def new_lead_html(
    *,
    source: str | None,
    first_name: str | None,
    last_name: str | None,
    email: str,
    company: str | None,
    brand_count_range: str | None,
    message: str | None,
    role: str | None = None,
    website: str | None = None,
    phone: str | None = None,
    regions: list[str] | None = None,
    brand_names: str | None = None,
    marketplaces: list[str] | None = None,
    current_solution: str | None = None,
    primary_goal: list[str] | None = None,
) -> str:
    source_labels = {
        "pricing_modal": "Pricing enquiry",
        "request_demo": "Book a demo",
        "call_request": "Talk to sales",
    }
    source_label = source_labels.get(source or "", source or "Unknown")

    def row(label: str, value: str) -> str:
        return (
            f'<tr>'
            f'<td style="padding:8px 12px;font-size:13px;color:{_MUTED};white-space:nowrap;width:140px;">{label}</td>'
            f'<td style="padding:8px 12px;font-size:14px;color:{_DARK};">{value}</td>'
            f'</tr>'
        )

    def website_link(url: str) -> str:
        href = url if url.startswith(("http://", "https://")) else f"https://{url}"
        return f'<a href="{href}" style="color:{_BRAND_COLOR};">{url}</a>'

    # Always-present rows.
    rows = [row("Source", source_label)]
    if first_name or last_name:
        rows.append(row("Name", f"<strong>{(first_name or '')} {(last_name or '')}</strong>".strip()))
    rows.append(row("Email", f'<a href="mailto:{email}" style="color:{_BRAND_COLOR};">{email}</a>'))

    # Conditional rows — only shown when the form actually submitted a value, so
    # the email mirrors the form (no empty "—" rows).
    def maybe(label: str, value: str | None) -> None:
        if value:
            rows.append(row(label, value))

    maybe("Role", role)
    maybe("Phone", phone)
    maybe("Company", company)
    maybe("Website", website_link(website) if website else None)
    maybe("Regions", ", ".join(regions) if regions else None)
    maybe("Brands (count)", brand_count_range)
    maybe("Brands (names)", brand_names)
    maybe("Marketplaces", ", ".join(marketplaces) if marketplaces else None)
    maybe("Primary goal", ", ".join(primary_goal) if primary_goal else None)
    maybe("Current solution", current_solution)
    maybe("Message", f'<span style="white-space:pre-wrap;">{message}</span>' if message else None)

    rows_html = "".join(rows)

    content = f"""
<h2 style="margin:0 0 4px;font-size:20px;color:{_DARK};">New Sales Lead</h2>
<p style="margin:0 0 20px;color:{_MUTED};font-size:14px;">
  A new inquiry was submitted via <strong>{source_label}</strong>.
</p>
<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid {_BORDER};border-radius:6px;overflow:hidden;">
  {rows_html}
</table>
{_divider()}
{_btn("View in Admin Portal", "https://admin.hakkiu.com/leads")}
"""
    return _base(content, preheader=f"New {source_label} lead from {email}")


def lead_confirmation_html(
    *,
    kind: str,               # "demo" | "sales"
    first_name: str | None = None,
) -> str:
    """Auto-confirmation sent to the person who submitted a lead form.

    `kind` selects the copy: "demo" for the Book-a-demo modal, "sales" for the
    Talk-to-sales modal. Staff still get the separate `new_lead_html` alert.
    """
    greeting = f"Hi {first_name}," if first_name else "Hi there,"

    if kind == "sales":
        heading = "Thanks for contacting us"
        body = (
            "We've received your message and our team will get back to you within "
            "<strong>one business day</strong>."
        )
        what_next = (
            "In the meantime, feel free to reply to this email with anything else "
            "we should know about your brand."
        )
        preheader = "We've received your message — we'll reply within one business day."
    else:
        heading = "Thanks for booking a demo"
        body = (
            "We've received your request and a member of our team will reach out "
            "shortly to <strong>confirm a time</strong> that works for you."
        )
        what_next = (
            "We'll tailor the walkthrough to your brand and the marketplaces you "
            "care about — no preparation needed on your side."
        )
        preheader = "Your demo request is in — we'll confirm a time shortly."

    content = f"""
<h2 style="margin:0 0 16px;font-size:22px;color:{_DARK};">{heading}</h2>
<p style="margin:0 0 16px;font-size:15px;color:{_TEXT};">{greeting}</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:{_TEXT};">{body}</p>
<p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:{_TEXT};">{what_next}</p>
{_divider()}
<p style="margin:0;font-size:14px;color:{_MUTED};">— The HAKKIU team</p>
{_btn("Explore HAKKIU", f"{_APP_URL}")}
"""
    return _base(content, preheader=preheader)


def test_email_html(*, brand_name: str = "Test Brand") -> str:
    content = f"""
<h2 style="margin:0 0 4px;font-size:20px;color:{_DARK};">HAKKIU email is working ✓</h2>
<p style="margin:0 0 20px;color:{_MUTED};font-size:14px;">
  This is a test notification for <strong>{brand_name}</strong>.
  If you received this, your email configuration is working correctly.
</p>
<p style="margin:0;font-size:14px;color:{_TEXT};">
  You'll receive emails like this when HAKKIU detects infringements, confirms takedowns,
  or needs your attention on a billing matter.
</p>
{_divider()}
{_btn("Open Dashboard", _APP_URL + "/dashboard")}
"""
    return _base(content, preheader="HAKKIU test email — configuration verified")
