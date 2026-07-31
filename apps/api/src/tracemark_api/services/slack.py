"""
Slack integration helpers.

Two families of helpers live here:
  1. post_to_slack()           — one-way OUTGOING messages via an incoming webhook
                                 (leads, emails, alerts). Reads the webhook URL from env.
  2. Interactive helpers below — TWO-WAY interactions (buttons + modals) that require a
     real Slack app: signature verification, opening modals (views.open, needs a bot
     token), and replacing the source message via its response_url.

Everything is best-effort and never raises — a Slack failure must not break the request
that triggered it.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import time

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


# ── Interactive Slack app helpers (buttons + modals) ─────────────────────────
#
# These power the "Confirm demo" button on the demo-lead notification. Unlike the
# incoming webhook above, interactivity needs a real Slack app so Slack can call US
# back when a button is clicked. That requires:
#   * SLACK_SIGNING_SECRET — to prove the request genuinely came from Slack.
#   * SLACK_BOT_TOKEN       — a bot token (xoxb-…) so we can open a modal (views.open).
# If either is missing the feature simply stays dormant (buttons won't be added and
# any inbound interaction is rejected), so unconfigured environments are unaffected.


def verify_slack_signature(timestamp: str | None, signature: str | None, body: bytes) -> bool:
    """Verify an inbound Slack request using the v0 signing scheme.

    Slack signs each request with HMAC-SHA256 over ``v0:{timestamp}:{raw_body}`` keyed by
    the app's signing secret, and sends the result in ``X-Slack-Signature`` plus the
    timestamp in ``X-Slack-Request-Timestamp``. We recompute it and constant-time compare.
    The 5-minute timestamp window blocks replay attacks. Returns False (reject) on any
    problem — missing secret, stale timestamp, or mismatch.
    """
    signing_secret = os.environ.get("SLACK_SIGNING_SECRET", "")
    if not signing_secret or not timestamp or not signature:
        return False
    try:
        # Reject anything older than 5 minutes — stops captured requests being replayed.
        if abs(time.time() - int(timestamp)) > 60 * 5:
            return False
    except ValueError:
        return False

    basestring = f"v0:{timestamp}:{body.decode('utf-8', errors='replace')}"
    computed = "v0=" + hmac.new(
        signing_secret.encode(), basestring.encode(), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(computed, signature)


def slack_api(method: str, payload: dict) -> dict:
    """Call a Slack Web API method (e.g. ``views.open``) with the bot token.

    Returns Slack's JSON response (which always has an ``ok`` boolean). Never raises —
    returns ``{"ok": False, "error": ...}`` on transport failure or missing token so
    callers can log and move on.
    """
    token = os.environ.get("SLACK_BOT_TOKEN", "")
    if not token:
        print("[Slack] SLACK_BOT_TOKEN not set — cannot call", method)
        return {"ok": False, "error": "no_bot_token"}
    try:
        resp = httpx.post(
            f"https://slack.com/api/{method}",
            json=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json; charset=utf-8",
            },
            timeout=10.0,
        )
        data = resp.json()
        if not data.get("ok"):
            print(f"[Slack] {method} returned not-ok: {data.get('error')}")
        return data
    except Exception as exc:  # noqa: BLE001 — best-effort, never raise
        print(f"[Slack] {method} failed: {exc}")
        return {"ok": False, "error": str(exc)}


def respond_via_response_url(response_url: str, payload: dict) -> bool:
    """Replace / update the message that triggered an interaction.

    Every interaction payload carries a short-lived ``response_url``; POSTing a message
    there (with ``replace_original: true``) rewrites the source message — no bot token or
    channel membership required. We use it to flip the demo notification to
    "✅ Confirmed" after staff confirm from the modal.
    """
    try:
        httpx.post(response_url, json=payload, timeout=10.0)
        return True
    except Exception as exc:  # noqa: BLE001 — best-effort, never raise
        print(f"[Slack] response_url post failed: {exc}")
        return False
