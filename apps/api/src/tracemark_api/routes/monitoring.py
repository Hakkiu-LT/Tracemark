from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from tracemark_api.services.scraper import scrape_page
from tracemark_api.services.ai import analyze_listing, make_decision, Evidence, Decision
from tracemark_api.services.marketplace import gather_evidence as scrape_evidence, check_ads_hijacking
from tracemark_api.services.database import create_case, save_evidence, save_decision, update_case_status

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
def gather_evidence_endpoint(payload: GatherEvidenceRequest) -> Evidence:
    try:
        evidence = scrape_evidence(
            payload.brand_name,
            payload.platforms,
            payload.official_advertisers or None,
        )
        return evidence
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class CheckAdsRequest(BaseModel):
    brand_name: str
    platforms: list[str] = ["google_ads", "meta_ads"]
    official_advertisers: list[str] = []


@router.post("/check-ads")
def check_ads_endpoint(payload: CheckAdsRequest):
    """
    Detect ad hijacking: unauthorized Google/Meta ads using a brand name to steal traffic.
    Whitelist official page names via official_advertisers (e.g. ["Orbio World", "Orbio Official"]).
    """
    try:
        return check_ads_hijacking(
            payload.brand_name,
            payload.platforms,
            payload.official_advertisers or None,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class CheckBrandRequest(BaseModel):
    brand_name: str
    platforms: list[str] = ["amazon", "google_ads", "meta_ads", "domains"]
    official_advertisers: list[str] = []


@router.post("/check-brand")
def check_brand(payload: CheckBrandRequest):
    """Full pipeline: scrape evidence ΓåÆ AI decision ΓåÆ persist to Supabase."""
    case_id = create_case(payload.brand_name)
    try:
        update_case_status(case_id, "analyzing")
        evidence = scrape_evidence(
            payload.brand_name,
            payload.platforms,
            payload.official_advertisers or None,
        )
        save_evidence(case_id, evidence)
        decision = make_decision(evidence)
        save_decision(case_id, decision)
        return {"case_id": case_id, "decision": decision.model_dump(), "evidence": evidence.model_dump()}
    except Exception as e:
        update_case_status(case_id, "error")
        raise HTTPException(status_code=500, detail=str(e))
