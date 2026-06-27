from __future__ import annotations

import os
from datetime import datetime
from typing import TypedDict, Literal
from dataclasses import dataclass
from pydantic import BaseModel, Field as PydanticField
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, START, END


# ---------------------------------------------------------------------------
# Pydantic Models
# ---------------------------------------------------------------------------

class MarketplaceEvidence(BaseModel):
    platform: str = PydanticField(description="The marketplace name (e.g. Amazon, eBay, AliExpress).")
    seller_name: str = PydanticField(description="The name of the merchant/seller.")
    listing_url: str = PydanticField(description="Direct URL to the listing.")
    price: str | None = PydanticField(default=None, description="The listed price of the product.")
    screenshot_url: str | None = PydanticField(default=None, description="Screenshot URL if available.")


class AdEvidence(BaseModel):
    platform: str = PydanticField(description="The advertising platform (e.g. Google Ads, Facebook Ads).")
    ad_copy: str = PydanticField(description="The text content or headline of the ad.")
    destination_url: str = PydanticField(description="The destination URL the ad directs to.")
    screenshot_url: str | None = PydanticField(default=None, description="Screenshot URL of the ad.")


class DomainEvidence(BaseModel):
    domain_name: str = PydanticField(description="The registered domain name.")
    registrar: str | None = PydanticField(default=None, description="The registrar of the domain.")
    is_clone: bool = PydanticField(description="Whether the site appears to be a clone/impersonator of the brand.")
    similarity_score: int = PydanticField(description="Visual/content similarity percentage from 0 to 100.")
    screenshot_url: str | None = PydanticField(default=None, description="Screenshot URL of the clone domain.")
    creation_date: str | None = PydanticField(default=None, description="Domain registration creation date.")
    expiry_date: str | None = PydanticField(default=None, description="Domain registration expiration date.")
    name_servers: list[str] | None = PydanticField(default=None, description="Active name servers routing the domain.")
    registrant_organization: str | None = PydanticField(default=None, description="Registrant organization name if available.")
    registrant_country: str | None = PydanticField(default=None, description="Registrant organization or contact country.")
    registrant_email: str | None = PydanticField(default=None, description="Registrant or registrar abuse email address.")


class SocialEvidence(BaseModel):
    platform: str = PydanticField(description="The social media platform (e.g. Instagram, TikTok, Facebook).")
    handle: str = PydanticField(description="The social account handle.")
    post_url: str | None = PydanticField(default=None, description="Direct URL to a specific infringing post.")
    follower_count: int | None = PydanticField(default=None, description="Follower count of the account.")


class Evidence(BaseModel):
    marketplaces: list[MarketplaceEvidence] = PydanticField(default_factory=list)
    ads: list[AdEvidence] = PydanticField(default_factory=list)
    domains: list[DomainEvidence] = PydanticField(default_factory=list)
    social: list[SocialEvidence] = PydanticField(default_factory=list)
    blocked_apis: list[str] = PydanticField(default_factory=list)
    timestamp: datetime = PydanticField(default_factory=datetime.now)


class Decision(BaseModel):
    risk_level: Literal["HIGH", "MEDIUM", "LOW"] = PydanticField(description="Risk level of the infringement.")
    recommended_action: Literal["TAKEDOWN", "MONITOR", "DISMISS"] = PydanticField(description="Recommended enforcement action.")
    case_summary: str = PydanticField(description="2-3 sentence AI-generated summary of findings.")
    confidence_score: float = PydanticField(ge=0.0, le=1.0, description="Agent confidence in this decision.")
    evidence_quality: Literal["STRONG", "MODERATE", "WEAK"] = PydanticField(default="MODERATE")
    key_findings: list[str] = PydanticField(default_factory=list, description="Bullet list of key evidence points.")


class AIAnalysis(BaseModel):
    """Structured AI analysis of a single evidence screenshot."""
    brand_match_detected: bool = PydanticField(
        description="Whether the brand name or logo was detected in the image."
    )
    brand_names_found: list[str] = PydanticField(
        default_factory=list,
        description="Brand names or trademarks visible in the image.",
    )
    counterfeit_indicators: list[str] = PydanticField(
        default_factory=list,
        description="Specific indicators of counterfeiting (e.g., price anomaly, poor packaging).",
    )
    visual_similarity_score: float = PydanticField(
        ge=0.0, le=1.0,
        default=0.0,
        description="How visually similar the product looks to the authentic brand (0.0–1.0).",
    )
    text_content_summary: str = PydanticField(
        default="",
        description="Summary of all text visible in the screenshot.",
    )
    risk_assessment: str = PydanticField(
        default="",
        description="Brief risk assessment of the evidence (1–2 sentences).",
    )


