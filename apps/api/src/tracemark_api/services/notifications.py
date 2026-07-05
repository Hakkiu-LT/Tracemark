"""
Email Notification Service — handles template compilation and SMTP mail dispatch
for new infringements, takedown notices, and status changes.
"""
from __future__ import annotations

import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from tracemark_api.services.database import get_supabase


def send_email_notification(event: dict, recipient_email: str) -> None:
    """
    Core SMTP email sending function.
    Reads SMTP config from environment variables and sends the formatted message.
    """
    smtp_host = os.environ.get("SMTP_HOST", "localhost")
    smtp_port = int(os.environ.get("SMTP_PORT", "1025"))
    smtp_user = os.environ.get("SMTP_USER", "")
    smtp_password = os.environ.get("SMTP_PASSWORD", "")
    smtp_sender = os.environ.get("SMTP_SENDER", "notifications@tracemark.io")
    smtp_use_tls = os.environ.get("SMTP_USE_TLS", "false").lower() == "true"
    smtp_use_ssl = os.environ.get("SMTP_USE_SSL", "false").lower() == "true"

    event_type = event.get("type", "unknown")
    brand_name = event.get("brand_name", "Unknown Brand")
    case_id = event.get("case_id", "")
    app_url = os.environ.get("APP_URL", "http://localhost:5173").rstrip("/")
    
    firm_name = event.get("firm_name")
    firm_logo_url = event.get("firm_logo_url")
    persona = event.get("persona")

    subject = ""
    body = ""

    footer = f"\nBest regards,\n{firm_name}\n" if (persona == "law_firm" and firm_name) else "\nBest regards,\nTracemark Team\n"
    if persona == "law_firm" and firm_logo_url:
        footer += f"\nLogo: {firm_logo_url}\n"

    if event_type == "new_infringement":
        platform = event.get("platform", "Unknown Platform")
        source_url = event.get("source_url", "")
        if persona == "law_firm" and firm_name:
            subject = f"🔴 New HIGH Risk Infringement Found — {brand_name} (via {firm_name})"
        else:
            subject = f"🔴 New HIGH Risk Infringement Found — {brand_name}"
        body = f"""Hello,

A new HIGH risk infringement has been detected on {platform}.

Details:
- Brand: {brand_name}
- Platform: {platform}
- Infringing URL: {source_url}
- Risk Level: HIGH

You can view the case details and take action at:
{app_url}/cases/{case_id}
{footer}"""
    elif event_type == "takedown_generated":
        platform = event.get("platform", "Unknown Platform")
        infringing_url = event.get("infringing_url", "")
        file_url = event.get("file_url", "")
        doc_type = event.get("document_type", "takedown").upper()
        if persona == "law_firm" and firm_name:
            subject = f"📄 Takedown Notice Draft Ready — {brand_name} (via {firm_name})"
        else:
            subject = f"📄 Takedown Notice Draft Ready — {brand_name}"
        body = f"""Hello,

A new {doc_type} document draft has been generated for {brand_name}.

Details:
- Brand: {brand_name}
- Platform: {platform}
- Infringing URL: {infringing_url}
- Document Link: {file_url}

Review and send the document at:
{app_url}/cases/{case_id}
{footer}"""
    elif event_type == "case_escalated":
        if persona == "law_firm" and firm_name:
            subject = f"⚠️ Case Escalated — {brand_name} (via {firm_name})"
        else:
            subject = f"⚠️ Case Escalated — {brand_name}"
        body = f"""Hello,

The case for {brand_name} has been escalated for takedown actions.

You can view the case details at:
{app_url}/cases/{case_id}
{footer}"""
    elif event_type == "case_dismissed":
        if persona == "law_firm" and firm_name:
            subject = f"✅ Case Dismissed — {brand_name} (via {firm_name})"
        else:
            subject = f"✅ Case Dismissed — {brand_name}"
        body = f"""Hello,

The case for {brand_name} has been dismissed.

You can view the case details at:
{app_url}/cases/{case_id}
{footer}"""
    elif event_type == "test":
        subject = "🔔 Test Notification — Tracemark"
        body = event.get("message", "This is a test notification from Tracemark.")
    else:
        subject = f"🔔 Notification update — {brand_name}"
        body = f"An update has occurred for the case of {brand_name}.\nEvent type: {event_type}."

    # Build MIME message
    msg = MIMEMultipart()
    msg["From"] = smtp_sender
    msg["To"] = recipient_email
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))

    # Connect and send
    if smtp_use_ssl:
        server = smtplib.SMTP_SSL(smtp_host, smtp_port)
    else:
        server = smtplib.SMTP(smtp_host, smtp_port)

    try:
        if not smtp_use_ssl:
            server.ehlo()
            if smtp_use_tls:
                server.starttls()
                server.ehlo()

        if smtp_user and smtp_password:
            server.login(smtp_user, smtp_password)

        server.sendmail(smtp_sender, recipient_email, msg.as_string())
    finally:
        server.quit()


