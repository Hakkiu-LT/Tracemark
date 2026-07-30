"""
Slack incoming-webhook wrapper. All outgoing Slack messages go through
post_to_slack(). Reads the webhook URL from env; silently logs if it is missing
(so dev / unconfigured environments simply skip the post). Never raises — a Slack
failure must not break the request that triggered it.
"""
from __future__ import annotations

import os

import httpx


def post_to_slack(webhook_env_var: str, text: str, blocks: list | None = None) -> bool:
    """
    Post a message to a Slack incoming webhook whose URL lives in ``webhook_env_var``.

    Returns True on success, False on failure or when the webhook is not configured.
    Never raises — the caller should not crash on a Slack failure.
    """
    webhook_url = os.environ.get(webhook_env_var, "")
    if not webhook_url:
        print(f"[Slack] {webhook_env_var} not set — skipping Slack post")
        return False

    payload: dict = {"text": text}
    if blocks:
        payload["blocks"] = blocks

    try:
        response = httpx.post(webhook_url, json=payload, timeout=10.0)
        if response.status_code != 200:
            print(f"[Slack] Non-200 from webhook ({webhook_env_var}): "
                  f"{response.status_code} {response.text}")
            return False
        print(f"[Slack] Posted message via {webhook_env_var}")
        return True
    except Exception as exc:  # noqa: BLE001 — best-effort side effect, never raise
        print(f"[Slack] Failed to post via {webhook_env_var}: {exc}")
        return False
