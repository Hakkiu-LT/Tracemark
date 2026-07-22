from __future__ import annotations

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException

from tracemark_api.dependencies import get_current_profile, CurrentProfile
from tracemark_api.services.database import get_supabase

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/{id}/send-email")
def send_document_email_endpoint(
    id: str,
    profile: CurrentProfile = Depends(get_current_profile),
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

    # Verify document belongs to caller's org via: document → infringement → case → org
    if infringement_id:
        owner = (
            sb.table("infringements")
            .select("cases!inner(organization_id, user_id)")
            .eq("id", infringement_id)
            .maybe_single()
            .execute()
        )
        owner_case = (owner.data or {}).get("cases") if owner else None
        if not owner_case:
            raise HTTPException(status_code=404, detail="Document not found")
        if owner_case.get("organization_id") != profile.organization_id:
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
        raise HTTPException(status_code=500, detail=f"Failed to dispatch document email: {str(e)}")
