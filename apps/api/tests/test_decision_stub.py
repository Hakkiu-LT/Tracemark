from tracemark_api.services.ai import Evidence, MarketplaceEvidence, make_decision
from datetime import datetime


def test_make_decision_with_dummy_evidence(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    dummy_evidence = Evidence(
        marketplaces=[
            MarketplaceEvidence(
                platform="amazon",
                seller_name="FakeBrandCo",
                listing_url="https://amazon.com/dp/FAKE123",
                price="$14.99"
            )
        ],
        ads=[],
        domains=[],
        social=[],
        timestamp=datetime.now()
    )

    decision = make_decision(dummy_evidence)

    assert decision.risk_level in ("HIGH", "MEDIUM", "LOW")
    assert decision.recommended_action in ("TAKEDOWN", "MONITOR", "DISMISS")
    assert 0.0 <= decision.confidence_score <= 1.0
    assert decision.evidence_quality in ("STRONG", "MODERATE", "WEAK")
    assert len(decision.case_summary) > 0
    print(decision.model_dump_json(indent=2))


if __name__ == "__main__":
    test_make_decision_with_dummy_evidence()
    print("Decision stub test passed")
