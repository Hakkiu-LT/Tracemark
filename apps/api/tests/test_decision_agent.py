from datetime import datetime
import pytest

from tracemark_api.services.ai import (
    Evidence,
    Decision,
    make_decision,
    MarketplaceEvidence,
    AdEvidence,
    DomainEvidence,
)
from tracemark_api.services.evidence_scorer import score_evidence


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_listing(seller: str = "FakeSeller", platform: str = "amazon", price: str = "$9.99") -> MarketplaceEvidence:
    return MarketplaceEvidence(
        seller_name=seller,
        platform=platform,
        listing_url="https://amazon.com/dp/TEST",
        price=price,
    )


def make_ad(platform: str = "Google Ads") -> AdEvidence:
    return AdEvidence(
        platform=platform,
        ad_copy="Fake brand shoes - buy now!",
        destination_url="https://fakebrand.shop",
    )


def make_domain(name: str = "fakenike.shop") -> DomainEvidence:
    return DomainEvidence(
        domain_name=name,
        registrar="GoDaddy",
        is_clone=True,
        similarity_score=85,
    )


def empty_evidence() -> Evidence:
    return Evidence(marketplaces=[], ads=[], domains=[], social=[], timestamp=datetime.now())


# ---------------------------------------------------------------------------
# EvidenceScore tests
# ---------------------------------------------------------------------------

class TestEvidenceScorer:
    def test_empty_evidence_scores_zero(self):
        score = score_evidence(empty_evidence())
        assert score.total_score == 0.0
        assert score.is_empty is True
        assert score.quality_label == "WEAK"
        assert score.top_findings == []

    def test_single_listing_scores_low(self):
        evidence = Evidence(marketplaces=[make_listing()], ads=[], domains=[], social=[], timestamp=datetime.now())
        score = score_evidence(evidence)
        assert score.total_score > 0.0
        assert score.is_empty is False
        assert score.marketplace_score == pytest.approx(0.1)

    def test_rich_evidence_scores_strong(self):
        listings = [make_listing(f"Seller{i}") for i in range(12)]
        ads = [make_ad() for _ in range(5)]
        domains = [make_domain(f"fakedomain{i}.shop") for i in range(3)]
        evidence = Evidence(marketplaces=listings, ads=ads, domains=domains, social=[], timestamp=datetime.now())
        score = score_evidence(evidence)
        assert score.total_score >= 0.65
        assert score.quality_label == "STRONG"

    def test_moderate_evidence_label(self):
        listings = [make_listing(f"Seller{i}") for i in range(4)]
        evidence = Evidence(marketplaces=listings, ads=[], domains=[], social=[], timestamp=datetime.now())
        score = score_evidence(evidence)
        # 4 listings → mp_score = 0.4 → total = 0.4 * 0.40 = 0.16 → WEAK
        # Need ads or domains to reach MODERATE
        assert score.quality_label in ("WEAK", "MODERATE")

    def test_findings_populated_for_listings(self):
        evidence = Evidence(marketplaces=[make_listing()], ads=[], domains=[], social=[], timestamp=datetime.now())
        score = score_evidence(evidence)
        assert len(score.top_findings) >= 1
        assert "marketplace" in score.top_findings[0].lower()

    def test_findings_populated_for_domains(self):
        evidence = Evidence(marketplaces=[], ads=[], domains=[make_domain()], social=[], timestamp=datetime.now())
        score = score_evidence(evidence)
        assert len(score.top_findings) >= 1
        assert "domain" in score.top_findings[0].lower()

    def test_scores_capped_at_1(self):
        listings = [make_listing(f"Seller{i}") for i in range(100)]
        evidence = Evidence(marketplaces=listings, ads=[], domains=[], social=[], timestamp=datetime.now())
        score = score_evidence(evidence)
        assert score.marketplace_score == 1.0
        assert score.total_score <= 1.0

    def test_all_source_scores_zero_for_empty(self):
        score = score_evidence(empty_evidence())
        assert score.marketplace_score == 0.0
        assert score.ads_score == 0.0
        assert score.domains_score == 0.0
        assert score.social_score == 0.0


# ---------------------------------------------------------------------------
# DecisionAgent tests (mock mode — no GEMINI_API_KEY required)
# ---------------------------------------------------------------------------

class TestDecisionAgent:
    def test_empty_evidence_returns_dismiss(self):
        decision = make_decision(empty_evidence())
        assert decision.recommended_action == "DISMISS"
        assert decision.risk_level == "LOW"

    def test_empty_evidence_high_confidence(self):
        # Should be confident that "nothing found" is correct
        decision = make_decision(empty_evidence())
        assert decision.confidence_score > 0.5

    def test_empty_evidence_has_summary(self):
        decision = make_decision(empty_evidence())
        assert isinstance(decision.case_summary, str)
        assert len(decision.case_summary) > 10

    def test_decision_has_all_fields(self, monkeypatch):
        monkeypatch.delenv("GEMINI_API_KEY", raising=False)
        evidence = Evidence(
            marketplaces=[make_listing()],
            ads=[],
            domains=[],
            social=[],
            timestamp=datetime.now(),
        )
        decision = make_decision(evidence)
        assert decision.risk_level in ("HIGH", "MEDIUM", "LOW")
        assert decision.recommended_action in ("TAKEDOWN", "MONITOR", "DISMISS")
        assert isinstance(decision.case_summary, str) and len(decision.case_summary) > 10
        assert 0.0 <= decision.confidence_score <= 1.0
        assert decision.evidence_quality in ("STRONG", "MODERATE", "WEAK")
        assert isinstance(decision.key_findings, list)

    def test_empty_evidence_skips_gemini(self, monkeypatch):
        """Empty evidence must short-circuit before _analyze_evidence_node calls Gemini."""
        called = []

        def fake_invoke(self, prompt):
            called.append(prompt)
            return type("R", (), {"content": "mock"})()

        monkeypatch.setattr(
            "langchain_google_genai.ChatGoogleGenerativeAI.invoke",
            fake_invoke,
        )
        make_decision(empty_evidence())
        assert called == [], "Gemini must not be called for empty evidence"

    def test_make_decision_never_raises(self):
        """make_decision should not raise regardless of evidence content."""
        cases = [
            empty_evidence(),
            Evidence(marketplaces=[make_listing()], ads=[], domains=[], social=[], timestamp=datetime.now()),
            Evidence(marketplaces=[], ads=[make_ad()], domains=[make_domain()], social=[], timestamp=datetime.now()),
        ]
        for evidence in cases:
            decision = make_decision(evidence)
            assert decision is not None
