"""Central SSRF guard. Call validate_ssrf_url() before any server-side HTTP fetch.

Rejects: non-http(s) schemes, and any hostname that resolves to a private/loopback/
link-local/reserved IP. This prevents attackers from using the server as a proxy to
reach internal services or cloud metadata endpoints.
"""
from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse


class SSRFError(ValueError):
    """Raised when a URL is rejected as an SSRF risk."""


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
