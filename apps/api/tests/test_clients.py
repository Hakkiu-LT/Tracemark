from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient
from tracemark_api.main import app
from tracemark_api.dependencies import get_current_profile, CurrentProfile
from tracemark_api.services.entitlements import compute_entitlements

client = TestClient(app)

FAKE_ORG_ID = "org-123"

@pytest.fixture(autouse=True)
def override_auth():
    profile = CurrentProfile(
        id="550e8400-e29b-41d4-a716-446655440000",
        email="gabo.seqq@gmail.com",
        organization_id=FAKE_ORG_ID,
        plan="enterprise",
        entitlements=compute_entitlements("enterprise", []),
    )
    app.dependency_overrides[get_current_profile] = lambda: profile
    yield
    app.dependency_overrides.clear()

def test_list_clients_empty():
    mock_sb = MagicMock()
    mock_clients_result = MagicMock()
    mock_clients_result.data = []
    mock_sb.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value = mock_clients_result

    with patch("tracemark_api.routes.clients.get_supabase", return_value=mock_sb):
        response = client.get("/api/v1/clients")

    assert response.status_code == 200
    assert response.json() == []

def test_create_client():
    mock_sb = MagicMock()
    mock_insert_result = MagicMock()
    mock_insert_result.data = [{
        "id": "client-999",
        "name": "New Client",
        "industry": "Tech",
        "plan": "Pro",
        "mrr": 500,
        "contact": "test@client.com",
        "organization_id": FAKE_ORG_ID,
    }]
    mock_sb.table.return_value.insert.return_value.execute.return_value = mock_insert_result

    with patch("tracemark_api.routes.clients.get_supabase", return_value=mock_sb):
        response = client.post("/api/v1/clients", json={
            "name": "New Client",
            "industry": "Tech",
            "plan": "Pro",
            "mrr": 500,
            "contact": "test@client.com",
        })

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "client-999"
    assert data["name"] == "New Client"
    assert data["organization_id"] == FAKE_ORG_ID

def test_delete_client_not_found():
    mock_sb = MagicMock()
    mock_select_result = MagicMock()
    mock_select_result.data = None
    mock_sb.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_select_result

    with patch("tracemark_api.routes.clients.get_supabase", return_value=mock_sb):
        response = client.delete("/api/v1/clients/client-nonexistent")

    assert response.status_code == 404

def test_get_client_billing():
    mock_sb = MagicMock()
    mock_client_result = MagicMock()
    mock_client_result.data = {
        "id": "client-123",
        "name": "Acme Inc",
        "plan": "Enterprise",
        "mrr": 2500,
    }
    mock_cases_result = MagicMock()
    mock_cases_result.data = [{"id": "case-1"}, {"id": "case-2"}]
    mock_takedowns_result = MagicMock()
    mock_takedowns_result.data = [
        {"status": "sent"},
        {"status": "pending"},
        {"status": "acknowledged"},
    ]

    def mock_table(name):
        t = MagicMock()
        if name == "clients":
            t.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_client_result
        elif name == "cases":
            t.select.return_value.eq.return_value.execute.return_value = mock_cases_result
        elif name == "takedown_reports":
            t.select.return_value.in_.return_value.execute.return_value = mock_takedowns_result
        return t

    mock_sb.table.side_effect = mock_table

    with patch("tracemark_api.routes.clients.get_supabase", return_value=mock_sb):
        response = client.get("/api/v1/clients/client-123/billing")

    assert response.status_code == 200
    data = response.json()
    assert data["client_id"] == "client-123"
    assert data["plan"] == "Enterprise"
    assert data["mrr"] == 2500
    assert data["cases_count"] == 2
    assert data["takedowns_count"] == 3
    assert data["resolved_takedowns"] == 2
    assert data["api_usage_credits"] == 30
