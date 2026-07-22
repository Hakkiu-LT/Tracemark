"""Shared pytest fixtures for all tests."""
import pytest
from fastapi.testclient import TestClient

from tracemark_api.main import app
from tracemark_api.dependencies import get_current_user, get_current_profile, AuthUser, CurrentProfile
from tracemark_api.services.entitlements import compute_entitlements

TEST_USER_ID = "fake-id"
TEST_EMAIL = "fake@tracemark.io"
TEST_ORG_ID = "fake-org"


@pytest.fixture
def client():
    """TestClient that mirrors production error handling."""
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture(autouse=True)
def reset_dependency_overrides():
    """Clear all dependency overrides after every test automatically."""
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def auth_user():
    """Override get_current_user with a standard test user."""
    app.dependency_overrides[get_current_user] = lambda: AuthUser(
        id=TEST_USER_ID, email=TEST_EMAIL
    )


@pytest.fixture
def auth_profile():
    """Override get_current_profile with an enterprise test profile (all entitlements unlocked)."""
    profile = CurrentProfile(
        id=TEST_USER_ID,
        email=TEST_EMAIL,
        organization_id=TEST_ORG_ID,
        plan="enterprise",
        entitlements=compute_entitlements("enterprise", []),
    )
    app.dependency_overrides[get_current_profile] = lambda: profile
    return profile
