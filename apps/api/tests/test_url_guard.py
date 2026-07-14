"""Tests for the SSRF URL guard (services/url_guard.py).

Uses literal IPs and 'localhost' so the suite needs no external DNS.
"""
import pytest

from tracemark_api.services.url_guard import validate_public_http_url


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1/",
        "http://localhost/admin",
        "http://169.254.169.254/latest/meta-data/",   # cloud metadata
        "http://2130706433/",                          # decimal 127.0.0.1
        "http://0x7f000001/",                          # hex 127.0.0.1
        "http://[::1]/",                               # IPv6 loopback
        "http://[::ffff:127.0.0.1]/",                  # IPv4-mapped IPv6
        "http://10.0.0.5/",
        "http://192.168.1.1/",
        "http://172.16.0.1/",
        "http://0.0.0.0/",
        "ftp://example.com/",                          # wrong scheme
        "file:///etc/passwd",                          # wrong scheme
    ],
)
def test_blocks_internal_and_bad_scheme(url):
    with pytest.raises(ValueError):
        validate_public_http_url(url)


@pytest.mark.parametrize(
    "url",
    [
        "http://8.8.8.8/",          # public literal IP, no DNS needed
        "https://1.1.1.1/path?q=1",
    ],
)
def test_allows_public(url):
    assert validate_public_http_url(url) == url


def test_missing_host():
    with pytest.raises(ValueError):
        validate_public_http_url("http:///nohost")
