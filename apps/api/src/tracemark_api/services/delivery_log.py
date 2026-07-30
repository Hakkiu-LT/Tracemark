"""
Delivery log helpers — record every notification dispatch attempt in
the `notification_deliveries` table for auditability.
"""
from __future__ import annotations

from tracemark_api.services.database import get_supabase


def log_delivery(
    event_type: str,
    ok: bool = True,
    infringement_id: str | None = None,
    payload: dict | None = None,
    error: str | None = None,
    *,
    organization_id: str | None = None,
    recipient: str | None = None,
    subject: str | None = None,
    status: str | None = None,
) -> str:
    """
    Insert a notification_deliveries row after every dispatch attempt.

    Args:
        event_type:      e.g. 'new_infringement', 'takedown_generated', 'case_escalated'.
        ok:              True if notification was sent successfully, False otherwise.
                         Ignored when `status` is given explicitly.
        infringement_id: Optional FK to the related infringement.
        payload:         The event payload dict that was dispatched (stored as JSONB).
        error:           Error message (or a skip reason when status='skipped').
        organization_id: The org the email belongs to (None for platform/test emails).
        recipient:       The address the email was sent to.
        subject:         The email subject line.
        status:          Override the status directly ('sent' | 'failed' | 'skipped').
                         When omitted it is derived from `ok`.

    Returns:
        The inserted row id.
    """
    sb = get_supabase()
    result = sb.table("notification_deliveries").insert({
        "event_type": event_type,
        "infringement_id": infringement_id,
        "payload": payload,
        "status": status or ("sent" if ok else "failed"),
        "error_message": error,
        "organization_id": organization_id,
        "recipient": recipient,
        "subject": subject,
    }).execute()
    return result.data[0]["id"]
