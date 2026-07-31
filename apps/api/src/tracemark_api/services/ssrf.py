"""Central SSRF guard. Call validate_ssrf_url() before any server-side HTTP fetch.

Rejects: non-http(s) schemes, and any hostname that resolves to a private/loopback/
link-local/reserved IP. This prevents attackers from using the server as a proxy to
reach internal services or cloud metadata endpoints.
"""
from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urljoin, urlparse

import requests


class SSRFError(ValueError):
    """Raised when a URL is rejected as an SSRF risk."""


# Redirect chains on legitimate sites (http→https→www→locale) rarely exceed a
# handful of hops; cap low enough to bound work but high enough not to break
# real marketplaces.
_MAX_REDIRECTS = 5


_BLOCKED_SCHEMES = {"javascript", "data", "file", "ftp", "gopher", "blob"}


def _ip_is_forbidden(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return True
    return (
        addr.is_private
        or addr.is_loopback
        or addr.is_link_local
        or addr.is_reserved
        or addr.is_multicast
        or addr.is_unspecified
    )


def validate_ssrf_url(url: str) -> None:
    """Raise SSRFError if `url` is unsafe to fetch server-side. Returns None if OK."""
    if not url or not isinstance(url, str):
        raise SSRFError("Empty or non-string URL")

    parsed = urlparse(url.strip())
    scheme = (parsed.scheme or "").lower()

    if scheme in _BLOCKED_SCHEMES:
        raise SSRFError(f"Disallowed URL scheme: {scheme}")
    if scheme not in ("http", "https"):
        raise SSRFError("Only http/https URLs are allowed")

    host = (parsed.hostname or "").strip().lower()
    if not host:
        raise SSRFError("URL has no host")

    # If the host is a literal IP, check it directly.
    try:
        ipaddress.ip_address(host)
        if _ip_is_forbidden(host):
            raise SSRFError("URL points to a private/reserved IP")
        return
    except ValueError:
        pass  # not a literal IP — resolve below

    # Resolve DNS and reject if ANY resolved address is forbidden (DNS-rebinding guard).
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror as exc:
        raise SSRFError(f"Could not resolve host: {host}") from exc

    for info in infos:
        ip = info[4][0]
        if _ip_is_forbidden(ip):
            raise SSRFError("URL resolves to a private/reserved IP")


def safe_get(
    url: str,
    *,
    headers: dict | None = None,
    timeout: float = 10,
    max_redirects: int = _MAX_REDIRECTS,
    **kwargs,
) -> requests.Response:
    """SSRF-safe HTTP GET that re-validates the target on EVERY redirect hop.

    ``requests.get(..., allow_redirects=True)`` validates (at most) the initial
    URL, then blindly follows 30x redirects — so an attacker-controlled page can
    ``302 → http://169.254.169.254/`` or ``→ http://127.0.0.1:8000/internal/...``
    and the guard is bypassed. This helper follows redirects MANUALLY, running
    ``validate_ssrf_url`` before fetching each hop, and raises ``SSRFError`` if a
    redirect points somewhere forbidden or the chain is too long.
    """
    current = url
    for _ in range(max_redirects + 1):
        validate_ssrf_url(current)
        resp = requests.get(
            current,
            headers=headers,
            timeout=timeout,
            allow_redirects=False,
            **kwargs,
        )
        if resp.is_redirect:
            location = resp.headers.get("Location")
            if not location:
                return resp
            # Resolve relative redirects against the current URL.
            current = urljoin(current, location)
            continue
        return resp
    raise SSRFError(f"Too many redirects (>{max_redirects}) starting from {url}")
