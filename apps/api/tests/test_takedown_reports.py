from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient
from tracemark_api.main import app
from tracemark_api.services.ai import Decision, Evidence, MarketplaceEvidence, DomainEvidence, AdEvidence, SocialEvidence
from tracemark_api.services.takedown import generate_takedown_reports, TakedownReport

client = TestClient(app)


FAKE_ORG_ID = "fake-org"

@pytest.fixture(autouse=True)
def override_auth():
<<<<<<< HEAD
    from tracemark_api.dependencies import get_current_profile, CurrentProfile
    profile = CurrentProfile(
        id="fake-id", email="fake@example.com",
        organization_id=FAKE_ORG_ID,
    )
    app.dependency_overrides[get_current_profile] = lambda: profile
=======
    from tracemark_api.dependencies import get_current_user, get_current_profile, AuthUser, CurrentProfile
    from tracemark_api.services.entitlements import Entitlement
    app.dependency_overrides[get_current_user] = lambda: AuthUser(id="fake-id", email="fake@tracemark.io")
    app.dependency_overrides[get_current_profile] = lambda: CurrentProfile(
        id="fake-id",
        email="fake@tracemark.io",
        organization_id="org-123",
        plan="pro",
        entitlements=Entitlement(
            plan="pro",
            brands=5,
            platforms=3,
            regions=2,
            domain_tracking=True,
            managed_takedown=True,
            api_access=True,
            advanced_reports=True,
            real_time_scans=True
        )
    )
>>>>>>> origin/sentinel-fix-idor-docs-takedowns-17142356003433081144
    yield
    app.dependency_overrides.clear()

# ──────────────────────────────────────────────────────────────────────────────
# Unit Tests for generate_takedown_reports
# ──────────────────────────────────────────────────────────────────────────────

def test_generate_takedown_no_takedown_recommended():
    decision = Decision(
        risk_level="MEDIUM",
        recommended_action="MONITOR",
        case_summary="Unrelated text.",
        confidence_score=0.6,
        evidence_quality="MODERATE",
        key_findings=["Some findings"]
    )
    evidence = Evidence(marketplaces=[], ads=[], domains=[], social=[])
    
    reports = generate_takedown_reports("case-123", "BrandX", decision, evidence)
    assert reports == []


def test_generate_takedown_no_takedown_recommended_forced():
    decision = Decision(
        risk_level="MEDIUM",
        recommended_action="MONITOR",
        case_summary="Unrelated text.",
        confidence_score=0.6,
        evidence_quality="MODERATE",
        key_findings=["Some findings"]
    )
    listing = MarketplaceEvidence(
        platform="Amazon",
        seller_name="BadSeller",
        listing_url="https://amazon.com/dp/FAKE123",
        price="$10.00",
        screenshot_url=None
    )
    evidence = Evidence(marketplaces=[listing], ads=[], domains=[], social=[])
    
    mock_res = MagicMock()
    mock_res.data = [{"id": "takedown-uuid-123"}]
    mock_sb = MagicMock()
    mock_sb.table.return_value.insert.return_value.execute.return_value = mock_res
    
    with patch("tracemark_api.services.takedown.get_supabase", return_value=mock_sb):
        reports = generate_takedown_reports("case-123", "BrandX", decision, evidence, force=True)
        
    assert len(reports) == 1
    assert reports[0].id == "takedown-uuid-123"
    assert reports[0].platform == "amazon"
    assert reports[0].platform_category == "marketplace"
    assert "BrandX" in reports[0].notice_text
    assert "https://amazon.com/dp/FAKE123" in reports[0].notice_text


def test_generate_takedown_marketplace_mappings():
    decision = Decision(
        risk_level="HIGH",
        recommended_action="TAKEDOWN",
        case_summary="Infringing listings found.",
        confidence_score=0.9,
        evidence_quality="STRONG",
        key_findings=["Counterfeit BrandX logo on product"]
    )
    listing = MarketplaceEvidence(
        platform="eBay",
        seller_name="ScamShop",
        listing_url="https://ebay.com/itm/123",
        price="$19.99",
        screenshot_url=None
    )
    evidence = Evidence(marketplaces=[listing], ads=[], domains=[], social=[])
    
    mock_res = MagicMock()
    mock_res.data = [{"id": "ebay-report-uuid"}]
    mock_sb = MagicMock()
    mock_sb.table.return_value.insert.return_value.execute.return_value = mock_res
    
    with patch("tracemark_api.services.takedown.get_supabase", return_value=mock_sb):
        reports = generate_takedown_reports("case-123", "BrandX", decision, evidence)
        
    assert len(reports) == 1
    assert reports[0].id == "ebay-report-uuid"
    assert reports[0].platform == "ebay"
    assert reports[0].submission_method == "web_form"
    assert "https://contact.ebay.com" in reports[0].submission_url
    assert "Counterfeit BrandX logo" in reports[0].notice_text


