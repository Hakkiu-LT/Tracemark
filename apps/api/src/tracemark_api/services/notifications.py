"""
Email Notification Service — handles template compilation and local logging.
SMTP dispatch has been removed in favor of direct browser email routing.
"""
from __future__ import annotations

import os

def send_email_notification(event: dict, recipient_email: str) -> None:
    """
    SMTP dispatch is disabled. We compile the templates and log the event.
    """
    event_type = event.get("type", "unknown")
    brand_name = event.get("brand_name", "Unknown Brand")
    subject = f"Notification: {event_type} - {brand_name}"
    print(f"[Notifications] SMTP is disabled. Bypassed email to {recipient_email} with subject: {subject}")


def dispatch_notifications(event: dict) -> None:
    """
    No-op notification dispatcher. Background SMTP emails are disabled.
    """
    pass
