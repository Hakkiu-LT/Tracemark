import os
from unittest.mock import patch, MagicMock
import pytest
from tracemark_api.services.marketplace import (
    exchange_short_lived_meta_token,
    update_env_meta_token,
)


@patch("tracemark_api.services.marketplace.requests.get")
def test_exchange_short_lived_meta_token_success(mock_get):
    # Setup mock response
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "access_token": "long_lived_token_12345",
        "token_type": "bearer",
        "expires_in": 5184000,
    }
    mock_get.return_value = mock_resp

    # Set temporary environment variables
    with patch.dict(os.environ, {"META_APP_ID": "123", "META_APP_SECRET": "abc"}):
        result = exchange_short_lived_meta_token("short_token")

        # Assertions
        assert result["access_token"] == "long_lived_token_12345"
        assert result["expires_in"] == 5184000
        mock_get.assert_called_once_with(
            "https://graph.facebook.com/v19.0/oauth/access_token",
            params={
                "grant_type": "fb_exchange_token",
                "client_id": "123",
                "client_secret": "abc",
                "fb_exchange_token": "short_token",
            },
            timeout=15,
        )


def test_exchange_short_lived_meta_token_missing_env():
    with patch.dict(os.environ, {}, clear=True):
        with pytest.raises(ValueError) as exc:
            exchange_short_lived_meta_token("some_token")
        assert "META_APP_ID and META_APP_SECRET must be configured" in str(exc.value)


@patch("tracemark_api.services.marketplace.requests.get")
def test_exchange_short_lived_meta_token_api_error(mock_get):
    mock_resp = MagicMock()
    mock_resp.status_code = 400
    mock_resp.text = "Invalid Verification Code"
    mock_get.return_value = mock_resp

    with patch.dict(os.environ, {"META_APP_ID": "123", "META_APP_SECRET": "abc"}):
        with pytest.raises(ValueError) as exc:
            exchange_short_lived_meta_token("bad_token")
        assert "Meta Graph API error" in str(exc.value)


def test_update_env_meta_token(tmp_path):
    # Create a temporary .env file
    env_file = tmp_path / ".env"
    env_content = "SOME_VAR=123\nMETA_ADS_ACCESS_TOKEN=old_token\nOTHER_VAR=456"
    env_file.write_text(env_content, encoding="utf-8")

    # Mock find_dotenv to return our temporary file
    with patch(
        "tracemark_api.services.marketplace.find_dotenv", return_value=str(env_file)
    ):
        update_env_meta_token("new_super_token")

    # Verify file content
    updated_content = env_file.read_text(encoding="utf-8")
    assert "META_ADS_ACCESS_TOKEN=new_super_token" in updated_content
    assert "SOME_VAR=123" in updated_content
    assert "OTHER_VAR=456" in updated_content
    assert os.environ.get("META_ADS_ACCESS_TOKEN") == "new_super_token"
