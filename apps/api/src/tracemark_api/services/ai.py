from __future__ import annotations

import os
import re
from datetime import datetime
from typing import TypedDict, Literal
from dataclasses import dataclass
from pydantic import BaseModel, Field as PydanticField
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, START, END


def _sanitize_brand_name(name: str) -> str:
    """Strip prompt-injection attempts from brand names before LLM interpolation.

    Removes instruction-like keywords and limits length so a user-supplied
    brand name cannot hijack the LLM system prompt.
    """
    # Strip common prompt-injection signal words
    cleaned = re.sub(
        r"(?i)\b(ignore|disregard|forget|override|system|assistant|user|instruction|prompt)\b",
        "",
        name,
    )
    # Remove non-printable / control characters
    cleaned = re.sub(r"[\x00-\x1f\x7f]", "", cleaned)
    # Collapse extra whitespace and truncate
    cleaned = " ".join(cleaned.split())[:120]
    return cleaned or "unknown"


# ---------------------------------------------------------------------------
# Pydantic Models
# ---------------------------------------------------------------------------

class MarketplaceEvidence(BaseModel):
    platform: str = PydanticField(description="The marketplace name (e.g. Amazon, eBay, AliExpress).")
    seller_name: str = PydanticField(description="The name of the merchant/seller.")
    listing_url: str = PydanticField(description="Direct URL to the listing.")
    price: str | None = PydanticField(default=None, description="The listed price of the product.")
    screenshot_url: str | None = PydanticField(default=None, description="Screenshot URL if available.")
    detection_region: str | None = PydanticField(default=None, description="The 2-letter ISO country code where this evidence was detected.")


class AdEvidence(BaseModel):
    platform: str = PydanticField(description="The advertising platform (e.g. Google Ads, Facebook Ads).")
    ad_copy: str = PydanticField(description="The text content or headline of the ad.")
    destination_url: str = PydanticField(description="The destination URL the ad directs to.")
    screenshot_url: str | None = PydanticField(default=None, description="Screenshot URL of the ad.")
    detection_region: str | None = PydanticField(default=None, description="The 2-letter ISO country code where this evidence was detected.")


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
    detection_region: str | None = PydanticField(default=None, description="The 2-letter ISO country code where this evidence was detected.")


class SocialEvidence(BaseModel):
    platform: str = PydanticField(description="The social media platform (e.g. Instagram, TikTok, Facebook).")
    handle: str = PydanticField(description="The social account handle.")
    post_url: str | None = PydanticField(default=None, description="Direct URL to a specific infringing post.")
    screenshot_url: str | None = PydanticField(default=None, description="Screenshot URL of the social profile or post.")
    follower_count: int | None = PydanticField(default=None, description="Follower count of the account.")
    detection_region: str | None = PydanticField(default=None, description="The 2-letter ISO country code where this evidence was detected.")


class Evidence(BaseModel):
    marketplaces: list[MarketplaceEvidence] = PydanticField(default_factory=list)
    ads: list[AdEvidence] = PydanticField(default_factory=list)
    domains: list[DomainEvidence] = PydanticField(default_factory=list)
    social: list[SocialEvidence] = PydanticField(default_factory=list)
    blocked_apis: list[str] = PydanticField(default_factory=list)
    scanned_platforms: list[str] = PydanticField(default_factory=list, description="List of platform names that were actually scanned/monitored.")
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


class CriterionScore(BaseModel):
    name: str = PydanticField(description="Criterion identifier (e.g. brand_name_match, visual_similarity).")
    score: float = PydanticField(ge=0.0, le=1.0, description="Score for this criterion (0.0-1.0).")
    evidence: str = PydanticField(default="", description="Human-readable evidence or reference for this score.")


class Tier0Signals(BaseModel):
    """Deterministic signals computed without any LLM call (Tier 0)."""
    typosquat_distance: int | None = PydanticField(default=None, description="Levenshtein distance between domain and brand (None if not a domain).")
    brand_name_match_score: float = PydanticField(ge=0.0, le=1.0, default=0.0, description="Fuzzy match score of brand name in title/meta/URL.")
    domain_age_days: int | None = PydanticField(default=None, description="Domain age in days (None if not applicable).")
    registrar_reputation: Literal["trusted", "neutral", "suspicious", "unknown"] = PydanticField(default="unknown")
    ssl_issuer: str | None = PydanticField(default=None, description="SSL certificate issuer organization.")
    ssl_suspicious: bool = PydanticField(default=False, description="Whether SSL cert has suspicious characteristics.")
    ad_hijack_score: int | None = PydanticField(default=None, ge=0, le=100, description="Ad hijacking heuristic score 0-100 (None if not an ad).")
    overall_score: float = PydanticField(ge=0.0, le=1.0, default=0.0, description="Aggregate Tier 0 score.")
    classification: Literal["obvious_copycat", "obvious_non_match", "ambiguous"] = PydanticField(default="ambiguous")


