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

from fastapi import APIRouter, Depends, HTTPException, Query

from tracemark_admin_api.clients import customer_sb
from tracemark_admin_api.dependencies import StaffPrincipal, require_permission

router = APIRouter(prefix="/notification-log", tags=["notification-log"])


def _payload_dict(payload) -> dict:
    """Return payload as a dict. JSONB usually deserializes to a dict, but guard
    against a stray string/list/None so `.get()` can never raise a 500."""
    return payload if isinstance(payload, dict) else {}


@router.get("")
def list_notification_log(
    status: str | None = Query(None),
    event_type: str | None = Query(None),
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
    if event_type:
        q = q.eq("event_type", event_type)
    try:
        result = q.order("delivered_at", desc=True).range(offset, offset + limit - 1).execute()
    except Exception as e:  # surface a readable, CORS-headed error instead of an opaque 500
        raise HTTPException(status_code=502, detail=f"Failed to read notification log: {e}")
    rows = result.data or []

    # 2) Resolve org for the page. New rows carry organization_id directly; older
    #    (pre-migration) rows only reach org via infringement/payload -> case -> org,
    #    so we run the flat lookups ONLY for rows still missing a direct org.
    #    Org is best-effort metadata — if any lookup fails we degrade to null rather
    #    than 500 the whole log. `payload` is JSONB: guard for a stray string/list.
    inf_to_case: dict[str, str | None] = {}
    case_to_org: dict[str, str | None] = {}
    org_to_name: dict[str, str | None] = {}
    try:
        legacy_rows = [r for r in rows if not r.get("organization_id")]

        inf_ids = [r["infringement_id"] for r in legacy_rows if r.get("infringement_id")]
        if inf_ids:
            inf_res = (
                sb.table("infringements").select("id,case_id").in_("id", list(set(inf_ids))).execute()
            )
            inf_to_case = {i["id"]: i.get("case_id") for i in (inf_res.data or [])}

        case_ids: set[str] = {c for c in inf_to_case.values() if c}
        for r in legacy_rows:
            payload_case = _payload_dict(r.get("payload")).get("case_id")
            if payload_case:
                case_ids.add(payload_case)

        if case_ids:
            case_res = (
                sb.table("cases").select("id,organization_id").in_("id", list(case_ids)).execute()
            )
            case_to_org = {c["id"]: c.get("organization_id") for c in (case_res.data or [])}

        # Names for every org referenced this page (direct column + resolved legacy).
        org_ids = {r["organization_id"] for r in rows if r.get("organization_id")}
        org_ids |= {o for o in case_to_org.values() if o}
        if org_ids:
            org_res = sb.table("organizations").select("id,name").in_("id", list(org_ids)).execute()
            org_to_name = {o["id"]: o.get("name") for o in (org_res.data or [])}
    except Exception:
        # Org enrichment is non-critical — fall back to unresolved org for the whole page.
        inf_to_case, case_to_org, org_to_name = {}, {}, {}

    # 3) Flatten each row, preferring the stored columns over derived values.
    deliveries = []
    for r in rows:
        payload = _payload_dict(r.get("payload"))
        case_id = inf_to_case.get(r.get("infringement_id")) or payload.get("case_id")
        org_id = r.get("organization_id") or (case_to_org.get(case_id) if case_id else None)
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
                "recipient": r.get("recipient") or payload.get("recipient"),
                "subject": r.get("subject"),
                "body_html": r.get("body_html"),
                "payload": payload,
            }
        )

    return {"deliveries": deliveries, "offset": offset, "limit": limit}
