from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Literal
from tracemark_api.services.firecrawl_client import scrape_page
from tracemark_api.services.ai import analyze_listing, make_decision, Evidence, Decision
from tracemark_api.services.marketplace import gather_evidence as scrape_evidence, check_ads_hijacking, exchange_short_lived_meta_token, update_env_meta_token
from tracemark_api.services.database import get_supabase, create_case, save_evidence, save_decision, update_case_status, get_full_case, update_decision_action
from tracemark_api.services.persistence import persist_all_infringements
from tracemark_api.services.takedown import generate_takedown_reports, TakedownReport
from tracemark_api.dependencies import get_current_user

router = APIRouter(prefix="/monitoring", tags=["monitoring"])


class MonitorRequest(BaseModel):
    url: str


class MonitorResponse(BaseModel):
    url: str
    title: str | None
    success: bool
    evidence: Evidence | None = None
    decision: Decision | None = None
    error_message: str | None = None


@router.post("/analyze", response_model=MonitorResponse)
def analyze_url(payload: MonitorRequest) -> MonitorResponse:
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
def make_decision_endpoint(evidence: Evidence) -> Decision:
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


@router.post("/check-brand")
async def check_brand(
    payload: CheckBrandRequest,
    current_user = Depends(get_current_user)
):
    """Full pipeline: scrape evidence → AI decision → DMCA reports → persist to Supabase."""
    caller_id = getattr(current_user, "email", None) or getattr(current_user, "id", "system")
    case_id = create_case(payload.brand_name)
    try:
        update_case_status(case_id, "analyzing")
        evidence = await scrape_evidence(
            payload.brand_name,
            payload.platforms,
            payload.official_advertisers or None,
            caller_id=caller_id,
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
            "decision": decision.model_dump(),
            "evidence": evidence.model_dump(),
            "takedown_reports": [r.model_dump() for r in reports],
        }
    except Exception as e:
        update_case_status(case_id, "error")
        raise HTTPException(status_code=500, detail=str(e))


class ExchangeMetaTokenRequest(BaseModel):
    short_lived_token: str


@router.post("/exchange-meta-token")
def exchange_meta_token(payload: ExchangeMetaTokenRequest):
    """
    Exchanges a short-lived user token for a long-lived one,
    updates the .env file locally, and returns the result.
    """
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


class UpdateStatusRequest(BaseModel):
    status: str


@router.post("/{case_id}/status")
def update_status_endpoint(case_id: str, payload: UpdateStatusRequest):
    try:
        update_case_status(case_id, payload.status)
        
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
    current_user = Depends(get_current_user)
):
    """
    Update notice text and status of a takedown report in Supabase.
    If status transitions to 'sent', automatically record submitted_at time.
    """
    sb = get_supabase()
    
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