@dataclass(slots=True)
class AnalysisResult:
    evidence: Evidence | None
    decision: Decision | None


# ---------------------------------------------------------------------------
# Graph 1: URL analysis (used by /analyze endpoint)
# ---------------------------------------------------------------------------

class AnalysisAgentState(TypedDict):
    url: str
    scraped_content: str
    evidence: Evidence | None
    decision: Decision | None


def build_agent_graph():
    api_key = os.environ.get("GEMINI_API_KEY")
    workflow = StateGraph(AnalysisAgentState)

    def gather_evidence(state: AnalysisAgentState) -> dict:
        if not api_key:
            is_mock_threat = "threat" in state["scraped_content"].lower() or "suspicious" in state["scraped_content"].lower()
            mock_evidence = Evidence(
                marketplaces=[
                    MarketplaceEvidence(
                        platform="AliExpress",
                        seller_name="ShenzhenAudioMax",
                        listing_url=state["url"],
                        price="$22.40",
                    )
                ] if is_mock_threat else [],
                ads=[],
                domains=[],
                social=[],
            )
            return {"evidence": mock_evidence}

        model = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            temperature=0.0,
            google_api_key=api_key,
        ).with_structured_output(Evidence)

        prompt = (
            "You are a brand protection risk assessor. Analyze the scraped page content below and extract "
            "all evidence of trademark infringement, counterfeit sales, or brand abuse.\n\n"
            f"URL: {state['url']}\n"
            f"Content:\n{state['scraped_content']}\n\n"
            "Extract the evidence and output the structured result."
        )
        from tracemark_api.services.api_usage_tracker import call_with_tracking
        return {"evidence": call_with_tracking("gemini_flash", "system", "/analyze", lambda: model.invoke(prompt))}

    def make_decision_node(state: AnalysisAgentState) -> dict:
        if not api_key:
            has_evidence = bool(state["evidence"] and state["evidence"].marketplaces)
            return {"decision": Decision(
                risk_level="HIGH" if has_evidence else "LOW",
                recommended_action="TAKEDOWN" if has_evidence else "DISMISS",
                case_summary=f"Cloned listing found for URL: {state['url']}" if has_evidence else "No threats found.",
                confidence_score=0.9 if has_evidence else 0.1,
                evidence_quality="STRONG" if has_evidence else "WEAK",
                key_findings=[f"Found listing at {state['url']}"] if has_evidence else [],
            )}

        prompt = (
            "You are a senior brand safety lawyer. Review the evidence to make a final enforcement decision.\n\n"
            f"URL: {state['url']}\n"
            f"Evidence: {state['evidence']}\n"
            f"Content:\n{state['scraped_content']}\n\n"
            "Return risk_level, recommended_action, case_summary, confidence_score, evidence_quality, key_findings."
        )
        from tracemark_api.services.api_usage_tracker import call_with_tracking
        try:
            model = ChatGoogleGenerativeAI(
                model="gemini-2.5-pro",
                temperature=0.0,
                google_api_key=api_key,
            ).with_structured_output(Decision)
            decision = call_with_tracking("gemini_pro", "system", "/analyze", lambda: model.invoke(prompt))
        except Exception as e:
            print(f"[AI Agent] gemini-2.5-pro decision failed or limit reached: {e}. Falling back to gemini-2.5-flash.")
            try:
                model_flash = ChatGoogleGenerativeAI(
                    model="gemini-2.5-flash",
                    temperature=0.0,
                    google_api_key=api_key,
                ).with_structured_output(Decision)
                decision = call_with_tracking("gemini_flash", "system", "/analyze", lambda: model_flash.invoke(prompt))
            except Exception as flash_e:
                print(f"[AI Agent] Fallback to gemini-2.5-flash also failed: {flash_e}")
                raise flash_e
        return {"decision": decision}

    workflow.add_node("gather_evidence", gather_evidence)
    workflow.add_node("make_decision", make_decision_node)
    workflow.add_edge(START, "gather_evidence")
    workflow.add_edge("gather_evidence", "make_decision")
    workflow.add_edge("make_decision", END)
    return workflow.compile()


def analyze_listing(payload: dict) -> AnalysisResult:
    graph = build_agent_graph()
    final_state = graph.invoke({
        "url": payload.get("url", ""),
        "scraped_content": payload.get("markdown", ""),
        "evidence": None,
        "decision": None,
    })
    return AnalysisResult(
        evidence=final_state.get("evidence"),
        decision=final_state.get("decision"),
    )


# ---------------------------------------------------------------------------
# Graph 2: Standalone decision agent (used by /make-decision and /check-brand)
# ---------------------------------------------------------------------------

