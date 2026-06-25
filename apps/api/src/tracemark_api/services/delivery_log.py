"""
Delivery log helpers — record every notification dispatch attempt in
the `notification_deliveries` table for auditability.
"""
from __future__ import annotations

from tracemark_api.services.database import get_supabase


def log_delivery(
    event_type: str,
    ok: bool,
    infringement_id: str | None = None,
    payload: dict | None = None,
    error: str | None = None,
) -> str:
    """
    Insert a notification_deliveries row after every dispatch attempt.

    Args:
        event_type:      e.g. 'new_infringement', 'takedown_generated', 'case_escalated'.
        ok:              True if notification was sent successfully, False otherwise.
        infringement_id: Optional FK to the related infringement.
        payload:         The event payload dict that was dispatched (stored as JSONB).
        error:           Error message if ok=False.

    Returns:
        The inserted row id.
    """
    sb = get_supabase()
    result = sb.table("notification_deliveries").insert({
        "event_type": event_type,
        "infringement_id": infringement_id,
        "payload": payload,
        "status": "sent" if ok else "failed",
        "error_message": error,
    }).execute()
    return result.data[0]["id"]
