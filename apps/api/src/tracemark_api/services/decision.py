from __future__ import annotations
import os
from tracemark_api.services.ai import Evidence, Decision
from langchain_google_genai import ChatGoogleGenerativeAI


def make_decision(evidence: Evidence) -> Decision:
    """
    Given an Evidence object, call Gemini to produce a structured Decision.
    Falls back to mock if GEMINI_API_KEY is not set.
    """
    api_key = os.environ.get("GEMINI_API_KEY")

    if not api_key:
        has_listings = len(evidence.marketplaces) > 0
        return Decision(
            recommendation="YES" if has_listings else "NO",
            confidence=85 if has_listings else 10,
            reasoning=(
                f"Mock decision. Found {len(evidence.marketplaces)} marketplace listing(s). "
                "Real Gemini analysis will run when GEMINI_API_KEY is set."
            ),
            case_summary=(
                f"Detected potential infringement on: "
                f"{', '.join(set(m.platform for m in evidence.marketplaces)) or 'none'}."
            ),
            priority="HIGH" if has_listings else "LOW"
        )

    model = ChatGoogleGenerativeAI(
        model="gemini-1.5-pro",
        temperature=0.0,
        google_api_key=api_key
    ).with_structured_output(Decision)

    prompt = f"""
You are a senior brand safety lawyer. Review the following evidence of potential trademark
infringement and make a decision on whether to pursue a takedown action.

Evidence:
- Marketplace listings: {len(evidence.marketplaces)} found
- Ads: {len(evidence.ads)} found
- Suspicious domains: {len(evidence.domains)} found
- Social media violations: {len(evidence.social)} found

Details:
{evidence.model_dump_json(indent=2)}

Return your structured decision with: recommendation (YES/NO), confidence (0-100),
detailed reasoning, a concise case summary, and priority (HIGH/MEDIUM/LOW).
"""

    return model.invoke(prompt)
