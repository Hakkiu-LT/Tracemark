"""
Tests for delivery_log.py — log_delivery function.
"""

from unittest.mock import MagicMock, patch

from tracemark_api.services.delivery_log import log_delivery

FAKE_INFRINGEMENT_ID = "00000000-0000-0000-0000-000000000001"


def _make_sb_mock(inserted_id: str = "delivery-123"):
    sb = MagicMock()
    sb.table.return_value.insert.return_value.execute.return_value.data = [
        {"id": inserted_id}
    ]
    return sb


def test_log_delivery_success():
    with patch(
        "tracemark_api.services.delivery_log.get_supabase", return_value=_make_sb_mock()
    ):
        result = log_delivery(
            event_type="new_infringement",
            ok=True,
            infringement_id=FAKE_INFRINGEMENT_ID,
            payload={"type": "new_infringement", "platform": "amazon"},
        )
    assert result == "delivery-123"


def test_log_delivery_failure():
    with patch(
        "tracemark_api.services.delivery_log.get_supabase", return_value=_make_sb_mock()
    ):
        result = log_delivery(
            event_type="new_infringement",
            ok=False,
            infringement_id=FAKE_INFRINGEMENT_ID,
            error="SMTP connection refused",
        )
    assert result == "delivery-123"


def test_log_delivery_inserts_correct_status_sent():
    sb = _make_sb_mock()
    with patch("tracemark_api.services.delivery_log.get_supabase", return_value=sb):
        log_delivery("takedown_generated", ok=True)

    payload = sb.table.return_value.insert.call_args[0][0]
    assert payload["status"] == "sent"
    assert payload["event_type"] == "takedown_generated"
    assert payload["error_message"] is None


def test_log_delivery_inserts_correct_status_failed():
    sb = _make_sb_mock()
    with patch("tracemark_api.services.delivery_log.get_supabase", return_value=sb):
        log_delivery("new_infringement", ok=False, error="Timeout")

    payload = sb.table.return_value.insert.call_args[0][0]
    assert payload["status"] == "failed"
    assert payload["error_message"] == "Timeout"


def test_log_delivery_without_infringement_id():
    sb = _make_sb_mock()
    with patch("tracemark_api.services.delivery_log.get_supabase", return_value=sb):
        log_delivery("case_escalated", ok=True)

    payload = sb.table.return_value.insert.call_args[0][0]
    assert payload["infringement_id"] is None
