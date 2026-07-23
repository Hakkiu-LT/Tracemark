"""
Resend email wrapper. All outgoing emails go through send_email().
Reads RESEND_API_KEY from env; silently logs if key is missing (dev mode).
"""
from __future__ import annotations

import os


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
