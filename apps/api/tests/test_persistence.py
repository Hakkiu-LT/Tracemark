"""
Tests for persistence.py — risk_scorer and persist_infringement.

These tests do NOT hit Supabase. persist_infringement is tested by patching
get_supabase() so no real DB connection is needed.
"""
from unittest.mock import MagicMock, patch

import pytest

from tracemark_api.services.ai import (
    AdEvidence,
    DomainEvidence,
    Evidence,
    MarketplaceEvidence,
    SocialEvidence,
)
from tracemark_api.services.persistence import (
    persist_all_infringements,
    persist_infringement,
    risk_scorer,
)


# ──────────────────────────────────────────────────────────────────────────────
# Fixtures
# ──────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def listing():
    return MarketplaceEvidence(
        platform="Amazon",
        seller_name="FakeSeller",
        listing_url="https://amazon.com/dp/FAKE123",
        price="$9.99",
    )


@pytest.fixture
def ad():
    return AdEvidence(
        platform="Google Ads",
        ad_copy="Buy fake brand now!",
        destination_url="https://fakebrand.shop",
    )


@pytest.fixture
def domain_high():
    return DomainEvidence(domain_name="fakenike.shop", is_clone=True, similarity_score=92)


@pytest.fixture
def domain_medium():
    return DomainEvidence(domain_name="nlike.shop", is_clone=False, similarity_score=60)


@pytest.fixture
def domain_low():
    return DomainEvidence(domain_name="unrelated.com", is_clone=False, similarity_score=20)


@pytest.fixture
def social_high():
    return SocialEvidence(platform="Instagram", handle="fakenike_official", follower_count=50_000)


@pytest.fixture
def social_medium():
    return SocialEvidence(platform="TikTok", handle="nikedeals99", follower_count=5_000)


@pytest.fixture
def social_low():
    return SocialEvidence(platform="Twitter", handle="rand_acc", follower_count=200)


# ──────────────────────────────────────────────────────────────────────────────
# risk_scorer — marketplace
# ──────────────────────────────────────────────────────────────────────────────

def test_marketplace_always_high(listing):
    level, score = risk_scorer(listing)
    assert level == "HIGH"
    assert score == 1.0


# ──────────────────────────────────────────────────────────────────────────────
# risk_scorer — ads
# ──────────────────────────────────────────────────────────────────────────────

def test_ad_always_high(ad):
    level, score = risk_scorer(ad)
    assert level == "HIGH"
    assert score == 0.9


# ──────────────────────────────────────────────────────────────────────────────
# risk_scorer — domains
# ──────────────────────────────────────────────────────────────────────────────

def test_domain_high(domain_high):
    level, score = risk_scorer(domain_high)
    assert level == "HIGH"
    assert score == 0.92


def test_domain_medium(domain_medium):
    level, score = risk_scorer(domain_medium)
    assert level == "MEDIUM"
    assert score == 0.6


def test_domain_low(domain_low):
    level, score = risk_scorer(domain_low)
    assert level == "LOW"
    assert score == 0.2


def test_domain_boundary_exactly_80():
    d = DomainEvidence(domain_name="x.shop", is_clone=True, similarity_score=80)
    level, _ = risk_scorer(d)
    assert level == "HIGH"


def test_domain_boundary_exactly_50():
    d = DomainEvidence(domain_name="x.shop", is_clone=False, similarity_score=50)
    level, _ = risk_scorer(d)
    assert level == "MEDIUM"


def test_domain_boundary_49():
    d = DomainEvidence(domain_name="x.shop", is_clone=False, similarity_score=49)
    level, _ = risk_scorer(d)
    assert level == "LOW"


# ──────────────────────────────────────────────────────────────────────────────
# risk_scorer — social
# ──────────────────────────────────────────────────────────────────────────────

def test_social_high(social_high):
    level, score = risk_scorer(social_high)
    assert level == "HIGH"
    assert score == 0.85


def test_social_medium(social_medium):
    level, score = risk_scorer(social_medium)
    assert level == "MEDIUM"
    assert score == 0.55


def test_social_low(social_low):
    level, score = risk_scorer(social_low)
    assert level == "LOW"
    assert score == 0.25


def test_social_no_follower_count():
    s = SocialEvidence(platform="Instagram", handle="anon", follower_count=None)
    level, score = risk_scorer(s)
    assert level == "LOW"
    assert score == 0.25


# ──────────────────────────────────────────────────────────────────────────────
# persist_infringement — DB is mocked
# ──────────────────────────────────────────────────────────────────────────────

def _mock_supabase(returned_id: str = "abc-123"):
    """Build a minimal Supabase client mock that returns a fixed id."""
    mock_result = MagicMock()
    mock_result.data = [{"id": returned_id}]

    mock_table = MagicMock()
    mock_table.upsert.return_value.execute.return_value = mock_result

    mock_sb = MagicMock()
    mock_sb.table.return_value = mock_table
    return mock_sb


def test_persist_infringement_returns_id(listing):
    mock_sb = _mock_supabase("row-id-1")
    with patch("tracemark_api.services.persistence.get_supabase", return_value=mock_sb):
        result = persist_infringement("case-001", listing)
    assert result == "row-id-1"


def test_persist_infringement_calls_upsert_with_correct_fields(ad):
    mock_sb = _mock_supabase()
    with patch("tracemark_api.services.persistence.get_supabase", return_value=mock_sb):
        persist_infringement("case-002", ad)

    upsert_call = mock_sb.table.return_value.upsert.call_args
    payload = upsert_call[0][0]   # first positional arg to upsert()

    assert payload["case_id"] == "case-002"
    assert payload["source_url"] == "https://fakebrand.shop"
    assert payload["platform"] == "Google Ads"
    assert payload["risk_level"] == "HIGH"
    assert payload["match_score"] == 0.9
    assert payload["status"] == "flagged"


def test_persist_infringement_domain_url(domain_high):
    mock_sb = _mock_supabase()
    with patch("tracemark_api.services.persistence.get_supabase", return_value=mock_sb):
        persist_infringement("case-003", domain_high)

    payload = mock_sb.table.return_value.upsert.call_args[0][0]
    assert payload["source_url"] == "https://fakenike.shop"
    assert payload["platform"] == "domain"


def test_persist_all_infringements(listing, ad, domain_high):
    mock_sb = _mock_supabase("id-x")
    evidence = Evidence(
        marketplaces=[listing],
        ads=[ad],
        domains=[domain_high],
        social=[],
    )
    with patch("tracemark_api.services.persistence.get_supabase", return_value=mock_sb):
        ids = persist_all_infringements("case-999", evidence)

    assert len(ids) == 3
    assert all(i == "id-x" for i in ids)
    assert mock_sb.table.return_value.upsert.call_count == 3
