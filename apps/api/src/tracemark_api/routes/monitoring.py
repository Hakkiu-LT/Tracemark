from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from tracemark_api.services.scraper import scrape_page
from tracemark_api.services.ai import analyze_listing, Evidence, Decision
from tracemark_api.services.decision import make_decision
from tracemark_api.services.marketplace import gather_evidence as scrape_evidence

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
    platforms: list[str] = ["amazon", "whois"]


@router.post("/gather-evidence", response_model=Evidence)
def gather_evidence_endpoint(payload: GatherEvidenceRequest) -> Evidence:
    try:
        evidence = scrape_evidence(payload.brand_name, payload.platforms)
        return evidence
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

