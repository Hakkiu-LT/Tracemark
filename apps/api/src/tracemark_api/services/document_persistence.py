"""
Supabase Storage helpers for persisting generated legal documents (PDF/Docx).

Callers (e.g. the document generator service) pass raw file bytes;
this module uploads them to the 'legal-documents' bucket and records
metadata in the 'documents' table.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from tracemark_api.services.database import get_supabase

BUCKET = "legal-documents"

CONTENT_TYPES = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def _ensure_bucket() -> None:
    sb = get_supabase()
    existing = [b.name for b in sb.storage.list_buckets()]
    if BUCKET not in existing:
        sb.storage.create_bucket(BUCKET, options={"public": False})


def persist_document(
    infringement_id: str,
    buffer: bytes,
    document_type: str,
    file_format: str,
) -> dict:
    """
    Upload document bytes to Supabase Storage and insert a metadata row
    into the 'documents' table.

    Args:
        infringement_id: UUID of the parent infringement record.
        buffer: Raw file bytes (PDF or Docx).
        document_type: 'dmca' or 'cease-desist'.
        file_format: 'pdf' or 'docx'.

    Returns:
        The inserted 'documents' row as a dict.
    """
    _ensure_bucket()
    sb = get_supabase()

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    file_path = f"{infringement_id}/{document_type}-{timestamp}-{uuid.uuid4().hex[:8]}.{file_format}"

    content_type = CONTENT_TYPES.get(file_format, "application/octet-stream")
    sb.storage.from_(BUCKET).upload(
        file_path,
        buffer,
        {"content-type": content_type, "upsert": "true"},
    )

    file_url = sb.storage.from_(BUCKET).get_public_url(file_path)

    result = (
        sb.table("documents")
        .insert(
            {
                "infringement_id": infringement_id,
                "document_type": document_type,
                "file_url": file_url,
                "file_format": file_format,
                "status": "draft",
            }
        )
        .execute()
    )

    doc = result.data[0]

    # Trigger takedown_generated email notification
    try:
        from tracemark_api.services.notifications import dispatch_notifications
        from tracemark_api.services.delivery_log import log_delivery

        # Resolve additional details for the email template context
        platform = "Unknown Platform"
        infringing_url = ""
        case_id = None
        try:
            inf_res = (
                sb.table("infringements")
                .select("case_id, platform, source_url")
                .eq("id", infringement_id)
                .single()
                .execute()
            )
            if inf_res.data:
                case_id = inf_res.data.get("case_id")
                platform = inf_res.data.get("platform", "Unknown Platform")
                infringing_url = inf_res.data.get("source_url", "")
        except Exception as inner_e:
            print(
                f"[DocumentPersistence] Failed to fetch infringement details: {inner_e}"
            )

        event = {
            "type": "takedown_generated",
            "document_id": doc["id"],
            "infringement_id": infringement_id,
            "case_id": case_id,
            "document_type": document_type,
            "file_format": file_format,
            "file_url": file_url,
            "platform": platform,
            "infringing_url": infringing_url,
        }
        dispatch_notifications(event)
        log_delivery(
            "takedown_generated",
            ok=True,
            infringement_id=infringement_id,
            payload=event,
        )
    except Exception as e:
        try:
            from tracemark_api.services.delivery_log import log_delivery

            log_delivery(
                "takedown_generated",
                ok=False,
                infringement_id=infringement_id,
                error=str(e),
            )
        except Exception:
            pass

    return doc


def get_documents_by_infringement(infringement_id: str) -> list[dict]:
    """
    Return all documents linked to an infringement, newest first.
    """
    sb = get_supabase()
    result = (
        sb.table("documents")
        .select("*")
        .eq("infringement_id", infringement_id)
        .order("generated_at", desc=True)
        .execute()
    )
    return result.data
