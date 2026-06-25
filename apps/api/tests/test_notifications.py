"""
Tests for notifications service (tracemark_api/services/notifications.py).
"""
from __future__ import annotations

import os
from email import message_from_string
from email.header import decode_header, make_header
from unittest.mock import MagicMock, patch

import pytest
from tracemark_api.services.notifications import dispatch_notifications, send_email_notification


@pytest.fixture
def clean_env():
    """Temporarily clear and set env variables to ensure clean tests."""
    original = dict(os.environ)
    # Clear existing SMTP env vars
    for key in ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_SENDER", "SMTP_USE_TLS", "SMTP_USE_SSL", "NOTIFICATION_EMAIL", "ADMIN_EMAILS"]:
        os.environ.pop(key, None)
    yield
    os.environ.clear()
    os.environ.update(original)


def decode_mime_header(val: str) -> str:
    """Decodes MIME encoded header strings."""
    if not val:
        return ""
    return str(make_header(decode_header(val)))


def test_send_email_notification_templates(clean_env):
    """
    Test send_email_notification renders subject and templates for different events.
    """
    event = {
        "type": "new_infringement",
        "brand_name": "Acme Brand",
        "case_id": "case-123",
        "platform": "amazon",
        "source_url": "https://amazon.com/fake-listing",
    }
    
    with patch("smtplib.SMTP") as mock_smtp:
        send_email_notification(event, "user@example.com")
        
        # Verify SMTP server lifecycle
        mock_smtp.assert_called_once_with("localhost", 1025)
        instance = mock_smtp.return_value
        instance.sendmail.assert_called_once()
        
        sender, recipient, raw_message = instance.sendmail.call_args[0]
        assert sender == "notifications@tracemark.io"
        assert recipient == "user@example.com"
        
        msg_obj = message_from_string(raw_message)
        subject_decoded = decode_mime_header(msg_obj["Subject"])
        assert "New HIGH Risk Infringement Found" in subject_decoded
        assert "Acme Brand" in subject_decoded
        
        # The body is multipart mixed/alternative, verify its contents by walking the parts
        body_text = ""
        if msg_obj.is_multipart():
            for part in msg_obj.walk():
                content_type = part.get_content_type()
                if content_type == "text/plain":
                    body_text += part.get_payload()
        else:
            body_text = msg_obj.get_payload()
            
        assert "amazon" in body_text
        assert "https://amazon.com/fake-listing" in body_text


def test_send_email_takedown_generated_template(clean_env):
    event = {
        "type": "takedown_generated",
        "brand_name": "Avery Brand",
        "case_id": "case-456",
        "platform": "instagram",
        "infringing_url": "https://instagram.com/fake-post",
        "file_url": "https://storage.supabase.co/doc.pdf",
        "document_type": "dmca",
        "file_format": "pdf",
    }
    
    with patch("smtplib.SMTP") as mock_smtp:
        send_email_notification(event, "reviewer@example.com")
        instance = mock_smtp.return_value
        instance.sendmail.assert_called_once()
        _, _, raw_message = instance.sendmail.call_args[0]
        
        msg_obj = message_from_string(raw_message)
        subject_decoded = decode_mime_header(msg_obj["Subject"])
        assert "Takedown Notice Draft Ready" in subject_decoded
        assert "Avery Brand" in subject_decoded
        
        body_text = ""
        if msg_obj.is_multipart():
            for part in msg_obj.walk():
                content_type = part.get_content_type()
                if content_type == "text/plain":
                    body_text += part.get_payload()
        else:
            body_text = msg_obj.get_payload()
            
        assert "instagram" in body_text
        assert "https://instagram.com/fake-post" in body_text
        assert "https://storage.supabase.co/doc.pdf" in body_text


def test_dispatch_notifications_resolves_via_org_settings(clean_env):
    """
    Test that dispatch_notifications queries and resolves via org_settings.
    """
    event = {
        "type": "case_escalated",
        "brand_name": "Test Brand",
        "case_id": "case-789",
    }
    
    # Mock supabase client
    sb_mock = MagicMock()
    # 1st query: cases table (brand_name, organization_id)
    sb_mock.table.return_value.select.return_value.eq.return_value.single.return_value.execute.side_effect = [
        # return for case
        MagicMock(data={"brand_name": "Test Brand", "organization_id": "org-555"}),
        # return for settings
        MagicMock(data={"notification_email": "org-alert@example.com"}),
    ]
    
    with patch("tracemark_api.services.notifications.get_supabase", return_value=sb_mock):
        with patch("tracemark_api.services.notifications.send_email_notification") as mock_send:
            dispatch_notifications(event)
            mock_send.assert_called_once_with(event, "org-alert@example.com")


def test_dispatch_notifications_falls_back_to_notification_email_env(clean_env):
    """
    Test fallback hierarchy: org_settings fails -> NOTIFICATION_EMAIL env.
    """
    os.environ["NOTIFICATION_EMAIL"] = "env-fallback@example.com"
    event = {
        "type": "case_dismissed",
        "brand_name": "Test Brand",
        "case_id": "case-789",
    }
    
    # Mock supabase to fail/return empty settings
    sb_mock = MagicMock()
    sb_mock.table.return_value.select.return_value.eq.return_value.single.return_value.execute.side_effect = Exception("Table not found")
    
    with patch("tracemark_api.services.notifications.get_supabase", return_value=sb_mock):
        with patch("tracemark_api.services.notifications.send_email_notification") as mock_send:
            dispatch_notifications(event)
            mock_send.assert_called_once_with(event, "env-fallback@example.com")


def test_dispatch_notifications_falls_back_to_admin_emails_env(clean_env):
    """
    Test fallback hierarchy: org_settings & NOTIFICATION_EMAIL empty -> ADMIN_EMAILS.
    """
    os.environ["ADMIN_EMAILS"] = "admin1@example.com,admin2@example.com"
    event = {
        "type": "new_infringement",
        "brand_name": "Acme Brand",
        "case_id": "case-789",
    }
    
    # Mock supabase to fail/return empty settings
    sb_mock = MagicMock()
    sb_mock.table.return_value.select.return_value.eq.return_value.single.return_value.execute.side_effect = Exception("Table not found")
    
    with patch("tracemark_api.services.notifications.get_supabase", return_value=sb_mock):
        with patch("tracemark_api.services.notifications.send_email_notification") as mock_send:
            dispatch_notifications(event)
            mock_send.assert_called_once_with(event, "admin1@example.com")


def test_dispatch_notifications_falls_back_to_default(clean_env):
    """
    Test fallback hierarchy: everything empty -> default notifications@tracemark.io.
    """
    event = {
        "type": "new_infringement",
        "brand_name": "Acme Brand",
        "case_id": "case-789",
    }
    
    # Mock supabase to fail/return empty settings
    sb_mock = MagicMock()
    sb_mock.table.return_value.select.return_value.eq.return_value.single.return_value.execute.side_effect = Exception("Table not found")
    
    with patch("tracemark_api.services.notifications.get_supabase", return_value=sb_mock):
        with patch("tracemark_api.services.notifications.send_email_notification") as mock_send:
            dispatch_notifications(event)
            mock_send.assert_called_once_with(event, "notifications@tracemark.io")