class Tier1Signals(BaseModel):
    """Similarity scores computed without LLM (Tier 1), using embeddings and pHash."""
    text_similarity: float | None = PydanticField(default=None, ge=0.0, le=1.0, description="Cosine similarity of page content embedding vs reference content.")
    visual_similarity: float | None = PydanticField(default=None, ge=0.0, le=1.0, description="pHash-based visual similarity of screenshot vs reference.")
    logo_similarity: float | None = PydanticField(default=None, ge=0.0, le=1.0, description="pHash similarity of detected logo vs reference logo.")
    product_similarity: float | None = PydanticField(default=None, ge=0.0, le=1.0, description="pHash similarity of product image vs reference product image.")
    content_hash: str | None = PydanticField(default=None, description="SHA-256 hash of page content for dedup/caching.")
    overall_score: float = PydanticField(ge=0.0, le=1.0, default=0.0, description="Aggregate Tier 1 score.")
    classification: Literal["obvious_copycat", "obvious_non_match", "ambiguous"] = PydanticField(default="ambiguous")


class ScoredEvidenceItem(BaseModel):
    """Unified per-detection record with tiered scoring and evidence trail."""
    source_url: str
    platform: str
    screenshot_url: str | None = None
    content_hash: str | None = None
    tier0: Tier0Signals | None = None
    tier1: Tier1Signals | None = None
    tier2_score: float | None = PydanticField(default=None, ge=0.0, le=1.0)
    overall_score: float = PydanticField(ge=0.0, le=1.0, default=0.0)
    verdict: Literal["obvious_copycat", "likely_copycat", "ambiguous", "obvious_non_match"] = "ambiguous"
    category: list[str] = PydanticField(default_factory=list)
    criteria: list[CriterionScore] = PydanticField(default_factory=list)
    confidence: Literal["high", "medium", "low"] = "low"
    scraped_at: datetime = PydanticField(default_factory=datetime.now)
    first_seen_at: datetime = PydanticField(default_factory=datetime.now)
    status: Literal["new", "reviewed", "actioned"] = "new"


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
                scanned_platforms=["amazon", "ebay", "aliexpress", "google_ads", "meta_ads", "domains", "tiktok", "instagram"],
            )
            return {"evidence": mock_evidence}

        model = ChatGoogleGenerativeAI(
            model="gemini-3.5-flash",
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
            print(f"[AI Agent] gemini-2.5-pro decision failed or limit reached: {e}. Falling back to gemini-3.5-flash.")
            try:
                model_flash = ChatGoogleGenerativeAI(
                    model="gemini-3.5-flash",
                    temperature=0.0,
                    google_api_key=api_key,
                ).with_structured_output(Decision)
                decision = call_with_tracking("gemini_flash", "system", "/analyze", lambda: model_flash.invoke(prompt))
            except Exception as flash_e:
                print(f"[AI Agent] Fallback to gemini-3.5-flash also failed: {flash_e}")
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
    scored_items: list[ScoredEvidenceItem] | None


def _evaluate_and_decide_node(state: DecisionAgentState) -> DecisionAgentState:
    """Single-node decision graph: summarize + decide in one Gemini Flash call.

    Replaces the previous two-node design (separate summarization + decision
    calls).  The tiered funnel already provides structured per-item scores,
    so a separate summarization pass adds cost without improving the decision.
    """
    from tracemark_api.services.evidence_scorer import score_evidence
    from tracemark_api.services.api_usage_tracker import call_with_tracking, ApiLimitError

    evidence = state["evidence"]
    scored_items = state.get("scored_items") or []
    api_key = os.environ.get("GEMINI_API_KEY")
    score = score_evidence(evidence)

    # Short-circuit: no evidence → dismiss without calling Gemini
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

    # No API key → mock decision
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

    # Build tiered funnel context
    tiered_context = ""
    if scored_items:
        auto_flagged = [s for s in scored_items if s.verdict == "obvious_copycat"]
        likely = [s for s in scored_items if s.verdict == "likely_copycat"]
        ambiguous = [s for s in scored_items if s.verdict == "ambiguous"]

        tiered_context = f"""
TIERED FUNNEL RESULTS:
- Auto-flagged as obvious copycat (Tier 0/1): {len(auto_flagged)} items
- Likely copycat (Tier 1): {len(likely)} items
- Ambiguous (require your adjudication): {len(ambiguous)} items

PER-ITEM SCORES (ambiguous items only — focus your analysis here):
{chr(10).join(f'• {s.source_url} | score={s.overall_score:.2f} | criteria: {", ".join(c.name + "=" + str(c.score) for c in s.criteria[:3])}' for s in ambiguous[:10])}

AUTO-FLAGGED ITEMS (confirmed by deterministic signals — no adjudication needed):
{chr(10).join(f'• {s.source_url} | score={s.overall_score:.2f}' for s in (auto_flagged + likely)[:10])}
"""

    prompt = f"""You are a brand protection legal analyst. Analyze the evidence below and produce both a factual summary AND an enforcement decision in a single response.

SCANNED PLATFORMS: {evidence.scanned_platforms}

PRE-COMPUTED EVIDENCE QUALITY SCORE: {score.total_score:.2f}/1.0 ({score.quality_label})
- Marketplace listings score: {score.marketplace_score:.2f}
- Ads score: {score.ads_score:.2f}
- Domain surveillance score: {score.domains_score:.2f}
- Social media score: {score.social_score:.2f}
{tiered_context}
KEY FINDINGS (pre-extracted):
{chr(10).join(f'• {f}' for f in score.top_findings)}

RAW COUNTS:
- Marketplace listings: {len(evidence.marketplaces)}
- Suspicious ads: {len(evidence.ads)}
- Suspicious domains: {len(evidence.domains)}

SAMPLE LISTINGS (up to 5):
{[m.model_dump() for m in evidence.marketplaces[:5]]}

SAMPLE ADS (up to 5):
{[a.model_dump() for a in evidence.ads[:5]]}

SAMPLE DOMAINS (up to 10):
{[d.model_dump() for d in evidence.domains[:10]]}

DECISION GUIDELINES:
- Write a 2-3 sentence factual case_summary of what was found.
- Anchor your confidence_score to the pre-computed evidence score relative to the scope of what was scanned.
- If ONLY domains were scanned, evaluate based solely on the domain threat.
- HIGH + TAKEDOWN: evidence_score >= 0.65 OR ad hijacking detected OR 5+ marketplace listings OR a highly similar clone domain.
- MEDIUM + MONITOR: evidence_score 0.30-0.64 OR 1-4 listings OR suspicious domains.
- LOW + DISMISS: evidence_score < 0.30 AND no marketplace listings and no suspicious domains.
- Items auto-flagged by the tiered funnel have high-confidence deterministic scores — rely on those without re-evaluating.
- Focus your analysis on the ambiguous items that lack a clear deterministic signal.

Return risk_level, recommended_action, case_summary, confidence_score, evidence_quality, key_findings.
"""
    try:
        model = ChatGoogleGenerativeAI(
            model="gemini-3.5-flash",
            temperature=0.0,
            google_api_key=api_key,
        ).with_structured_output(Decision)
        state["decision"] = call_with_tracking(
            "gemini_flash", "system", "/check-brand", lambda: model.invoke(prompt),
        )
    except ApiLimitError as e_limit:
        state["error"] = str(e_limit)
        state["decision"] = Decision(
            risk_level="LOW",
            recommended_action="DISMISS",
            case_summary=f"Gemini Flash limit reached: {e_limit}",
            confidence_score=0.0,
            evidence_quality="WEAK",
            key_findings=[],
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        state["error"] = str(e)
        state["decision"] = Decision(
            risk_level="LOW",
            recommended_action="DISMISS",
            case_summary=f"Agent error — could not complete analysis: {e}",
            confidence_score=0.0,
            evidence_quality="WEAK",
            key_findings=[],
        )
    return state


def build_decision_graph():
    graph = StateGraph(DecisionAgentState)
    graph.add_node("evaluate_and_decide", _evaluate_and_decide_node)
    graph.set_entry_point("evaluate_and_decide")
    graph.add_edge("evaluate_and_decide", END)
    return graph.compile()


def make_decision(evidence: Evidence, scored_items: list[ScoredEvidenceItem] | None = None) -> Decision:
    graph = build_decision_graph()
    final_state = graph.invoke({
        "evidence": evidence,
        "decision": None,
        "error": None,
        "scored_items": scored_items,
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

        from tracemark_api.services.ssrf import SSRFError, validate_ssrf_url
        from tracemark_api.services.storage import resolve_screenshot_fetch_url

        # The stored value is now a BARE private-bucket path (C5). Resolve it to a
        # short-lived signed URL the backend can download; legacy full URLs and
        # foreign/mock URLs pass through unchanged.
        fetch_url = resolve_screenshot_fetch_url(screenshot_url) or screenshot_url

        # SSRF guard: screenshot_url can originate from scraped/attacker-controlled
        # evidence data. Validate before fetching and disable redirects so a
        # redirect can't defeat the DNS-rebind check (mirrors embedding_helper.py).
        try:
            validate_ssrf_url(fetch_url)
        except SSRFError as exc:
            print(f"[AI] Refusing to fetch screenshot (SSRF guard): {exc}")
            return None

        # Download the screenshot
        resp = httpx.get(fetch_url, timeout=20.0, follow_redirects=False)
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
                        f"for potential infringement of the brand \"{_sanitize_brand_name(brand_name)}\".\n\n"
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
            model="gemini-3.5-flash",
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
