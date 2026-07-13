"""
Tests for the brand-relevance domain pre-filter and evidence scorer
clone-only counting, both introduced to fix false positives like
njctl.org being flagged when monitoring 'derila'.
"""

import pytest
from tracemark_api.services.marketplace import GoogleSERPAPI
from tracemark_api.services.evidence_scorer import score_evidence


# ---------------------------------------------------------------------------
# 1. _add_link_to_domains brand-relevance pre-filter
# ---------------------------------------------------------------------------


class TestBrandRelevancePreFilter:
    """Verify _add_link_to_domains rejects unrelated domains and keeps brand-similar ones."""

    def setup_method(self):
        self.serp = GoogleSERPAPI()
        self.official_domains = {"derila.com", "derila.net", "derila.org"}

    def _collect(self, url: str, brand_name: str = "derila") -> set[str]:
        domains: set[str] = set()
        self.serp._add_link_to_domains(url, self.official_domains, domains, brand_name)
        return domains

    # --- Should be REJECTED (unrelated to "derila") ---

    def test_rejects_njctl_org(self):
        result = self._collect("https://njctl.org/some-page")
        assert result == set(), (
            "njctl.org should be rejected — no similarity to 'derila'"
        )

    def test_rejects_stackoverflow(self):
        result = self._collect("https://stackoverflow.com/questions/12345")
        assert result == set()

    def test_rejects_random_blog(self):
        result = self._collect("https://healthtips-blog.net/sleep-pillows")
        assert result == set()

    def test_rejects_wikipedia(self):
        result = self._collect("https://en.wikipedia.org/wiki/Pillow")
        assert result == set()

    # --- Should be ACCEPTED (brand-relevant) ---

    def test_accepts_typosquat_drila(self):
        result = self._collect("https://drila.com/shop")
        assert "drila.com" in result, "drila.com is a typosquat of derila"

    def test_accepts_buy_derila(self):
        result = self._collect("https://buy-derila.com/")
        assert "buy-derila.com" in result

    def test_accepts_derila_pillow_cheap(self):
        result = self._collect("https://buy-derila-pillow-cheap.store/")
        assert "buy-derila-pillow-cheap.store" in result

    def test_accepts_derila_shop(self):
        result = self._collect("https://derilashop.com/")
        assert "derilashop.com" in result

    def test_accepts_derila_official(self):
        result = self._collect("https://derila-official.shop/")
        assert "derila-official.shop" in result

    # --- Official domains should still be skipped (existing logic) ---

    def test_skips_official_domain(self):
        result = self._collect("https://derila.com/product")
        assert result == set(), "Official domain should be skipped"

    def test_skips_official_subdomain(self):
        result = self._collect("https://shop.derila.com/product")
        assert result == set(), "Subdomain of official domain should be skipped"

    # --- Without brand_name, should fall back to old behavior (no pre-filter) ---

    def test_no_brand_name_allows_anything(self):
        domains: set[str] = set()
        self.serp._add_link_to_domains(
            "https://njctl.org/page",
            self.official_domains,
            domains,
            brand_name=None,
        )
        assert "njctl.org" in domains, (
            "Without brand_name, all non-whitelisted domains should pass"
        )


# ---------------------------------------------------------------------------
# 2. Evidence scorer counts only is_clone=True domains
# ---------------------------------------------------------------------------


class TestEvidenceScorerCloneFilter:
    """Verify that domains_score only counts confirmed clones."""

    def _make_evidence(self, domains):
        """Helper to create a minimal Evidence-like object."""
        from tracemark_api.services.ai import Evidence, DomainEvidence

        domain_objs = [
            DomainEvidence(
                domain_name=d["name"],
                registrar="unknown",
                is_clone=d["is_clone"],
                similarity_score=d["score"],
            )
            for d in domains
        ]
        return Evidence(
            marketplaces=[],
            ads=[],
            domains=domain_objs,
            social=[],
        )

    def test_non_clone_domains_not_counted(self):
        evidence = self._make_evidence(
            [
                {"name": "njctl.org", "is_clone": False, "score": 10},
                {"name": "healthtips.net", "is_clone": False, "score": 5},
            ]
        )
        result = score_evidence(evidence)
        assert result.domains_score == 0.0, (
            "Non-clone domains should contribute zero to domain score"
        )
        assert result.is_empty is True, "All non-clone = effectively empty evidence"

    def test_clone_domains_counted(self):
        evidence = self._make_evidence(
            [
                {"name": "buy-derila.com", "is_clone": True, "score": 90},
                {"name": "derila-shop.store", "is_clone": True, "score": 85},
            ]
        )
        result = score_evidence(evidence)
        assert result.domains_score > 0.0, (
            "Clone domains should contribute to domain score"
        )
        assert result.is_empty is False

    def test_mixed_domains_only_counts_clones(self):
        evidence = self._make_evidence(
            [
                {"name": "buy-derila.com", "is_clone": True, "score": 90},
                {"name": "njctl.org", "is_clone": False, "score": 10},
                {"name": "healthtips.net", "is_clone": False, "score": 5},
            ]
        )
        result = score_evidence(evidence)
        # Only 1 clone domain: 1/5 = 0.2, but domains_score is weighted at 20%
        assert result.domains_score == pytest.approx(0.2, abs=0.01)
