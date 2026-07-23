import asyncio
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, field_validator, EmailStr, Field
from typing import Literal, Annotated
from tracemark_api.services.firecrawl_client import scrape_page
from tracemark_api.services.ai import analyze_listing, make_decision, Evidence, Decision
from tracemark_api.services.marketplace import gather_evidence as scrape_evidence, check_ads_hijacking, exchange_short_lived_meta_token, update_env_meta_token
from tracemark_api.services.database import get_supabase, create_case, save_evidence, save_decision, update_case_status, get_full_case, update_decision_action
from tracemark_api.services.evidence_scorer import score_evidence
from tracemark_api.services.entitlements import resolve_detection_depth, DetectionDepth
from tracemark_api.services.persistence import persist_all_infringements, persist_scored_evidence_item
from tracemark_api.services.detection_funnel import run_tier0_and_filter, run_tier1, filter_evidence_by_scored
from tracemark_api.services.takedown import generate_takedown_reports, TakedownReport
from tracemark_api.services.rate_limit import limiter
from tracemark_api.services.ssrf import validate_ssrf_url, SSRFError
from tracemark_api.dependencies import get_current_user, get_current_profile, CurrentProfile

router = APIRouter(prefix="/monitoring", tags=["monitoring"])

BrandName = Annotated[str, Field(min_length=1, max_length=200)]
PlatformStr = Annotated[str, Field(max_length=120)]


class MonitorRequest(BaseModel):
    url: Annotated[str, Field(max_length=2048)]

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        try:
            validate_ssrf_url(v)
        except SSRFError as e:
            raise ValueError(str(e))
        return v


class MonitorResponse(BaseModel):
    url: str
    title: str | None
    success: bool
    evidence: Evidence | None = None
    decision: Decision | None = None
    error_message: str | None = None


def _assert_case_in_org(sb, case_id: str, org_id: str | None, user_id: str) -> None:
    res = sb.table("cases").select("organization_id, user_id").eq("id", case_id).maybe_single().execute()
    row = res.data if res else None
    if not row:
        raise HTTPException(status_code=404, detail="Case not found")
    if org_id:
        if row.get("organization_id") != org_id:
            raise HTTPException(status_code=404, detail="Case not found")
    else:
        if row.get("user_id") != user_id:
            raise HTTPException(status_code=404, detail="Case not found")


def _assert_takedown_in_org(sb, takedown_id: str, org_id: str | None, user_id: str) -> dict:
    res = (
        sb.table("takedown_reports")
        .select("*, cases!inner(organization_id, user_id)")
        .eq("id", takedown_id)
        .maybe_single()
        .execute()
    )
    row = res.data if res else None
    if not row:
        raise HTTPException(status_code=404, detail=f"Takedown report with ID {takedown_id} not found")
    case_info = row.get("cases") or {}
    if org_id:
        if case_info.get("organization_id") != org_id:
            raise HTTPException(status_code=404, detail=f"Takedown report with ID {takedown_id} not found")
    else:
        if case_info.get("user_id") != user_id:
            raise HTTPException(status_code=404, detail=f"Takedown report with ID {takedown_id} not found")
    return row


def _require_paid_plan(profile: CurrentProfile) -> None:
    """Require an active paid subscription before triggering real scrapes."""
    if (profile.plan or "free").lower() == "free":
        raise HTTPException(status_code=402, detail="Active paid plan required to run scrapes. Upgrade to continue.")


@router.post("/analyze", response_model=MonitorResponse)
@limiter.limit("5/hour")
def analyze_url(request: Request, payload: MonitorRequest, current_user=Depends(get_current_user)) -> MonitorResponse:
    try:
        scrape_result = scrape_page(payload.url)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to trigger scraper: {str(e)}")

    if not scrape_result.success:
        return MonitorResponse(
            url=payload.url,
            title=None,
            success=False,
            evidence=None,
            decision=None,
            error_message=scrape_result.error_message
        )

    try:
        analysis_payload = {
            "url": scrape_result.url,
            "markdown": scrape_result.markdown
        }
        analysis = analyze_listing(analysis_payload)

        return MonitorResponse(
            url=payload.url,
            title=scrape_result.title,
            success=True,
            evidence=analysis.evidence,
            decision=analysis.decision
        )
    except Exception as e:
        return MonitorResponse(
            url=payload.url,
            title=scrape_result.title,
            success=False,
            evidence=None,
            decision=None,
            error_message=f"Analysis error: {str(e)}"
        )


