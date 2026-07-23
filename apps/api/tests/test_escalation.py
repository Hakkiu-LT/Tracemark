from unittest.mock import patch, MagicMock
import pytest
from fastapi.testclient import TestClient
from tracemark_api.main import app
from tracemark_api.dependencies import get_current_profile, CurrentProfile
from tracemark_api.services.entitlements import compute_entitlements

client = TestClient(app)

TEST_ORG_ID = "test-org-123"


@pytest.fixture(autouse=True)
def mock_auth():
    profile = CurrentProfile(
        id="550e8400-e29b-41d4-a716-446655440000",
        email="gabo.seqq@gmail.com",
        organization_id=TEST_ORG_ID,
        plan="enterprise",
        entitlements=compute_entitlements("enterprise", []),
    )
    app.dependency_overrides[get_current_profile] = lambda: profile
    yield
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def mock_monitoring_supabase():
    """Prevent _assert_case_in_org from hitting the real DB."""
    ownership_data = MagicMock()
    ownership_data.data = {"organization_id": TEST_ORG_ID}

    mock_table = MagicMock()
    mock_table.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = ownership_data

    mock_sb = MagicMock()
    mock_sb.table.return_value = mock_table

    with patch("tracemark_api.routes.monitoring.get_supabase", return_value=mock_sb):
        yield mock_sb


@patch("tracemark_api.routes.monitoring.update_case_status")
@patch("tracemark_api.routes.monitoring.get_full_case")
@patch("tracemark_api.routes.monitoring.generate_takedown_reports")
@patch("tracemark_api.routes.monitoring.update_decision_action")
def test_escalation_generates_reports_when_empty(
    mock_update_decision,
    mock_generate_reports,
    mock_get_case,
    mock_update_status
):
    # Setup mock data for case without takedown reports
    mock_get_case.return_value = {
        "id": "test-case-123",
        "brand_name": "TestBrand",
        "status": "analyzing",
        "decisions": [
            {
                "risk_level": "MEDIUM",
                "recommended_action": "MONITOR",
                "case_summary": "Suspicious activity found.",
                "confidence_score": 0.5,
                "evidence_quality": "MODERATE",
                "key_findings": ["1 suspicious domain"]
            }
        ],
        "evidence": [
            {
                "marketplaces": [],
                "ads": [],
                "domains": [
                    {
                        "domain_name": "testbrand-fake.com",
                        "registrar": "registrar-123",
                        "is_clone": True,
                        "similarity_score": 75
                    }
                ],
                "social": []
            }
        ],
        "takedown_reports": []  # Empty
    }

    # Call endpoint to change status to "escalated"
    response = client.post("/api/v1/monitoring/test-case-123/status", json={"status": "escalated"})
    
    assert response.status_code == 200
    assert response.json() == {"success": True}

    # Verify status was updated in database
    mock_update_status.assert_called_once_with("test-case-123", "escalated", decline_reason=None)
    
    # Verify notice generation was triggered with force=True
    mock_generate_reports.assert_called_once()
    args, kwargs = mock_generate_reports.call_args
    assert kwargs.get("case_id") == "test-case-123"
    assert kwargs.get("brand_name") == "TestBrand"
    assert kwargs.get("force") is True

    # Verify recommended action was updated to TAKEDOWN
    mock_update_decision.assert_called_once_with("test-case-123", "TAKEDOWN")


@patch("tracemark_api.routes.monitoring.update_case_status")
@patch("tracemark_api.routes.monitoring.get_full_case")
@patch("tracemark_api.routes.monitoring.generate_takedown_reports")
@patch("tracemark_api.routes.monitoring.update_decision_action")
def test_escalation_does_not_duplicate_reports_when_not_empty(
    mock_update_decision,
    mock_generate_reports,
    mock_get_case,
    mock_update_status
):
    # Setup mock data for case that already has takedown reports
    mock_get_case.return_value = {
        "id": "test-case-123",
        "brand_name": "TestBrand",
        "status": "complete",
        "decisions": [
            {
                "risk_level": "HIGH",
                "recommended_action": "TAKEDOWN",
                "case_summary": "Counterfeits found.",
                "confidence_score": 0.9,
                "evidence_quality": "STRONG",
                "key_findings": ["1 counterfeit listing"]
            }
        ],
        "evidence": [
            {
                "marketplaces": [
                    {
                        "platform": "amazon",
                        "seller_name": "FakeSeller",
                        "listing_url": "https://amazon.com/dp/FAKE123",
                        "price": "$9.99"
                    }
                ],
                "ads": [],
                "domains": [],
                "social": []
            }
        ],
        "takedown_reports": [
            {
                "platform": "amazon",
                "platform_category": "marketplace",
                "infringing_url": "https://amazon.com/dp/FAKE123",
                "notice_text": "DMCA...",
                "status": "pending"
            }
        ]
    }

    # Call endpoint to change status to "escalated"
    response = client.post("/api/v1/monitoring/test-case-123/status", json={"status": "escalated"})
    
    assert response.status_code == 200
    assert response.json() == {"success": True}

    # Verify status was updated in database
    mock_update_status.assert_called_once_with("test-case-123", "escalated", decline_reason=None)
    
    # Verify notice generation was NOT called again to avoid duplication
    mock_generate_reports.assert_not_called()
    mock_update_decision.assert_not_called()


@patch("tracemark_api.routes.monitoring.update_case_status")
@patch("tracemark_api.routes.monitoring.get_full_case")
@patch("tracemark_api.routes.monitoring.generate_takedown_reports")
@patch("tracemark_api.routes.monitoring.update_decision_action")
def test_other_status_updates_do_not_generate_reports(
    mock_update_decision,
    mock_generate_reports,
    mock_get_case,
    mock_update_status
):
    # Call endpoint to change status to "safe"
    response = client.post("/api/v1/monitoring/test-case-123/status", json={"status": "safe"})
    
    assert response.status_code == 200
    assert response.json() == {"success": True}

    # Verify status was updated in database
    mock_update_status.assert_called_once_with("test-case-123", "safe", decline_reason=None)
    
    # Verify notice generation and decision updates were NOT called
    mock_get_case.assert_not_called()
    mock_generate_reports.assert_not_called()
    mock_update_decision.assert_not_called()
