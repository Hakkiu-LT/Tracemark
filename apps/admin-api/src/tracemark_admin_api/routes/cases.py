"""Admin view/edit of customer cases: the full scan result — decision (AI), infringements
with evidence screenshots, takedown notices and documents. All via service-role."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from tracemark_admin_api.clients import customer_sb
from tracemark_admin_api.dependencies import (
    StaffPrincipal,
    require_permission,
    require_super_admin,
)
from tracemark_admin_api.services.audit import write_audit_log

router = APIRouter(prefix="/cases", tags=["cases"])

_EVIDENCE_BUCKET = "evidence-screenshots"
_SCREENSHOT_MARKER = "/evidence-screenshots/"
_SIGN_TTL = 3600  # 1 hour — matches the customer app's signing TTL.
_LEGAL_DOCS_BUCKET = "legal-documents"
_LEGAL_DOCS_MARKER = "/legal-documents/"
_LEGAL_DOC_SIGN_TTL = 3600  # admin views are short-lived; 1h is plenty.


def _sign_screenshot(stored: str | None) -> str | None:
    """Mint a short-lived signed URL for a private evidence-screenshot reference.

    Mirrors the main API's ``sign_screenshot_url`` (C5): accepts bare storage
    paths (new), legacy full public URLs, and foreign/mock http URLs. The
    service-role client bypasses storage RLS, so signing always succeeds for a
    valid path. Returns a full signed URL that the admin ``ensureAbsoluteUrl``
    helper passes through unchanged.
    """
    if not stored:
        return None
    if _SCREENSHOT_MARKER not in stored and stored.startswith("http"):
        return stored  # foreign/mock URL — nothing to sign
    idx = stored.find(_SCREENSHOT_MARKER)
    path = stored[idx + len(_SCREENSHOT_MARKER):] if idx != -1 else stored
    if not path:
        return stored
    try:
        sb = customer_sb()
        res = sb.storage.from_(_EVIDENCE_BUCKET).create_signed_url(path, expires_in=_SIGN_TTL)
        signed = res.get("signedURL", "") if isinstance(res, dict) else ""
        return signed or None
    except Exception as e:  # pragma: no cover - defensive
        print(f"[Admin] Failed to sign screenshot url: {e}")
        return None


def _sign_legal_document(stored: str | None) -> str | None:
    """Mint a short-lived signed URL for a private legal-document reference.

    Mirrors the main API's ``sign_legal_document_url``: the ``legal-documents``
    bucket is private, so the stored value (bare path for new rows, legacy public
    URL for old ones) must be signed on read or the admin case-detail document
    link would 404. Non-bucket foreign URLs are returned unchanged.
    """
    if not stored:
        return None
    if _LEGAL_DOCS_MARKER not in stored and stored.startswith("http"):
        return stored
    idx = stored.find(_LEGAL_DOCS_MARKER)
    path = stored[idx + len(_LEGAL_DOCS_MARKER):] if idx != -1 else stored
    if not path:
        return stored
    try:
        sb = customer_sb()
        res = sb.storage.from_(_LEGAL_DOCS_BUCKET).create_signed_url(path, expires_in=_LEGAL_DOC_SIGN_TTL)
        signed = res.get("signedURL", "") if isinstance(res, dict) else ""
        return signed or None
    except Exception as e:  # pragma: no cover - defensive
        print(f"[Admin] Failed to sign legal document url: {e}")
        return None


class CaseRow(BaseModel):
    id: str
    brand_name: str
    organization_id: str | None
    status: str
    created_at: str | None
    risk_level: str | None = None
    recommended_action: str | None = None
    confidence_score: float | None = None
    infringement_count: int = 0


class UpdateCaseRequest(BaseModel):
    status: str


# Statuses a bulk action is allowed to set — intentionally narrow to the 3 UI actions.
BULK_ALLOWED_STATUSES: frozenset[str] = frozenset({"reviewed", "dismissed", "escalated"})


class BulkUpdateCasesRequest(BaseModel):
    case_ids: list[str]
    status: str


class UpdateDecisionRequest(BaseModel):
    risk_level: str | None = None
    recommended_action: str | None = None
    confidence_score: float | None = None
    case_summary: str | None = None
    key_findings: list[str] | None = None
    evidence_quality: str | None = None


@router.get("", response_model=list[CaseRow])
def list_cases(
    staff: StaffPrincipal = Depends(require_permission("customers.view")),
    organization_id: str | None = Query(default=None),
    status: str | None = Query(default=None),
):
    sb = customer_sb()
    q = sb.table("cases").select("*").order("created_at", desc=True)
    if organization_id:
        q = q.eq("organization_id", organization_id)
    if status:
        q = q.eq("status", status)
    cases = q.limit(500).execute().data or []
    if not cases:
        return []

    ids = [c["id"] for c in cases]
    decisions = sb.table("decisions").select("case_id, risk_level, recommended_action, confidence_score").in_("case_id", ids).execute().data or []
    dec_by_case = {d["case_id"]: d for d in decisions}
    infr = sb.table("infringements").select("case_id").in_("case_id", ids).execute().data or []
    count_by_case: dict[str, int] = {}
    for i in infr:
        count_by_case[i["case_id"]] = count_by_case.get(i["case_id"], 0) + 1

    out = []
    for c in cases:
        d = dec_by_case.get(c["id"], {})
        out.append(CaseRow(
            id=c["id"], brand_name=c.get("brand_name", ""), organization_id=c.get("organization_id"),
            status=c.get("status", ""), created_at=c.get("created_at"),
            risk_level=d.get("risk_level"), recommended_action=d.get("recommended_action"),
            confidence_score=d.get("confidence_score"), infringement_count=count_by_case.get(c["id"], 0),
        ))
    return out


@router.get("/{case_id}")
def get_case(case_id: str, staff: StaffPrincipal = Depends(require_permission("customers.view"))):
    sb = customer_sb()
    case = sb.table("cases").select("*").eq("id", case_id).maybe_single().execute()
    if not case or not case.data:
        raise HTTPException(status_code=404, detail="Case not found")

    decision = sb.table("decisions").select("*").eq("case_id", case_id).order("created_at", desc=True).limit(1).execute()
    infringements = sb.table("infringements").select("*").eq("case_id", case_id).order("created_at", desc=True).execute().data or []
    infr_ids = [i["id"] for i in infringements]
    evidence = (
        sb.table("evidence_items").select("*").in_("infringement_id", infr_ids).execute().data
        if infr_ids else []
    ) or []
    # Private bucket (C5): sign each evidence-item screenshot before returning.
    for e in evidence:
        e["screenshot_url"] = _sign_screenshot(e.get("screenshot_url"))
    ev_by_infr: dict[str, list] = {}
    for e in evidence:
        ev_by_infr.setdefault(e.get("infringement_id"), []).append(e)
    for i in infringements:
        # Private bucket (C5): sign the infringement's own screenshot too.
        i["screenshot_url"] = _sign_screenshot(i.get("screenshot_url"))
        i["evidence_items"] = ev_by_infr.get(i["id"], [])

    takedowns = sb.table("takedown_reports").select("*").eq("case_id", case_id).order("created_at", desc=True).execute().data or []
    documents = (
        sb.table("documents").select("*").in_("infringement_id", infr_ids).order("created_at", desc=True).execute().data
        if infr_ids else []
    ) or []
    # Private bucket (H7): sign each document's file_url so the admin link works.
    for d in documents:
        d["file_url"] = _sign_legal_document(d.get("file_url"))

    return {
        "case": case.data,
        "decision": decision.data[0] if decision.data else None,
        "infringements": infringements,
        "takedowns": takedowns,
        "documents": documents,
    }


@router.patch("/bulk")
def bulk_update_cases(
    request: Request,
    payload: BulkUpdateCasesRequest,
    staff: StaffPrincipal = Depends(require_permission("customers.edit")),
):
    """Apply one status to many cases at once (Mark Reviewed / Dismiss / Escalate).

    Partial-tolerant: IDs that don't exist are reported in not_found, the rest
    are updated. One audit row summarises the whole batch.
    """
    if payload.status not in BULK_ALLOWED_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"status must be one of {sorted(BULK_ALLOWED_STATUSES)}",
        )
    ids = list({cid for cid in payload.case_ids if cid})
    if not ids:
        raise HTTPException(status_code=400, detail="case_ids is empty")
    if len(ids) > 200:
        raise HTTPException(status_code=400, detail="Too many cases (max 200 per batch)")

    sb = customer_sb()
    existing = sb.table("cases").select("id, organization_id").in_("id", ids).execute().data or []
    found_ids = [r["id"] for r in existing]
    not_found = [cid for cid in ids if cid not in {r["id"] for r in existing}]

    updated = 0
    if found_ids:
        sb.table("cases").update(
            {"status": payload.status, "updated_at": datetime.now(timezone.utc).isoformat()}
        ).in_("id", found_ids).execute()
        updated = len(found_ids)

    write_audit_log(
        staff, "cases.bulk_edit", target_type="case", target_id=None,
        target_org_id=None,
        metadata={
            "status": payload.status,
            "updated_ids": found_ids,
            "not_found_ids": not_found,
            "requested_count": len(ids),
            "updated_count": updated,
        },
        ip=request.client.host if request.client else None,
    )
    return {"success": True, "updated": updated, "not_found": not_found}


@router.patch("/{case_id}")
def update_case(
    case_id: str,
    request: Request,
    payload: UpdateCaseRequest,
    staff: StaffPrincipal = Depends(require_permission("customers.edit")),
):
    sb = customer_sb()
    before = sb.table("cases").select("*").eq("id", case_id).maybe_single().execute()
    if not before or not before.data:
        raise HTTPException(status_code=404, detail="Case not found")
    sb.table("cases").update(
        {"status": payload.status, "updated_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", case_id).execute()
    write_audit_log(
        staff, "cases.edit", target_type="case", target_id=case_id,
        target_org_id=before.data.get("organization_id"),
        metadata={"before_status": before.data.get("status"), "status": payload.status},
        ip=request.client.host if request.client else None,
    )
    return {"success": True, "status": payload.status}


@router.delete("/{case_id}")
def delete_case(case_id: str, request: Request, staff: StaffPrincipal = Depends(require_super_admin)):
    sb = customer_sb()
    before = sb.table("cases").select("organization_id").eq("id", case_id).maybe_single().execute()
    if not before or not before.data:
        raise HTTPException(status_code=404, detail="Case not found")
    sb.table("cases").delete().eq("id", case_id).execute()
    write_audit_log(
        staff, "cases.delete", target_type="case", target_id=case_id,
        target_org_id=before.data.get("organization_id"),
        ip=request.client.host if request.client else None,
    )
    return {"success": True}


@router.patch("/{case_id}/decision")
def update_decision(
    case_id: str,
    request: Request,
    payload: UpdateDecisionRequest,
    staff: StaffPrincipal = Depends(require_permission("customers.edit")),
):
    """Override the AI decision for a case (testing / manual correction)."""
    sb = customer_sb()
    existing = sb.table("decisions").select("id").eq("case_id", case_id).limit(1).execute()
    updates = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    if not existing.data:
        raise HTTPException(status_code=404, detail="No decision for this case")
    sb.table("decisions").update(updates).eq("case_id", case_id).execute()
    write_audit_log(
        staff, "decisions.edit", target_type="decision", target_id=case_id, metadata=updates,
        ip=request.client.host if request.client else None,
    )
    return {"success": True}
