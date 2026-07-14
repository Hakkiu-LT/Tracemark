"""SSRF-safe validation for user-supplied URLs.

The old check compared the hostname against a list of string prefixes
(``host.startswith("127.")`` …). That is trivially bypassable with alternate
IP encodings (``http://2130706433/`` = 127.0.0.1), IPv6 (``http://[::1]/``),
IPv4-mapped IPv6, or a hostname that simply *resolves* to an internal address.

This module resolves the host and rejects it if it points at any private,
loopback, link-local (incl. the ``169.254.169.254`` cloud-metadata endpoint),
reserved, or multicast address — closing those vectors while leaving ordinary
public URLs (the ones the scrapers actually need) untouched.
"""
from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse


def _ip_is_blocked(ip_str: str) -> bool:
    """True if ``ip_str`` is an address we must never let the server fetch."""
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        # Unparseable → treat as unsafe.
        return True
    # IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1) must be checked as its IPv4 form.
    if ip.version == 6 and getattr(ip, "ipv4_mapped", None) is not None:
        if _ip_is_blocked(str(ip.ipv4_mapped)):
            return True
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    )


def _parse_literal_ip(host: str):
    """Return an ip_address if ``host`` is a literal IP in any common encoding,
    else ``None``. Handles dotted, integer (``2130706433``) and hex
    (``0x7f000001``) forms."""
    try:
        return ipaddress.ip_address(host)
    except ValueError:
        pass
    try:
        if host.lower().startswith("0x"):
            return ipaddress.ip_address(int(host, 16))
        if host.isdigit():
            return ipaddress.ip_address(int(host))
    except (ValueError, OverflowError):
        return None
    return None


def validate_public_http_url(url: str) -> str:
    """Return ``url`` unchanged if it is a well-formed http(s) URL that does not
    target an internal/private address. Raise ``ValueError`` otherwise.

    On a transient DNS resolution failure the URL is allowed through: the
    downstream fetch will fail on its own, and we prefer that over blocking a
    legitimate host because of a momentary DNS hiccup.
    """
    try:
        parsed = urlparse(url)
    except Exception:
        raise ValueError("Invalid URL")

    if parsed.scheme not in ("http", "https"):
        raise ValueError("Only http/https URLs are allowed")

    host = parsed.hostname
    if not host:
        raise ValueError("URL has no host")

    literal_ip = _parse_literal_ip(host)
    if literal_ip is not None:
        if _ip_is_blocked(str(literal_ip)):
            raise ValueError("Internal/private URLs are not allowed")
        return url

    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        return url  # can't resolve now — let the fetch fail naturally

    for info in infos:
        ip_str = info[4][0]
        # Strip any IPv6 zone id (e.g. "fe80::1%eth0").
        ip_str = ip_str.split("%", 1)[0]
        if _ip_is_blocked(ip_str):
            raise ValueError("Internal/private URLs are not allowed")

    return url