@router.post("/make-decision")
def make_decision_endpoint(evidence: Evidence, current_user=Depends(get_current_user)) -> Decision:
    return make_decision(evidence)


class GatherEvidenceRequest(BaseModel):
    brand_name: BrandName
    platforms: list[PlatformStr] = Field(default=["amazon", "google_ads", "meta_ads", "domains"], max_length=20)
    official_advertisers: list[PlatformStr] = Field(default=[], max_length=50)
    # Supported: amazon, ebay, alibaba, aliexpress, google_ads, meta_ads, domains


@router.post("/gather-evidence", response_model=Evidence)
@limiter.limit("5/hour")
async def gather_evidence_endpoint(
    request: Request,
    payload: GatherEvidenceRequest,
    profile: CurrentProfile = Depends(get_current_profile),
) -> Evidence:
    _require_paid_plan(profile)
    caller_id = profile.email or profile.id
    try:
        evidence = await scrape_evidence(
            payload.brand_name,
            payload.platforms,
            payload.official_advertisers or None,
            caller_id=caller_id,
        )
        return evidence
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class CheckAdsRequest(BaseModel):
    brand_name: BrandName
    platforms: list[PlatformStr] = Field(default=["google_ads", "meta_ads"], max_length=20)
    official_advertisers: list[PlatformStr] = Field(default=[], max_length=50)


