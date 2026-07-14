from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, field_validator
from typing import Literal
from urllib.parse import urlparse
from tracemark_api.services.firecrawl_client import scrape_page
from tracemark_api.services.ai import analyze_listing, make_decision, Evidence, Decision
from tracemark_api.services.marketplace import gather_evidence as scrape_evidence, check_ads_hijacking, exchange_short_lived_meta_token, update_env_meta_token
from tracemark_api.services.database import get_supabase, create_case, save_evidence, save_decision, update_case_status, get_full_case, update_decision_action
from tracemark_api.services.persistence import persist_all_infringements
from tracemark_api.services.takedown import generate_takedown_reports, TakedownReport
from tracemark_api.dependencies import get_current_user, get_current_profile, CurrentProfile

router = APIRouter(prefix="/monitoring", tags=["monitoring"])


_PRIVATE_NETS = ("localhost", "127.", "10.", "172.16.", "172.17.", "172.18.",
                  "172.19.", "172.2", "172.3", "192.168.", "0.0.0.0", "::1", "169.254.")


class MonitorRequest(BaseModel):
    url: str

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        try:
            parsed = urlparse(v)
        except Exception:
            raise ValueError("Invalid URL")
        if parsed.scheme not in ("http", "https"):
            raise ValueError("Only http/https URLs are allowed")
        host = (parsed.hostname or "").lower()
        for private in _PRIVATE_NETS:
            if host.startswith(private) or host == private.rstrip("."):
                raise ValueError("Internal/private URLs are not allowed")
        return v


class MonitorResponse(BaseModel):
    url: str
    title: str | None
    success: bool
    evidence: Evidence | None = None
    decision: Decision | None = None
    error_message: str | None = None


@router.post("/analyze", response_model=MonitorResponse)
def analyze_url(payload: MonitorRequest, current_user=Depends(get_current_user)) -> MonitorResponse:
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
    brand_name: str
    platforms: list[str] = ["amazon", "google_ads", "meta_ads", "domains"]
    official_advertisers: list[str] = []
    # Supported: amazon, ebay, alibaba, aliexpress, google_ads, meta_ads, domains


@router.post("/gather-evidence", response_model=Evidence)
async def gather_evidence_endpoint(
    payload: GatherEvidenceRequest,
    current_user = Depends(get_current_user)
) -> Evidence:
    caller_id = getattr(current_user, "email", None) or getattr(current_user, "id", "system")
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
    brand_name: str
    platforms: list[str] = ["google_ads", "meta_ads"]
    official_advertisers: list[str] = []


@router.post("/check-ads")
async def check_ads_endpoint(
    payload: CheckAdsRequest,
    current_user = Depends(get_current_user)
):
    """
    Detect ad hijacking: unauthorized Google/Meta ads using a brand name to steal traffic.
    Whitelist official page names via official_advertisers (e.g. ["Orbio World", "Orbio Official"]).
    """
    caller_id = getattr(current_user, "email", None) or getattr(current_user, "id", "system")
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
    brand_name: str
    platforms: list[str] = ["amazon", "google_ads", "meta_ads", "domains"]
    official_advertisers: list[str] = []
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
async def check_brand(
    payload: CheckBrandRequest,
    profile: CurrentProfile = Depends(get_current_profile),
):
    """Full pipeline: scrape evidence → AI decision → DMCA reports → persist to Supabase.
    A case is only created in the database if copycats are actually found."""
    caller_id = profile.email or profile.id or "system"

    # Enforce plan entitlements before spending any scraping budget.
    _enforce_scan_entitlements(profile, payload)
    _reject_if_brand_locked(profile.organization_id, payload.brand_name)

    organization_id = profile.organization_id
    detection_region = payload.target_regions[0] if payload.target_regions else "US"

    try:
        # --- Step 1: scrape first, before touching the database ---
        evidence = await scrape_evidence(
            payload.brand_name,
            payload.platforms,
            payload.official_advertisers or None,
            caller_id=caller_id,
        )

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
            persist_all_infringements(case_id, evidence)
        except Exception as persist_err:
            print(f"[warn] persist_all_infringements failed for {case_id}: {persist_err}")

        decision = make_decision(evidence)
        save_decision(case_id, decision)
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
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ExchangeMetaTokenRequest(BaseModel):
    short_lived_token: str


@router.post("/exchange-meta-token")
def exchange_meta_token(payload: ExchangeMetaTokenRequest, current_user=Depends(get_current_user)):
    """
    Exchanges a short-lived user token for a long-lived one,
    updates the .env file locally, and returns the result.
    Restricted to admin users only.
    """
    import os
    admin_emails = {
        e.strip().lower()
        for e in os.environ.get("ADMIN_EMAILS", "").split(",")
        if e.strip()
    }
    if admin_emails and (current_user.email or "").lower() not in admin_emails:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Admin access required.")
    try:
        result = exchange_short_lived_meta_token(payload.short_lived_token)
        new_token = result.get("access_token")
        if not new_token:
            raise HTTPException(status_code=400, detail="Meta API did not return an access token.")
        
        expires_in = result.get("expires_in")
        expires_at_str = None
        if expires_in:
            from datetime import datetime, timedelta, timezone
            expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
            expires_at_str = expires_at.strftime('%Y-%m-%d %H:%M:%S UTC')

        update_env_meta_token(new_token)
        return {
            "success": True,
            "message": "Meta Access Token successfully updated and written to .env.",
            "expires_in_seconds": expires_in,
            "expires_at": expires_at_str,
            "token_type": result.get("token_type")
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


def _verify_case_ownership(sb, case_id: str, profile: CurrentProfile) -> None:
    res = sb.table("cases").select("organization_id, user_id").eq("id", case_id).maybe_single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Case not found")
    case_org = res.data.get("organization_id")
    case_user = res.data.get("user_id")

    if profile.organization_id:
        if case_org != profile.organization_id:
            raise HTTPException(status_code=403, detail="Access denied")
    else:
        if case_user != profile.id:
            raise HTTPException(status_code=403, detail="Access denied")

def _verify_takedown_ownership(sb, takedown_id: str, profile: CurrentProfile) -> None:
    res = sb.table("takedown_reports").select("case_id").eq("id", takedown_id).maybe_single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Takedown report not found")
    case_id = res.data.get("case_id")
    if not case_id:
        raise HTTPException(status_code=403, detail="Access denied")
    _verify_case_ownership(sb, case_id, profile)


class UpdateStatusRequest(BaseModel):
    status: str
    decline_reason: str | None = None


@router.post("/{case_id}/status")
def update_status_endpoint(case_id: str, payload: UpdateStatusRequest, profile: CurrentProfile = Depends(get_current_profile)):
    sb = get_supabase()
    _verify_case_ownership(sb, case_id, profile)

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
    profile: CurrentProfile = Depends(get_current_profile)
):
    """
    Update notice text and status of a takedown report in Supabase.
    If status transitions to 'sent', automatically record submitted_at time.
    """
    sb = get_supabase()
    _verify_takedown_ownership(sb, id, profile)
    
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
    email: str


@router.post("/notifications/test/email")
def test_email_notification_endpoint(
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
            "message": "This is a test notification from Tracemark to verify SMTP configuration.",
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
    _verify_takedown_ownership(sb, id, profile)
    res = sb.table("takedown_reports").select("*").eq("id", id).maybe_single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Takedown report not found")

    report = res.data
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
