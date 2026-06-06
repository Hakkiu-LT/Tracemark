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
    timestamp: datetime = PydanticField(default_factory=datetime.now)


class Decision(BaseModel):
    risk_level: Literal["HIGH", "MEDIUM", "LOW"] = PydanticField(description="Risk level of the infringement.")
    recommended_action: Literal["TAKEDOWN", "MONITOR", "DISMISS"] = PydanticField(description="Recommended enforcement action.")
    case_summary: str = PydanticField(description="2-3 sentence AI-generated summary of findings.")
    confidence_score: float = PydanticField(ge=0.0, le=1.0, description="Agent confidence in this decision.")
    evidence_quality: Literal["STRONG", "MODERATE", "WEAK"] = PydanticField(default="MODERATE")
    key_findings: list[str] = PydanticField(default_factory=list, description="Bullet list of key evidence points.")


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
        return {"evidence": model.invoke(prompt)}

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

        model = ChatGoogleGenerativeAI(
            model="gemini-2.5-pro",
            temperature=0.0,
            google_api_key=api_key,
        ).with_structured_output(Decision)

        prompt = (
            "You are a senior brand safety lawyer. Review the evidence to make a final enforcement decision.\n\n"
            f"URL: {state['url']}\n"
            f"Evidence: {state['evidence']}\n"
            f"Content:\n{state['scraped_content']}\n\n"
            "Return risk_level, recommended_action, case_summary, confidence_score, evidence_quality, key_findings."
        )
        return {"decision": model.invoke(prompt)}

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
    evidence = state["evidence"]
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
    response = model.invoke(prompt)
    state["analysis_summary"] = response.content
    return state


def _make_decision_node(state: DecisionAgentState) -> DecisionAgentState:
    evidence = state["evidence"]
    summary = state.get("analysis_summary", "")
    api_key = os.environ.get("GEMINI_API_KEY")

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
            evidence_quality="MODERATE" if has_listings else "WEAK",
            key_findings=[
                f"Found on: {', '.join(set(m.platform for m in evidence.marketplaces))}"
            ] if has_listings else [],
        )
        return state

    model = ChatGoogleGenerativeAI(
        model="gemini-2.5-pro",
        temperature=0.0,
        google_api_key=api_key,
    ).with_structured_output(Decision)

    prompt = f"""
You are a brand protection legal analyst. Based on the evidence summary below,
make a structured enforcement decision.

Evidence Summary: {summary}

Raw counts:
- Suspicious marketplace listings: {len(evidence.marketplaces)}
- Suspicious ads: {len(evidence.ads)}
- Suspicious domains: {len(evidence.domains)}

Decision criteria:
- HIGH + TAKEDOWN: ad hijacking detected OR 5+ suspicious listings OR counterfeit evidence
- MEDIUM + MONITOR: 1-4 suspicious listings OR suspicious ads/domains without clear hijacking
- LOW + DISMISS: No real evidence found

Return risk_level, recommended_action, case_summary, confidence_score, evidence_quality, key_findings.
"""
    try:
        state["decision"] = model.invoke(prompt)
    except Exception as e:
        state["error"] = str(e)
        state["decision"] = Decision(
            risk_level="LOW",
            recommended_action="DISMISS",
            case_summary="Agent error ΓÇö could not complete analysis.",
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
