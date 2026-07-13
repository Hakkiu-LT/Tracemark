"""
Tests for document_persistence.py — persist_document and get_documents_by_infringement.

These tests do NOT hit Supabase. get_supabase() is patched so no real DB
or Storage connection is needed.
"""

from unittest.mock import MagicMock, patch


from tracemark_api.services.document_persistence import (
    persist_document,
    get_documents_by_infringement,
    _ensure_bucket,
    BUCKET,
)

FAKE_INFRINGEMENT_ID = "00000000-0000-0000-0000-000000000001"
FAKE_FILE_URL = (
    "https://example.supabase.co/storage/v1/object/public/legal-documents/doc.pdf"
)


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────


def _make_mock_supabase(
    bucket_names: list[str] | None = None, inserted_row: dict | None = None
):
    """Build a MagicMock Supabase client pre-configured for common operations."""
    sb = MagicMock()

    # Storage: list_buckets
    mock_buckets = [MagicMock(name=n) for n in (bucket_names or [])]
    for mb, n in zip(mock_buckets, (bucket_names or [])):
        mb.name = n
    sb.storage.list_buckets.return_value = mock_buckets

    # Storage: upload + get_public_url
    sb.storage.from_.return_value.upload.return_value = {}
    sb.storage.from_.return_value.get_public_url.return_value = FAKE_FILE_URL

    # Table: insert
    row = inserted_row or {
        "id": "doc-abc123",
        "infringement_id": FAKE_INFRINGEMENT_ID,
        "document_type": "dmca",
        "file_url": FAKE_FILE_URL,
        "file_format": "pdf",
        "status": "draft",
        "generated_at": "2026-06-25T12:00:00+00:00",
        "sent_at": None,
        "created_at": "2026-06-25T12:00:00+00:00",
    }
    sb.table.return_value.insert.return_value.execute.return_value.data = [row]

    return sb


# ──────────────────────────────────────────────────────────────────────────────
# _ensure_bucket
# ──────────────────────────────────────────────────────────────────────────────


def test_ensure_bucket_creates_when_missing():
    with patch("tracemark_api.services.document_persistence.get_supabase") as mock_get:
        sb = _make_mock_supabase(bucket_names=[])
        mock_get.return_value = sb

        _ensure_bucket()

        sb.storage.create_bucket.assert_called_once_with(
            BUCKET, options={"public": False}
        )


def test_ensure_bucket_skips_when_exists():
    with patch("tracemark_api.services.document_persistence.get_supabase") as mock_get:
        sb = _make_mock_supabase(bucket_names=[BUCKET])
        mock_get.return_value = sb

        _ensure_bucket()

        sb.storage.create_bucket.assert_not_called()


# ──────────────────────────────────────────────────────────────────────────────
# persist_document
# ──────────────────────────────────────────────────────────────────────────────


def test_persist_document_returns_record():
    fake_buffer = b"%PDF-1.4 fake pdf content"

    with patch("tracemark_api.services.document_persistence.get_supabase") as mock_get:
        sb = _make_mock_supabase(bucket_names=[BUCKET])
        mock_get.return_value = sb

        result = persist_document(
            infringement_id=FAKE_INFRINGEMENT_ID,
            buffer=fake_buffer,
            document_type="dmca",
            file_format="pdf",
        )

    assert result["document_type"] == "dmca"
    assert result["file_format"] == "pdf"
    assert result["status"] == "draft"
    assert result["file_url"] == FAKE_FILE_URL
    assert result["infringement_id"] == FAKE_INFRINGEMENT_ID


def test_persist_document_uploads_to_storage():
    fake_buffer = b"fake docx bytes"

    with patch("tracemark_api.services.document_persistence.get_supabase") as mock_get:
        sb = _make_mock_supabase(bucket_names=[BUCKET])
        mock_get.return_value = sb

        persist_document(
            infringement_id=FAKE_INFRINGEMENT_ID,
            buffer=fake_buffer,
            document_type="cease-desist",
            file_format="docx",
        )

        upload_call = sb.storage.from_.return_value.upload
        assert upload_call.called
        args = upload_call.call_args
        # path should contain infringement_id and file format extension
        path_arg = args[0][0]
        assert FAKE_INFRINGEMENT_ID in path_arg
        assert path_arg.endswith(".docx")

        # content-type should be docx
        options_arg = args[0][2]
        assert "wordprocessingml" in options_arg["content-type"]


def test_persist_document_inserts_db_row():
    fake_buffer = b"data"

    with patch("tracemark_api.services.document_persistence.get_supabase") as mock_get:
        sb = _make_mock_supabase(bucket_names=[BUCKET])
        mock_get.return_value = sb

        persist_document(
            infringement_id=FAKE_INFRINGEMENT_ID,
            buffer=fake_buffer,
            document_type="dmca",
            file_format="pdf",
        )

        insert_call = sb.table.return_value.insert
        assert insert_call.called
        payload = insert_call.call_args[0][0]
        assert payload["infringement_id"] == FAKE_INFRINGEMENT_ID
        assert payload["document_type"] == "dmca"
        assert payload["file_format"] == "pdf"
        assert payload["status"] == "draft"
        assert payload["file_url"] == FAKE_FILE_URL


# ──────────────────────────────────────────────────────────────────────────────
# get_documents_by_infringement
# ──────────────────────────────────────────────────────────────────────────────


def test_get_documents_by_infringement():
    fake_rows = [
        {
            "id": "doc-1",
            "document_type": "dmca",
            "file_format": "pdf",
            "status": "draft",
        },
        {
            "id": "doc-2",
            "document_type": "cease-desist",
            "file_format": "docx",
            "status": "sent",
        },
    ]

    with patch("tracemark_api.services.document_persistence.get_supabase") as mock_get:
        sb = MagicMock()
        mock_get.return_value = sb

        (
            sb.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value.data
        ) = fake_rows

        results = get_documents_by_infringement(FAKE_INFRINGEMENT_ID)

    assert len(results) == 2
    assert results[0]["document_type"] == "dmca"
    assert results[1]["document_type"] == "cease-desist"


def test_get_documents_by_infringement_empty():
    with patch("tracemark_api.services.document_persistence.get_supabase") as mock_get:
        sb = MagicMock()
        mock_get.return_value = sb

        (
            sb.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value.data
        ) = []

        results = get_documents_by_infringement(FAKE_INFRINGEMENT_ID)

    assert results == []
