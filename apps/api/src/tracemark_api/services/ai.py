from __future__ import annotations

import os
from datetime import datetime
from typing import TypedDict, Literal
from dataclasses import dataclass, field
from pydantic import BaseModel, Field as PydanticField
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, START, END


# 1. Pydantic Models for Structured Output
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
    marketplaces: list[MarketplaceEvidence] = PydanticField(default_factory=list, description="List of marketplaces where the brand is illegally or suspiciously sold.")
    ads: list[AdEvidence] = PydanticField(default_factory=list, description="List of suspicious or unauthorized advertisements.")
    domains: list[DomainEvidence] = PydanticField(default_factory=list, description="List of domain registrations/clones targeting the brand.")
    social: list[SocialEvidence] = PydanticField(default_factory=list, description="List of social media posts/profiles violating the trademark.")
    timestamp: datetime = PydanticField(default_factory=datetime.now, description="Timestamp when evidence was captured.")


class Decision(BaseModel):
    recommendation: Literal["YES", "NO"] = PydanticField(description="YES/NO recommendation on whether to take legal/takedown action.")
    confidence: int = PydanticField(ge=0, le=100, description="Confidence score from 0 to 100 on the recommendation decision.")
    reasoning: str = PydanticField(description="Detailed legal/logical rationale for the recommendation.")
    case_summary: str = PydanticField(description="A concise summary of the case and found evidence.")
    priority: Literal["HIGH", "MEDIUM", "LOW"] = PydanticField(description="Urgency priority level for the takedown action.")


@dataclass(slots=True)
class AnalysisResult:
    evidence: Evidence | None
    decision: Decision | None


# 2. State Definition
class AgentState(TypedDict):
    url: str
    scraped_content: str
    evidence: Evidence | None
    decision: Decision | None


# 3. Nodes and Graph construction
def build_agent_graph() -> StateGraph:
    api_key = os.environ.get("GEMINI_API_KEY")
    workflow = StateGraph(AgentState)

    def gather_evidence(state: AgentState) -> dict:
        if not api_key:
            # Fallback mock for testing
            is_mock_threat = "threat" in state["scraped_content"].lower() or "suspicious" in state["scraped_content"].lower()
            mock_evidence = Evidence(
                marketplaces=[
                    MarketplaceEvidence(
                        platform="AliExpress",
                        seller_name="ShenzhenAudioMax",
                        listing_url=state["url"],
                        price="$22.40",
                        screenshot_url=None
                    )
                ] if is_mock_threat else [],
                ads=[],
                domains=[],
                social=[],
                timestamp=datetime.now()
            )
            return {"evidence": mock_evidence}

        model = ChatGoogleGenerativeAI(
            model="gemini-1.5-flash",
            temperature=0.0,
            google_api_key=api_key
        ).with_structured_output(Evidence)

        prompt = (
            "You are a brand protection risk assessor (Engineer A). Analyze the scraped page content below and extract "
            "all evidence of trademark infringement, counterfeit sales, or brand abuse. Specifically, look for and group "
            "any referenced marketplaces (where the product is being sold), ads, domains, or social media accounts associated "
            "with this brand/infringement.\n\n"
            f"URL: {state['url']}\n"
            f"Content:\n{state['scraped_content']}\n\n"
            "Extract the evidence and output the structured result."
        )

        result = model.invoke(prompt)
        return {"evidence": result}

    def make_decision(state: AgentState) -> dict:
        if not api_key:
            # Fallback mock for testing
            has_evidence = len(state["evidence"].marketplaces) > 0 if state["evidence"] else False
            mock_decision = Decision(
                recommendation="YES" if has_evidence else "NO",
                confidence=90 if has_evidence else 10,
                reasoning=f"Mock decision: Found marketplaces in evidence. Bypassing RLS or check.",
                case_summary=f"Cloned listing found on AliExpress for the URL: {state['url']}",
                priority="HIGH" if has_evidence else "LOW"
            )
            return {"decision": mock_decision}

        model = ChatGoogleGenerativeAI(
            model="gemini-1.5-pro",
            temperature=0.0,
            google_api_key=api_key
        ).with_structured_output(Decision)

        prompt = (
            "You are a senior brand safety lawyer (Engineer B). You will review the scraped content and the gathered "
            "evidence package to make a final decision on whether this constitutes a genuine brand threat.\n\n"
            f"URL: {state['url']}\n"
            f"Gathered Evidence: {state['evidence']}\n"
            f"Scraped Content:\n{state['scraped_content']}\n\n"
            "Determine the final recommendation, confidence score, reasoning, case summary, and priority."
        )

        result = model.invoke(prompt)
        return {"decision": result}

    workflow.add_node("gather_evidence", gather_evidence)
    workflow.add_node("make_decision", make_decision)

    workflow.add_edge(START, "gather_evidence")
    workflow.add_edge("gather_evidence", "make_decision")
    workflow.add_edge("make_decision", END)

    return workflow.compile()


def analyze_listing(payload: dict) -> AnalysisResult:
    url = payload.get("url", "")
    scraped_content = payload.get("markdown", "")

    graph = build_agent_graph()
    initial_state = {
        "url": url,
        "scraped_content": scraped_content,
        "evidence": None,
        "decision": None
    }

    final_state = graph.invoke(initial_state)

    return AnalysisResult(
        evidence=final_state.get("evidence"),
        decision=final_state.get("decision")
    )


