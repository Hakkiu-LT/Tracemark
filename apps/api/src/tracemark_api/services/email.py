"""
Resend email wrapper. All outgoing emails go through send_email().
Reads RESEND_API_KEY from env; silently logs if key is missing (dev mode).
"""
from __future__ import annotations

import os

# Reserved / placeholder domains that can never receive real mail (RFC 2606 +
# common seed/test values). Resend rejects these with a 422 validation_error,
# so we short-circuit before hitting the API to keep the logs clean.
_UNDELIVERABLE_DOMAINS = {
    "example.com",
    "example.net",
    "example.org",
    "example.edu",
    "test.com",
    "email.com",
    "localhost",
}
_UNDELIVERABLE_TLDS = (".test", ".example", ".invalid", ".local", ".localhost")


def _is_undeliverable(to: str) -> bool:
    """True when ``to`` is malformed or points at a reserved/placeholder domain."""
    addr = (to or "").strip().lower()
    if "@" not in addr:
        return True
    domain = addr.rsplit("@", 1)[1]
    if domain in _UNDELIVERABLE_DOMAINS:
        return True
    return domain.endswith(_UNDELIVERABLE_TLDS)


def send_email(
    to: str,
    subject: str,
    html: str,
    text: str | None = None,
    from_address: str = "info@hakkiu.com",
    from_name: str = "HAKKIU",
) -> bool:
    """
    Send an email via Resend. Returns True on success, False on failure.
    Never raises — caller should not crash on email failure.
    """
    if _is_undeliverable(to):
        print(f"[Email] Skipping undeliverable/placeholder recipient {to!r}: {subject}")
        return False

    api_key = os.environ.get("RESEND_API_KEY", "")
    if not api_key:
        print(f"[Email] RESEND_API_KEY not set — skipping email to {to}: {subject}")
        return False

    try:
        import resend

        resend.api_key = api_key
        params: dict = {
            "from": f"{from_name} <{from_address}>",
            "to": [to],
            "subject": subject,
            "html": html,
        }
        if text:
            params["text"] = text
        resend.Emails.send(params)
        print(f"[Email] Sent '{subject}' to {to}")
        return True
    except Exception as exc:
        print(f"[Email] Failed to send '{subject}' to {to}: {exc}")
        return False