@router.post("/check-ads")
@limiter.limit("5/hour")
async def check_ads_endpoint(
    request: Request,
    payload: CheckAdsRequest,
    profile: CurrentProfile = Depends(get_current_profile),
):
    """
    Detect ad hijacking: unauthorized Google/Meta ads using a brand name to steal traffic.
    Whitelist official page names via official_advertisers (e.g. ["Orbio World", "Orbio Official"]).
    """
    _require_paid_plan(profile)
    caller_id = profile.email or profile.id
    try:
        return await check_ads_hijacking(
            payload.brand_name,
            payload.platforms,
            payload.official_advertisers or None,
            caller_id=caller_id,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class CheckBrandRequest(BaseModel):
    brand_name: BrandName
    platforms: list[PlatformStr] = Field(default=["amazon", "google_ads", "meta_ads", "domains"], max_length=20)
    official_advertisers: list[PlatformStr] = Field(default=[], max_length=50)
    official_domains: list[PlatformStr] = Field(default=[], max_length=50)
    target_regions: list[str] = ["US"]
    client_id: str | None = None


def _enforce_scan_entitlements(profile: CurrentProfile, payload: CheckBrandRequest) -> None:
    """Reject a scan that asks for more than the caller's plan allows, with a
    clear upsell message. The frontend gates the same limits in the UI; this is
    the authoritative server-side check (and guards direct API callers)."""
    ent = profile.entitlements

    platforms = payload.platforms or []
    if ent.exceeds_platforms(len(platforms)):
        raise HTTPException(
            status_code=402,
            detail=(
                f"Your {profile.plan} plan can scan {ent.platforms} platform"
                f"{'s' if (ent.platforms or 0) != 1 else ''} per check. "
                "Upgrade to Growth or higher to scan all platforms."
            ),
        )

    if "domains" in platforms and not ent.domain_tracking:
        raise HTTPException(
            status_code=402,
            detail=(
                "Domain tracking isn't included in your plan. Add the 'Domain "
                "tracking' add-on or upgrade to Pro to monitor look-alike domains."
            ),
        )

    regions = payload.target_regions or []
    if ent.exceeds_regions(len(regions)):
        raise HTTPException(
            status_code=402,
            detail=(
                f"Your {profile.plan} plan includes {ent.regions} scan region"
                f"{'s' if (ent.regions or 0) != 1 else ''}. "
                "Add the 'Additional regions' add-on to scan more markets."
            ),
        )


def _reject_if_brand_locked(org_id: str, brand_name: str) -> None:
    """Frozen (downgrade-excess) brands can't be scanned until re-activated."""
    sb = get_supabase()
    res = (
        sb.table("brands")
        .select("status")
        .eq("organization_id", org_id)
        .eq("brand_name", brand_name)
        .execute()
    )
    rows = res.data or []
    if rows and all(r.get("status") == "locked" for r in rows):
        raise HTTPException(
            status_code=402,
            detail=(
                "This brand is locked on your current plan. Upgrade or free up a "
                "brand slot to resume monitoring it."
            ),
        )


@router.post("/check-brand")
@limiter.limit("5/hour")
async def check_brand(
    request: Request,
    payload: CheckBrandRequest,
    profile: CurrentProfile = Depends(get_current_profile),
):
    """Full pipeline: scrape evidence → AI decision → DMCA reports → persist to Supabase.
    A case is only created in the database if copycats are actually found."""
    caller_id = profile.email or profile.id or "system"

    # Enforce plan entitlements before spending any scraping budget.
    _enforce_scan_entitlements(profile, payload)
    await asyncio.to_thread(_reject_if_brand_locked, profile.organization_id, payload.brand_name)

    detection_depth: DetectionDepth = resolve_detection_depth(profile.entitlements)
    organization_id = profile.organization_id
    detection_region = payload.target_regions[0] if payload.target_regions else "US"

    try:
        # --- Step 1: scrape first, before touching the database ---
        evidence = await scrape_evidence(
            payload.brand_name,
            payload.platforms,
            payload.official_advertisers or None,
            caller_id=caller_id,
            official_domains=payload.official_domains or None,
        )

        # --- Step 1b: run Tier 0 deterministic funnel ---
        # Filters out obvious_non_match items and produces structured
        # per-item scores without any LLM call.
        if detection_depth in ("tier0", "tier1", "tier2"):
            evidence, scored_items = run_tier0_and_filter(
                evidence, payload.brand_name,
            )
        else:
            scored_items = []

        # --- Step 1c: run Tier 1 similarity scoring (no LLM) ---
        # Computes text/visual/logo/product similarity against brand
        # reference assets. Only runs on ambiguous items from Tier 0.
        if detection_depth in ("tier1", "tier2") and scored_items:
            sb = get_supabase()
            brand_id = None
            try:
                brand_res = (
                    sb.table("brands")
                    .select("id")
                    .eq("organization_id", organization_id)
                    .eq("brand_name", payload.brand_name)
                    .maybe_single()
                    .execute()
                )
                if brand_res and brand_res.data:
                    brand_id = brand_res.data.get("id")
            except Exception:
                pass

            if brand_id:
                scored_items = await asyncio.to_thread(
                    run_tier1, evidence, scored_items, brand_id,
                )
                evidence = filter_evidence_by_scored(evidence, scored_items)
                scored_items = [s for s in scored_items if s.verdict != "obvious_non_match"]

        # Sync calculated similarity scores back to the domain evidence items
        if scored_items:
            score_map = {item.source_url: item.overall_score for item in scored_items}
            for d in evidence.domains:
                target_url = f"https://{d.domain_name}"
                if target_url in score_map:
                    d.similarity_score = int(score_map[target_url] * 100)

        has_evidence = (
            len(evidence.marketplaces) > 0
            or len(evidence.ads) > 0
            or len(evidence.domains) > 0
            or len(evidence.social) > 0
        )

        # --- Step 2: if nothing found, return early — no DB writes ---
        if not has_evidence:
            return {
                "case_id": None,
                "no_findings": True,
                "decision": None,
                "evidence": evidence.model_dump(),
                "takedown_reports": [],
                "detection_region": detection_region,
                "detection_depth": detection_depth,
            }

        # --- Step 3: copycats found → create the case now ---
        case_id = create_case(
            brand_name=payload.brand_name,
            organization_id=organization_id,
            detection_region=detection_region,
            target_regions=payload.target_regions,
            client_id=payload.client_id,
            user_id=profile.id,
        )

        save_evidence(case_id, evidence)
        try:
            persist_all_infringements(case_id, evidence, scored_items=scored_items)
        except Exception as persist_err:
            print(f"[warn] persist_all_infringements failed for {case_id}: {persist_err}")

        # Persist Tier 0 scored items to evidence_items table
        if scored_items:
            try:
                for scored in scored_items:
                    persist_scored_evidence_item(case_id, scored)
            except Exception as scored_err:
                print(f"[warn] persist_scored_evidence_item failed for {case_id}: {scored_err}")

        decision = make_decision(evidence, scored_items=scored_items if scored_items else None)
        score = score_evidence(evidence)
        save_decision(case_id, decision, score=score)
        reports = generate_takedown_reports(
            case_id=case_id,
            brand_name=payload.brand_name,
            decision=decision,
            evidence=evidence,
        )
        return {
            "case_id": case_id,
            "no_findings": False,
            "decision": decision.model_dump(),
            "evidence": evidence.model_dump(),
            "takedown_reports": [r.model_dump() for r in reports],
            "detection_region": detection_region,
            "detection_depth": detection_depth,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# NOTE: Meta token exchange moved to the admin portal (admin-api → /internal/meta/
# exchange-token). Removed from the customer API during the admin split (Fazė 6).


class UpdateStatusRequest(BaseModel):
    status: str
    decline_reason: str | None = None


@router.post("/{case_id}/status")
def update_status_endpoint(case_id: str, payload: UpdateStatusRequest, profile: CurrentProfile = Depends(get_current_profile)):
    sb = get_supabase()
    _assert_case_in_org(sb, case_id, profile.organization_id, profile.id)
    try:
        update_case_status(case_id, payload.status, decline_reason=payload.decline_reason)
        
        if payload.status == "escalated":
            case_data = get_full_case(case_id)
            reports = case_data.get("takedown_reports") or []
            if not reports:
                decisions = case_data.get("decisions") or []
                if decisions:
                    decision_row = decisions[0]
                    decision = Decision(
                        risk_level=decision_row["risk_level"],
                        recommended_action=decision_row["recommended_action"],
                        case_summary=decision_row["case_summary"],
                        confidence_score=decision_row["confidence_score"],
                        evidence_quality=decision_row.get("evidence_quality") or "MODERATE",
                        key_findings=decision_row.get("key_findings") or [],
                    )
                    
                    evidences = case_data.get("evidence") or []
                    if evidences:
                        evidence_row = evidences[0]
                        evidence = Evidence(
                            marketplaces=evidence_row.get("marketplaces") or [],
                            ads=evidence_row.get("ads") or [],
                            domains=evidence_row.get("domains") or [],
                            social=evidence_row.get("social") or [],
                        )
                        
                        generate_takedown_reports(
                            case_id=case_id,
                            brand_name=case_data["brand_name"],
                            decision=decision,
                            evidence=evidence,
                            force=True
                        )
                        update_decision_action(case_id, "TAKEDOWN")
                        
        if payload.status in ("escalated", "dismissed"):
            try:
                from tracemark_api.services.notifications import dispatch_notifications
                from tracemark_api.services.delivery_log import log_delivery
                event_type = f"case_{payload.status}"  # case_escalated or case_dismissed
                event = {
                    "type": event_type,
                    "case_id": case_id,
                }
                dispatch_notifications(event)
                log_delivery(event_type, ok=True, payload=event)
            except Exception as e:
                try:
                    from tracemark_api.services.delivery_log import log_delivery
                    log_delivery(f"case_{payload.status}", ok=False, error=str(e))
                except Exception:
                    pass
                        
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class TakedownUpdateRequest(BaseModel):
    notice_text: str | None = None
    status: Literal["pending", "sent", "acknowledged"] | None = None


@router.put("/takedowns/{id}")
def update_takedown_report_endpoint(
    id: str,
    payload: TakedownUpdateRequest,
    profile: CurrentProfile = Depends(get_current_profile),
):
    """
    Update notice text and status of a takedown report in Supabase.
    If status transitions to 'sent', automatically record submitted_at time.
    """
    sb = get_supabase()
    _assert_takedown_in_org(sb, id, profile.organization_id, profile.id)

    update_data = {}
    if payload.notice_text is not None:
        update_data["notice_text"] = payload.notice_text
    if payload.status is not None:
        update_data["status"] = payload.status
        if payload.status == "sent":
            from datetime import datetime, timezone
            update_data["submitted_at"] = datetime.now(timezone.utc).isoformat()
            
    if not update_data:
        try:
            res = sb.table("takedown_reports").select("*").eq("id", id).execute()
            if not res.data:
                raise HTTPException(status_code=404, detail=f"Takedown report with ID {id} not found")
            return res.data[0]
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(status_code=500, detail=str(e))
            
    try:
        res = sb.table("takedown_reports").update(update_data).eq("id", id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail=f"Takedown report with ID {id} not found")
        return res.data[0]
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))


