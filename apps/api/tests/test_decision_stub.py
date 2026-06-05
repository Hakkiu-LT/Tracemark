from tracemark_api.services.ai import Evidence, MarketplaceEvidence
from tracemark_api.services.decision import make_decision
from datetime import datetime


def test_make_decision_with_dummy_evidence():
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

    assert decision.recommendation in ("YES", "NO")
    assert 0 <= decision.confidence <= 100
    assert decision.priority in ("HIGH", "MEDIUM", "LOW")
    assert len(decision.reasoning) > 0
    print(decision.model_dump_json(indent=2))


if __name__ == "__main__":
    test_make_decision_with_dummy_evidence()
    print("Decision stub test passed")