def test_generate_takedown_domain_mappings():
    decision = Decision(
        risk_level="HIGH",
        recommended_action="TAKEDOWN",
        case_summary="Phishing domains.",
        confidence_score=0.95,
        evidence_quality="STRONG",
        key_findings=["Identical clone of trademark owner website"]
    )
    # GoDaddy registrar
    domain_godaddy = DomainEvidence(
        domain_name="brandx-cheap.shop",
        registrar="GoDaddy.com, LLC",
        is_clone=True,
        similarity_score=90,
        screenshot_url=None
    )
    # Cloudflare fallback
    domain_unknown = DomainEvidence(
        domain_name="brandx-scam.net",
        registrar=None,
        is_clone=True,
        similarity_score=85,
        screenshot_url=None
    )
    evidence = Evidence(marketplaces=[], ads=[], domains=[domain_godaddy, domain_unknown], social=[])
    
    mock_res = MagicMock()
    mock_res.data = [{"id": "id-1"}, {"id": "id-2"}]
    mock_sb = MagicMock()
    mock_sb.table.return_value.insert.return_value.execute.return_value = mock_res
    
    with patch("tracemark_api.services.takedown.get_supabase", return_value=mock_sb):
        reports = generate_takedown_reports("case-123", "BrandX", decision, evidence)
        
    assert len(reports) == 2
    # GoDaddy mapping
    assert reports[0].id == "id-1"
    assert reports[0].platform == "godaddy"
    # Fallback to cloudflare mapping
    assert reports[1].id == "id-2"
    assert reports[1].platform == "cloudflare"


def test_generate_takedown_social_and_ads():
    decision = Decision(
        risk_level="HIGH",
        recommended_action="TAKEDOWN",
        case_summary="Social media ads.",
        confidence_score=0.9,
        evidence_quality="STRONG",
        key_findings=["Ad using BrandX trademark"]
    )
    social_insta = SocialEvidence(
        platform="Instagram",
        handle="brandx_deals",
        post_url="https://instagram.com/p/123",
        follower_count=500
    )
    ad_google = AdEvidence(
        platform="Google Ads",
        ad_copy="Get cheap BrandX here!",
        destination_url="https://fakebrandx.com/promo",
        screenshot_url=None
    )
    evidence = Evidence(marketplaces=[], ads=[ad_google], domains=[], social=[social_insta])
    
    mock_res = MagicMock()
    mock_res.data = [{"id": "google-ad-id"}, {"id": "insta-social-id"}]
    mock_sb = MagicMock()
    mock_sb.table.return_value.insert.return_value.execute.return_value = mock_res
    
    with patch("tracemark_api.services.takedown.get_supabase", return_value=mock_sb):
        reports = generate_takedown_reports("case-123", "BrandX", decision, evidence)
        
    assert len(reports) == 2
    
    # Ads mapping
    assert reports[0].id == "google-ad-id"
    assert reports[0].platform == "google_ads"
    assert reports[0].platform_category == "ad_platform"
    
    # Social mapping
    assert reports[1].id == "insta-social-id"
    assert reports[1].platform == "instagram"
    assert reports[1].platform_category == "social_media"


# ──────────────────────────────────────────────────────────────────────────────
# Integration Tests for PUT /api/v1/monitoring/takedowns/{id}
# ──────────────────────────────────────────────────────────────────────────────

