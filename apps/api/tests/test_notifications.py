"""
Tests for simplified notifications service (tracemark_api/services/notifications.py).
"""

from __future__ import annotations

from tracemark_api.services.notifications import (
    dispatch_notifications,
    send_email_notification,
)


def test_send_email_notification_noop():
    # Verify the simplified no-op method executes without errors
    send_email_notification(
        {"type": "new_infringement", "brand_name": "Test Brand"},
        "user@example.com",
    )


def test_dispatch_notifications_noop():
    # Verify the simplified no-op dispatcher executes without errors
    dispatch_notifications({"type": "case_escalated"})