class TestEmailRequest(BaseModel):
    email: EmailStr


@router.post("/notifications/test/email")
@limiter.limit("3/hour")
def test_email_notification_endpoint(
    request: Request,
    payload: TestEmailRequest,
    current_user=Depends(get_current_user),
):
    """
    Fire a test email notification payload to check connectivity.
    """
    try:
        from tracemark_api.services.notifications import send_email_notification
        event = {
            "type": "test",
            "message": "This is a test notification from HAKKIU to verify SMTP configuration.",
            "brand_name": "Test Brand",
        }
        send_email_notification(event, payload.email)
        return {"success": True, "message": f"Test email sent to {payload.email}"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to send test email: {str(e)}")


@router.post("/takedowns/{id}/send-email")
def send_takedown_email_endpoint(
    id: str,
    profile: CurrentProfile = Depends(get_current_profile),
):
    """
    Send the notice text of the takedown report to its submission_email via SMTP,
    update status to 'sent', and set submitted_at to now.
    """
    sb = get_supabase()
    report = _assert_takedown_in_org(sb, id, profile.organization_id, profile.id)

    recipient = report.get("submission_email")
    if not recipient:
        raise HTTPException(status_code=400, detail="Submission email is not configured for this platform")

    notice_text = report.get("notice_text", "")

    try:
        from tracemark_api.services.delivery_log import log_delivery
        from tracemark_api.services.notifications import send_email_notification

        event = {
            "type": "test",  # Send raw notice text as a test event containing the notice text
            "message": notice_text,
            "brand_name": "Takedown Notice",
        }
        send_email_notification(event, recipient)

        # Log delivery
        log_delivery(
            event_type="takedown_submitted",
            ok=True,
            payload={"takedown_report_id": id, "recipient": recipient},
        )

        # Update status and submitted_at
        from datetime import datetime, timezone
        submitted_at = datetime.now(timezone.utc).isoformat()
        sb.table("takedown_reports").update({
            "status": "sent",
            "submitted_at": submitted_at,
        }).eq("id", id).execute()

        return {
            "success": True,
            "message": f"Takedown notice sent to {recipient}",
            "submitted_at": submitted_at,
        }
    except Exception as e:
        try:
            from tracemark_api.services.delivery_log import log_delivery
            log_delivery(
                event_type="takedown_submitted",
                ok=False,
                error=str(e),
                payload={"takedown_report_id": id, "recipient": recipient},
            )
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Failed to send takedown email: {str(e)}")
