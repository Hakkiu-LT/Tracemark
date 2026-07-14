from __future__ import annotations

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException

from tracemark_api.dependencies import get_current_user
from tracemark_api.services.database import get_supabase
from tracemark_api.services.authz import user_can_access_infringement

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/{id}/send-email")
def send_document_email_endpoint(
    id: str,
    current_user=Depends(get_current_user),
):
    """
    Fetch the document metadata, trigger dispatch_notifications for the user,
    update status to 'sent' and sent_at to now.
    """
    sb = get_supabase()
    res = sb.table("documents").select("*").eq("id", id).maybe_single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Document not found")

    doc = res.data
    infringement_id = doc.get("infringement_id")

    # Ownership: the document's infringement must belong to the caller's org.
    # Without this, any user could send/mutate another tenant's legal document
    # by id (service-role bypasses RLS).
    if not user_can_access_infringement(sb, current_user.id, infringement_id):
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        from tracemark_api.services.delivery_log import log_delivery
        from tracemark_api.services.notifications import dispatch_notifications

        # Resolve platform and infringing_url from the infringement
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
        except Exception as e:
            print(f"[DocumentsRoute] Failed to fetch infringement details: {e}")

        event = {
            "type": "takedown_generated",
            "document_id": doc["id"],
            "infringement_id": infringement_id,
            "case_id": case_id,
            "document_type": doc.get("document_type"),
            "file_format": doc.get("file_format"),
            "file_url": doc.get("file_url"),
            "platform": platform,
            "infringing_url": infringing_url,
        }
        dispatch_notifications(event)
        log_delivery("takedown_generated", ok=True, infringement_id=infringement_id, payload=event)

        # Update document record
        sent_at = datetime.now(timezone.utc).isoformat()
        sb.table("documents").update({
            "status": "sent",
            "sent_at": sent_at,
        }).eq("id", id).execute()

        return {
            "success": True,
            "message": "Email notification dispatched successfully",
            "sent_at": sent_at,
        }
    except Exception as e:
        try:
            from tracemark_api.services.delivery_log import log_delivery
            log_delivery("takedown_generated", ok=False, infringement_id=infringement_id, error=str(e))
        except Exception:
            pass
        print(f"[DocumentsRoute] Failed to dispatch document email: {e}")
        raise HTTPException(status_code=500, detail="Failed to dispatch document email")
