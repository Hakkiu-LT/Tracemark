"""Tests for the SSRF guard and the redirect-revalidating safe_get helper."""
from unittest.mock import MagicMock, patch

import pytest

from tracemark_api.services.ssrf import SSRFError, safe_get, validate_ssrf_url


class TestValidateSSRFUrl:
    @pytest.mark.parametrize(
        "url",
        [
            "javascript:alert(1)",
            "data:text/html,<script>",
            "file:///etc/passwd",
            "ftp://example.com/x",
            "gopher://example.com",
            "http://127.0.0.1/",
            "http://127.0.0.1:8000/api/v1/internal/x",
            "http://169.254.169.254/latest/meta-data/",  # cloud metadata (link-local)
            "http://10.0.0.5/",
            "http://192.168.1.10/",
            "http://172.16.0.1/",
            "http://[::1]/",
            "http://localhost/",  # resolves to loopback
            "not-a-url",
            "",
        ],
    )
    def test_blocks_dangerous_urls(self, url):
        with pytest.raises(SSRFError):
            validate_ssrf_url(url)

    def test_allows_public_https(self):
        # Should not raise (example.com resolves to a public IP).
        validate_ssrf_url("https://example.com")


def _resp(status_code, *, location=None, is_redirect=False):
    r = MagicMock()
    r.status_code = status_code
    r.is_redirect = is_redirect
    r.headers = {"Location": location} if location else {}
    return r


class TestSafeGet:
    @patch("tracemark_api.services.ssrf.requests.get")
    def test_returns_final_non_redirect_response(self, mock_get):
        mock_get.return_value = _resp(200)
        resp = safe_get("https://example.com")
        assert resp.status_code == 200

    @patch("tracemark_api.services.ssrf.requests.get")
    def test_blocks_redirect_to_private_ip(self, mock_get):
        # First hop is public; the server 302s to the cloud-metadata endpoint.
        # safe_get must re-validate the redirect target and refuse it.
        mock_get.return_value = _resp(
            302, location="http://169.254.169.254/latest/meta-data/", is_redirect=True
        )
        with pytest.raises(SSRFError):
            safe_get("https://example.com")

    @patch("tracemark_api.services.ssrf.requests.get")
    def test_blocks_redirect_to_loopback(self, mock_get):
        mock_get.return_value = _resp(
            302, location="http://127.0.0.1:8000/api/v1/internal/x", is_redirect=True
        )
        with pytest.raises(SSRFError):
            safe_get("https://example.com")

    @patch("tracemark_api.services.ssrf.requests.get")
    def test_raises_on_too_many_redirects(self, mock_get):
        # Always redirects to a public URL → should hit the cap, not loop forever.
        mock_get.return_value = _resp(302, location="https://example.com/next", is_redirect=True)
        with pytest.raises(SSRFError):
            safe_get("https://example.com", max_redirects=2)

    @patch("tracemark_api.services.ssrf.requests.get")
    def test_never_follows_with_allow_redirects_true(self, mock_get):
        # safe_get must call requests.get with allow_redirects=False so IT controls
        # each hop (and can re-validate). Guard against a regression.
        mock_get.return_value = _resp(200)
        safe_get("https://example.com")
        _, kwargs = mock_get.call_args
        assert kwargs.get("allow_redirects") is False