class DecisionAgentState(TypedDict):
    evidence: Evidence
    decision: Decision | None
    error: str | None
    analysis_summary: str


def _analyze_evidence_node(state: DecisionAgentState) -> DecisionAgentState:
    from tracemark_api.services.evidence_scorer import score_evidence

    evidence = state["evidence"]
    score = score_evidence(evidence)
    if score.is_empty:
        state["analysis_summary"] = "No evidence collected."
        return state

    api_key = os.environ.get("GEMINI_API_KEY")

    if not api_key:
        state["analysis_summary"] = f"Mock analysis: {len(evidence.marketplaces)} marketplace listing(s) found."
        return state

    model = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        temperature=0.0,
        google_api_key=api_key,
    )
    prompt = f"""
Analyze the following brand protection evidence and summarize the findings.
Focus on: ad hijacking (unauthorized paid ads using the brand), suspicious marketplace listings,
and typosquatting domains that steal traffic from established brands.

Evidence:
- Marketplace listings: {len(evidence.marketplaces)} found
- Listings detail: {[m.model_dump() for m in evidence.marketplaces[:5]]}
- Ads detected: {[a.model_dump() for a in evidence.ads[:5]]}
- Suspicious domains: {[d.model_dump() for d in evidence.domains[:10]]}

Return a concise factual summary (3-5 sentences) of what was found.
"""
    from tracemark_api.services.api_usage_tracker import call_with_tracking
    response = call_with_tracking("gemini_flash", "system", "/check-brand", lambda: model.invoke(prompt))
    state["analysis_summary"] = response.content
    return state


def _make_decision_node(state: DecisionAgentState) -> DecisionAgentState:
    from tracemark_api.services.evidence_scorer import score_evidence

    evidence = state["evidence"]
    summary = state.get("analysis_summary", "")
    api_key = os.environ.get("GEMINI_API_KEY")
    score = score_evidence(evidence)

    # Short-circuit: if no evidence at all, dismiss without calling Gemini
    if score.is_empty:
        state["decision"] = Decision(
            risk_level="LOW",
            recommended_action="DISMISS",
            case_summary=(
                "No suspicious activity detected. No marketplace listings, "
                "ads, domains, or social media profiles were found for this brand."
            ),
            confidence_score=0.95,
            evidence_quality="WEAK",
            key_findings=["Zero evidence items collected across all monitored sources"],
        )
        return state

    if not api_key:
        has_listings = len(evidence.marketplaces) > 0
        state["decision"] = Decision(
            risk_level="HIGH" if has_listings else "LOW",
            recommended_action="TAKEDOWN" if has_listings else "DISMISS",
            case_summary=(
                f"Mock decision. Found {len(evidence.marketplaces)} marketplace listing(s). "
                "Real Gemini analysis will run when GEMINI_API_KEY is set."
            ),
            confidence_score=0.85 if has_listings else 0.1,
            evidence_quality=score.quality_label,
            key_findings=score.top_findings,
        )
        return state

    prompt = f"""
You are a brand protection legal analyst. Based on the structured evidence below,
make an enforcement decision.

PRE-COMPUTED EVIDENCE QUALITY SCORE: {score.total_score:.2f}/1.0 ({score.quality_label})
- Marketplace listings score: {score.marketplace_score:.2f}
- Ads score: {score.ads_score:.2f}
- Domain surveillance score: {score.domains_score:.2f}
- Social media score: {score.social_score:.2f}

KEY FINDINGS (pre-extracted):
{chr(10).join(f'• {f}' for f in score.top_findings)}

RAW COUNTS:
- Marketplace listings: {len(evidence.marketplaces)}
- Suspicious ads: {len(evidence.ads)}
- Suspicious domains: {len(evidence.domains)}

EVIDENCE SUMMARY: {summary}

SAMPLE LISTINGS (up to 5):
{[m.model_dump() for m in evidence.marketplaces[:5]]}

DECISION GUIDELINES:
- Use the pre-computed evidence score to anchor your confidence_score (e.g. score 0.7 → confidence ~0.7-0.8)
- HIGH + TAKEDOWN: evidence_score >= 0.65 OR ad hijacking detected OR 5+ marketplace listings
- MEDIUM + MONITOR: evidence_score 0.30-0.64 OR 1-4 listings OR suspicious domains only
- LOW + DISMISS: evidence_score < 0.30 AND no marketplace listings

Return risk_level, recommended_action, case_summary, confidence_score, evidence_quality, key_findings.
"""
    from tracemark_api.services.api_usage_tracker import call_with_tracking, ApiLimitError
    try:
        model = ChatGoogleGenerativeAI(
            model="gemini-2.5-pro",
            temperature=0.0,
            google_api_key=api_key,
        ).with_structured_output(Decision)
        state["decision"] = call_with_tracking("gemini_pro", "system", "/check-brand", lambda: model.invoke(prompt))
    except Exception as e:
        print(f"[AI Decision Node] gemini-2.5-pro failed or limit reached: {e}. Falling back to gemini-2.5-flash.")
        try:
            model_flash = ChatGoogleGenerativeAI(
                model="gemini-2.5-flash",
                temperature=0.0,
                google_api_key=api_key,
            ).with_structured_output(Decision)
            state["decision"] = call_with_tracking("gemini_flash", "system", "/check-brand", lambda: model_flash.invoke(prompt))
        except ApiLimitError as e_limit:
            state["error"] = str(e_limit)
            state["decision"] = Decision(
                risk_level="LOW",
                recommended_action="DISMISS",
                case_summary=f"Gemini Flash limit reached during fallback: {e_limit}",
                confidence_score=0.0,
                evidence_quality="WEAK",
                key_findings=[],
            )
        except Exception as e_flash:
            import traceback
            traceback.print_exc()
            state["error"] = str(e_flash)
            state["decision"] = Decision(
                risk_level="LOW",
                recommended_action="DISMISS",
                case_summary="Agent error — could not complete analysis with fallback model.",
                confidence_score=0.0,
                evidence_quality="WEAK",
                key_findings=[],
            )
    return state