def _make_takedown_sb(takedown_data: dict):
    """Build a mock Supabase that satisfies both _assert_takedown_in_org (select with
    cases!inner join) and the subsequent update call."""
    # Ownership-check result: takedown row with embedded cases join.
    ownership_data = dict(takedown_data, cases={"organization_id": FAKE_ORG_ID})
    ownership_result = MagicMock()
    ownership_result.data = ownership_data

    # Update result (returned after successful write).
    update_result = MagicMock()
    update_result.data = [takedown_data]

    mock_table = MagicMock()
    # select().eq().maybe_single().execute() → ownership check (and profiles lookup)
    mock_table.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = ownership_result
    # select().eq().execute() (no maybe_single) → used in the no-fields path to fetch current row
    mock_table.select.return_value.eq.return_value.execute.return_value = update_result
    # update().eq().execute() → write result
    mock_table.update.return_value.eq.return_value.execute.return_value = update_result

    mock_sb = MagicMock()
    mock_sb.table.return_value = mock_table
    return mock_sb, mock_table


def test_update_takedown_success():
    takedown_data = {
        "id": "takedown-123",
        "notice_text": "Updated notice text",
        "status": "sent",
        "submitted_at": "2026-06-24T18:00:00Z",
<<<<<<< HEAD
    }
    mock_sb, mock_table = _make_takedown_sb(takedown_data)

=======
        "cases": {"organization_id": "org-123"}
    }]
    
    mock_table = MagicMock()
    mock_table.select.return_value.eq.return_value.execute.return_value = mock_result
    mock_table.update.return_value.eq.return_value.execute.return_value = mock_result
    
    mock_sb = MagicMock()
    mock_sb.table.return_value = mock_table
    
>>>>>>> origin/sentinel-fix-idor-docs-takedowns-17142356003433081144
    with patch("tracemark_api.routes.monitoring.get_supabase", return_value=mock_sb):
        response = client.put(
            "/api/v1/monitoring/takedowns/takedown-123",
            json={"notice_text": "Updated notice text", "status": "sent"}
        )

    assert response.status_code == 200
    assert response.json()["id"] == "takedown-123"
    assert response.json()["status"] == "sent"
    assert response.json()["notice_text"] == "Updated notice text"

    # Verify update arguments
    mock_table.update.assert_called_once()
    args, kwargs = mock_table.update.call_args
    update_arg = args[0]
    assert update_arg["notice_text"] == "Updated notice text"
    assert update_arg["status"] == "sent"
    assert "submitted_at" in update_arg


def test_update_takedown_no_fields():
    takedown_data = {
        "id": "takedown-123",
        "notice_text": "Existing notice text",
        "status": "pending",
        "submitted_at": None,
<<<<<<< HEAD
    }
    mock_sb, mock_table = _make_takedown_sb(takedown_data)

=======
        "cases": {"organization_id": "org-123"}
    }]
    
    mock_table = MagicMock()
    mock_table.select.return_value.eq.return_value.execute.return_value = mock_result
    
    mock_sb = MagicMock()
    mock_sb.table.return_value = mock_table
    
>>>>>>> origin/sentinel-fix-idor-docs-takedowns-17142356003433081144
    with patch("tracemark_api.routes.monitoring.get_supabase", return_value=mock_sb):
        response = client.put(
            "/api/v1/monitoring/takedowns/takedown-123",
            json={}
        )

    assert response.status_code == 200
    assert response.json()["id"] == "takedown-123"
    assert response.json()["status"] == "pending"
    assert response.json()["notice_text"] == "Existing notice text"
<<<<<<< HEAD

    # Verify update was not called (only a select fetch happened)
=======
    
    # Verify select was called, update was not called
    mock_table.select.assert_called_once_with("*, cases(organization_id)")
>>>>>>> origin/sentinel-fix-idor-docs-takedowns-17142356003433081144
    mock_table.update.assert_not_called()


def test_update_takedown_not_found():
    mock_result = MagicMock()
    mock_result.data = [] # Empty means not found
    
    mock_table = MagicMock()
    mock_table.select.return_value.eq.return_value.execute.return_value = mock_result
    mock_table.update.return_value.eq.return_value.execute.return_value = mock_result
    
    mock_sb = MagicMock()
    mock_sb.table.return_value = mock_table
    
    with patch("tracemark_api.routes.monitoring.get_supabase", return_value=mock_sb):
        response = client.put(
            "/api/v1/monitoring/takedowns/non-existent-id",
            json={"status": "acknowledged"}
        )
        
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_update_takedown_invalid_status():
    response = client.put(
        "/api/v1/monitoring/takedowns/takedown-123",
        json={"status": "invalid_status_value"}
    )
    
    assert response.status_code == 422