def dispatch_notifications(event: dict) -> None:
    """
    Resolves recipient email and triggers notification dispatch.
    Handles data resolution (fetching case metadata or brand name if missing).
    Raises errors up to the caller so they can be logged correctly in notification_deliveries.
    """
    # 1. Resolve case_id, platform, infringing_url from infringement if available
    infringement_id = event.get("infringement_id")
    sb = get_supabase()

    if infringement_id and (not event.get("case_id") or not event.get("platform")):
        try:
            inf_res = (
                sb.table("infringements")
                .select("case_id, platform, source_url")
                .eq("id", infringement_id)
                .single()
                .execute()
            )
            if inf_res.data:
                event["case_id"] = inf_res.data.get("case_id")
                event["platform"] = inf_res.data.get("platform")
                event["source_url"] = inf_res.data.get("source_url")
        except Exception as e:
            print(f"[Notifications] Failed to resolve infringement {infringement_id}: {e}")

    # 2. Resolve brand_name and org_id from case
    case_id = event.get("case_id")
    org_id = None
    if case_id:
        try:
            case_res = sb.table("cases").select("brand_name, organization_id").eq("id", case_id).single().execute()
            if case_res.data:
                if not event.get("brand_name"):
                    event["brand_name"] = case_res.data.get("brand_name")
                org_id = case_res.data.get("organization_id")
        except Exception as e:
            print(f"[Notifications] Failed to resolve case {case_id}: {e}")

    # 3. Resolve user email to send notification to
    recipient_email = None
    persona = None
    firm_name = None
    firm_logo_url = None

    # Check org_settings if organization_id is available
    if org_id:
        try:
            settings_res = (
                sb.table("org_settings")
                .select("notification_email, persona, firm_name, firm_logo_url")
                .eq("organization_id", org_id)
                .single()
                .execute()
            )
            if settings_res.data:
                recipient_email = settings_res.data.get("notification_email")
                persona = settings_res.data.get("persona")
                firm_name = settings_res.data.get("firm_name")
                firm_logo_url = settings_res.data.get("firm_logo_url")
        except Exception as e:
            # Table might not exist or be empty, fail silently and fall back
            print(f"[Notifications] org_settings query bypassed/failed: {e}")

    if persona:
        event["persona"] = persona
    if firm_name:
        event["firm_name"] = firm_name
    if firm_logo_url:
        event["firm_logo_url"] = firm_logo_url

    # Fallback 1: NOTIFICATION_EMAIL env
    if not recipient_email:
        recipient_email = os.environ.get("NOTIFICATION_EMAIL")

    # Fallback 2: first admin email
    if not recipient_email:
        admin_emails = os.environ.get("ADMIN_EMAILS", "")
        if admin_emails:
            recipient_email = admin_emails.split(",")[0].strip()

    # Fallback 3: default local/system address
    if not recipient_email:
        recipient_email = "notifications@tracemark.io"

    # Send actual email
    send_email_notification(event, recipient_email)
