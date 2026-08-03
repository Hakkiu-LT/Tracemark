"""Admin endpoint for the notification delivery log.

Read-only, cross-organization view of every notification dispatch attempt recorded
in `notification_deliveries` (main-API writes them via services/delivery_log.py).

The table has NO organization_id and NO recipient/subject columns — those only exist
(when at all) inside the `payload` JSONB. So org is resolved best-effort via two hops
without a PostgREST embed:

    infringement_id -> infringements.case_id -> cases.organization_id -> organizations.name
    (fallback) payload.case_id ------------------^

Events with neither an infringement_id nor a payload.case_id (e.g. `takedown_submitted`)
have no resolvable org and are surfaced with organization = null ("System" in the UI).
No audit log is written — reads are not audit events.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from tracemark_admin_api.clients import customer_sb
from tracemark_admin_api.dependencies import StaffPrincipal, require_permission
from tracemark_admin_api.services.audit import write_audit_log

router = APIRouter(prefix="/notification-log", tags=["notification-log"])


def _payload_dict(payload) -> dict:
    """Return payload as a dict. JSONB usually deserializes to a dict, but guard
    against a stray string/list/None so `.get()` can never raise a 500."""
    return payload if isinstance(payload, dict) else {}


# Emails that go to a non-customer audience have no personal name to resolve, so
# label them by role instead of leaving the recipient nameless in the log.
_STATIC_RECIPIENT_NAMES = {
    "new_lead": "HAKKIU sales team",
    "password_reset": "HAKKIU staff",
    "support_contact": "HAKKIU support",
    "takedown_submitted": "Marketplace / platform",
}


def _default_recipient_name(event_type: str | None) -> str | None:
    return _STATIC_RECIPIENT_NAMES.get(event_type or "")


@router.get("")
def list_notification_log(
    status: str | None = Query(None),
    event_type: str | None = Query(None),
    hide_skipped: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    principal: StaffPrincipal = Depends(require_permission("notification_log.view")),
):
    sb = customer_sb()

    # 1) Fetch the page of delivery rows (status/event_type filter on real columns —
    #    org is derived below, so it can't be a server-side filter without a join).
    q = sb.table("notification_deliveries").select("*")
    if status:
        q = q.eq("status", status)
    elif hide_skipped:
        # Default "real emails" view: drop the intentional no-send rows (dismissals,
        # low-risk detections, missing recipient) so the log shows ACTUAL dispatches.
        q = q.neq("status", "skipped")
    if event_type:
        q = q.eq("event_type", event_type)
    try:
        result = q.order("delivered_at", desc=True).range(offset, offset + limit - 1).execute()
    except Exception as e:  # surface a readable, CORS-headed error instead of an opaque 500
        raise HTTPException(status_code=502, detail=f"Failed to read notification log: {e}")
    rows = result.data or []

    # 2) Resolve org + brand for the page so staff see WHICH customer and WHICH brand
    #    each email was about — not raw UUIDs. New rows carry organization_id directly;
    #    older ones reach org via infringement/payload -> case. We resolve the case for
    #    EVERY row (not just org-less ones) because the brand name lives on the case.
    #    All best-effort: any lookup failure degrades to null rather than 500-ing the log.
    inf_to_case: dict[str, str | None] = {}
    case_to_org: dict[str, str | None] = {}
    case_to_brand: dict[str, str | None] = {}
    org_to_name: dict[str, str | None] = {}
    try:
        inf_ids = [r["infringement_id"] for r in rows if r.get("infringement_id")]
        if inf_ids:
            inf_res = (
                sb.table("infringements").select("id,case_id").in_("id", list(set(inf_ids))).execute()
            )
            inf_to_case = {i["id"]: i.get("case_id") for i in (inf_res.data or [])}

        case_ids: set[str] = {c for c in inf_to_case.values() if c}
        for r in rows:
            payload_case = _payload_dict(r.get("payload")).get("case_id")
            if payload_case:
                case_ids.add(payload_case)

        if case_ids:
            case_res = (
                sb.table("cases").select("id,organization_id,brand_name").in_("id", list(case_ids)).execute()
            )
            for c in case_res.data or []:
                case_to_org[c["id"]] = c.get("organization_id")
                case_to_brand[c["id"]] = c.get("brand_name")

        # Names for every org referenced this page (direct column + resolved via case).
        org_ids = {r["organization_id"] for r in rows if r.get("organization_id")}
        org_ids |= {o for o in case_to_org.values() if o}
        if org_ids:
            org_res = sb.table("organizations").select("id,name").in_("id", list(org_ids)).execute()
            org_to_name = {o["id"]: o.get("name") for o in (org_res.data or [])}
    except Exception:
        # Org/brand enrichment is non-critical — fall back to unresolved for the page.
        inf_to_case, case_to_org, case_to_brand, org_to_name = {}, {}, {}, {}

    # 3) Resolve the recipient's human NAME so the log reads "Jane Doe" not just an
    #    address. Two sources keyed by the recipient email: sales leads (demo / lead
    #    confirmation emails) and customer users (auth email -> profile full_name).
    recipient_emails = {
        (r.get("recipient") or "").strip().lower() for r in rows if r.get("recipient")
    }
    lead_name: dict[str, str] = {}
    user_name: dict[str, str] = {}
    if recipient_emails:
        try:
            lead_res = (
                sb.table("sales_leads")
                .select("email,first_name,last_name")
                .in_("email", list(recipient_emails))
                .execute()
            )
            for ld in lead_res.data or []:
                full = " ".join(p for p in (ld.get("first_name"), ld.get("last_name")) if p).strip()
                if ld.get("email") and full:
                    lead_name[ld["email"].strip().lower()] = full
        except Exception:
            lead_name = {}
        try:
            # email -> user_id (auth), then user_id -> full_name (profiles).
            users = sb.auth.admin.list_users(page=1, per_page=1000)
            email_to_uid = {(u.email or "").strip().lower(): u.id for u in users if u.email}
            uids = [email_to_uid[e] for e in recipient_emails if e in email_to_uid]
            if uids:
                prof_res = sb.table("profiles").select("id,full_name").in_("id", uids).execute()
                uid_to_name = {p["id"]: p.get("full_name") for p in (prof_res.data or [])}
                for e in recipient_emails:
                    nm = uid_to_name.get(email_to_uid.get(e))
                    if nm:
                        user_name[e] = nm
        except Exception:
            user_name = {}

    # 4) Flatten each row, preferring the stored columns over derived values.
    deliveries = []
    for r in rows:
        payload = _payload_dict(r.get("payload"))
        case_id = inf_to_case.get(r.get("infringement_id")) or payload.get("case_id")
        org_id = r.get("organization_id") or (case_to_org.get(case_id) if case_id else None)
        brand_name = (case_to_brand.get(case_id) if case_id else None) or payload.get("brand_name")
        recipient = r.get("recipient") or payload.get("recipient")
        email_key = (recipient or "").strip().lower()
        recipient_name = (
            lead_name.get(email_key)
            or user_name.get(email_key)
            or _default_recipient_name(r.get("event_type"))
        )
        deliveries.append(
            {
                "id": r["id"],
                "event_type": r.get("event_type"),
                "status": r.get("status"),
                "error_message": r.get("error_message"),
                "delivered_at": r.get("delivered_at"),
                "created_at": r.get("created_at"),
                "infringement_id": r.get("infringement_id"),
                "case_id": case_id,
                "organization_id": org_id,
                "organization_name": org_to_name.get(org_id) if org_id else None,
                "brand_name": brand_name,
                "recipient": recipient,
                "recipient_name": recipient_name,
                "subject": r.get("subject"),
                "body_html": r.get("body_html"),
                "payload": payload,
            }
        )

    return {"deliveries": deliveries, "offset": offset, "limit": limit}


class BulkDeleteRequest(BaseModel):
    ids: list[str]


@router.post("/bulk-delete")
def bulk_delete_notification_deliveries(
    body: BulkDeleteRequest,
    request: Request,
    staff: StaffPrincipal = Depends(require_permission("notification_log.delete")),
):
    """Hard-delete many notification_deliveries rows in one call (checkbox selection).

    Bounded to 500 ids per request so a runaway selection can't wipe the table in one
    shot. Writes a single audit row summarising the batch. Deleting records removes only
    the email audit trail — it never unsends or resends anything.
    """
    ids = [i for i in (body.ids or []) if i]
    if not ids:
        raise HTTPException(status_code=400, detail="No ids provided")
    if len(ids) > 500:
        raise HTTPException(status_code=400, detail="Too many ids (max 500 per request)")

    sb = customer_sb()
    existing = (
        sb.table("notification_deliveries").select("id").in_("id", ids).execute().data or []
    )
    found_ids = [r["id"] for r in existing]
    if found_ids:
        sb.table("notification_deliveries").delete().in_("id", found_ids).execute()

    write_audit_log(
        staff,
        "notification_log.bulk_delete",
        target_type="notification_delivery",
        metadata={
            "requested": len(ids),
            "deleted": len(found_ids),
            # Cap the id list so the audit row stays small even for big batches.
            "ids": found_ids[:100],
        },
        ip=request.client.host if request.client else None,
    )
    return {"deleted": len(found_ids)}


@router.delete("/{delivery_id}")
def delete_notification_delivery(
    delivery_id: str,
    request: Request,
    staff: StaffPrincipal = Depends(require_permission("notification_log.delete")),
):
    """Hard-delete a single notification_deliveries row (staff clean-up of junk/noise).

    The main API writes these rows via the service-role key; the customer app can only
    READ them (RLS is FOR SELECT), so deletion is a staff-only action. Audited like every
    other destructive admin mutation. Deleting a delivery record removes only the audit
    trail of the email — it does NOT unsend or resend anything.
    """
    sb = customer_sb()
    before = (
        sb.table("notification_deliveries").select("*").eq("id", delivery_id).maybe_single().execute()
    )
    if not before or not before.data:
        raise HTTPException(status_code=404, detail="Notification delivery not found")

    sb.table("notification_deliveries").delete().eq("id", delivery_id).execute()

    row = before.data
    write_audit_log(
        staff,
        "notification_log.delete",
        target_type="notification_delivery",
        target_id=delivery_id,
        target_org_id=row.get("organization_id"),
        # Keep the audit payload compact — no body_html (can be large / contain a token).
        metadata={
            "event_type": row.get("event_type"),
            "status": row.get("status"),
            "recipient": row.get("recipient"),
            "subject": row.get("subject"),
            "delivered_at": row.get("delivered_at"),
        },
        ip=request.client.host if request.client else None,
    )
    return {"success": True}