def build_decision_graph():
    graph = StateGraph(DecisionAgentState)
    graph.add_node("analyze_evidence", _analyze_evidence_node)
    graph.add_node("make_decision", _make_decision_node)
    graph.set_entry_point("analyze_evidence")
    graph.add_edge("analyze_evidence", "make_decision")
    graph.add_edge("make_decision", END)
    return graph.compile()


def make_decision(evidence: Evidence) -> Decision:
    graph = build_decision_graph()
    final_state = graph.invoke({
        "evidence": evidence,
        "decision": None,
        "error": None,
        "analysis_summary": "",
    })
    return final_state["decision"]


# ---------------------------------------------------------------------------
# Per-evidence AI analysis (populates evidence.ai_analysis jsonb)
# ---------------------------------------------------------------------------

def generate_evidence_analysis(
    screenshot_url: str,
    brand_name: str,
) -> dict | None:
    """
    Analyse a single evidence screenshot with Gemini Vision and return
    a structured ``AIAnalysis`` dict suitable for storing in the
    ``evidence.ai_analysis`` jsonb column.

    Returns ``None`` when no API key is configured or on failure.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        # Return a minimal mock so callers always get *something*
        return AIAnalysis(
            brand_match_detected=False,
            brand_names_found=[],
            counterfeit_indicators=[],
            visual_similarity_score=0.0,
            text_content_summary="Mock: no Gemini API key configured.",
            risk_assessment="Unable to analyse — API key missing.",
        ).model_dump()

    try:
        import base64
        import httpx
        from langchain_core.messages import HumanMessage

        # Download the screenshot
        resp = httpx.get(screenshot_url, timeout=20.0, follow_redirects=True)
        if resp.status_code != 200:
            print(f"[AI] Failed to download screenshot: HTTP {resp.status_code}")
            return None

        b64_image = base64.b64encode(resp.content).decode("utf-8")

        # Determine MIME type from content-type header, default to png
        content_type = resp.headers.get("content-type", "image/png").split(";")[0].strip()

        message = HumanMessage(
            content=[
                {
                    "type": "text",
                    "text": (
                        f"You are a brand protection analyst. Analyse this product screenshot "
                        f"for potential infringement of the brand \"{brand_name}\".\n\n"
                        f"Return a structured analysis with:\n"
                        f"- brand_match_detected: true/false\n"
                        f"- brand_names_found: list of brand names visible\n"
                        f"- counterfeit_indicators: list of red flags\n"
                        f"- visual_similarity_score: 0.0–1.0\n"
                        f"- text_content_summary: all text in the image\n"
                        f"- risk_assessment: 1–2 sentence risk summary"
                    ),
                },
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:{content_type};base64,{b64_image}"},
                },
            ]
        )

        model = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            temperature=0.0,
            google_api_key=api_key,
        ).with_structured_output(AIAnalysis)

        from tracemark_api.services.api_usage_tracker import call_with_tracking
        result: AIAnalysis = call_with_tracking(
            "gemini_flash", "system", "/evidence-analysis",
            lambda: model.invoke([message]),
        )
        return result.model_dump()

    except Exception as e:
        print(f"[AI] generate_evidence_analysis failed: {e}")
        return None
