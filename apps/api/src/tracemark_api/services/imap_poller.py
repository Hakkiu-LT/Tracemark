"""
IMAP → Slack poller with per-alias routing.

Reads the info@hakkiu.com mailbox (Hostinger) over IMAP every few minutes and
forwards each NEW email into a Slack channel via the existing ``post_to_slack``
helper — no paid Slack "Email" app needed.

Per-alias routing
-----------------
All of the domain's aliases (legal@, privacy@, security@, support@) deliver into
the SAME info@ mailbox. An alias has no mailbox of its own, so the only way to
tell which address an email was sent to is to inspect its recipient headers
(To / Cc / Delivered-To / X-Original-To). We match those against ``_ALIAS_ROUTES``
and post to that alias's channel; anything unmatched (incl. mail straight to
info@) goes to the fallback channel ``SLACK_WEBHOOK_EMAIL``. A message addressed
to several aliases is posted to each matching channel.

Idempotency
-----------
We fetch only UNSEEN mail and mark a message SEEN only AFTER it has been posted
to Slack. So a restart never re-posts an already-forwarded email.

Everything is best-effort: a bad connection or Slack hiccup is logged and
swallowed — it must never crash the API. Mirrors weekly_digest / scraper_health.
"""
from __future__ import annotations

import os
import time

from tracemark_api.services.slack import post_to_slack

# Alias local-part (before the @) -> Slack webhook env var for its channel.
# Mail to info@ itself, or to any address not listed here, uses the fallback.
_ALIAS_ROUTES = {
    "legal": "SLACK_WEBHOOK_LEGAL",
    "privacy": "SLACK_WEBHOOK_PRIVACY",
    "security": "SLACK_WEBHOOK_SECURITY",
    "support": "SLACK_WEBHOOK_SUPPORT",
}
_FALLBACK_WEBHOOK = "SLACK_WEBHOOK_EMAIL"

# Truncate long email bodies so we don't dump a 40 KB newsletter into Slack.
_MAX_BODY_CHARS = 1500


def _config() -> dict | None:
    """Read IMAP settings from the shared .env; None (with a log) if unconfigured."""
    user = os.environ.get("IMAP_EMAIL", "")
    password = os.environ.get("IMAP_PASSWORD", "")
    if not user or not password:
        print("[IMAP Poller] IMAP_EMAIL / IMAP_PASSWORD not set — poller disabled")
        return None
    # The mail domain (e.g. hakkiu.com) is taken from the mailbox address so alias
    # matching stays correct even if the domain changes.
    domain = user.split("@", 1)[1].lower() if "@" in user else ""
    return {
        "host": os.environ.get("IMAP_HOST", "imap.hostinger.com"),
        "port": int(os.environ.get("IMAP_PORT", "993")),
        "user": user,
        "password": password,
        "domain": domain,
        # Cap forwards per poll so a big backlog doesn't flood Slack at once.
        "max_per_poll": int(os.environ.get("IMAP_MAX_PER_POLL", "25")),
    }


def _recipient_addresses(msg) -> set[str]:
    """
    All addresses this email was delivered to: To + Cc plus the envelope headers
    Delivered-To / X-Original-To (these carry the real target when an alias or BCC
    is used and the address is absent from To/Cc). Returns lowercased addresses.
    """
    addrs: set[str] = set()
    for addr in list(msg.to) + list(msg.cc):
        if addr:
            addrs.add(addr.strip().lower())
    for header in ("delivered-to", "x-original-to"):
        for value in msg.headers.get(header, ()):  # tuple of raw header values
            value = value.strip().lower()
            # A header value may be "Name <addr>" or bare "addr"; grab the addr part.
            if "<" in value and ">" in value:
                value = value[value.find("<") + 1:value.find(">")]
            if "@" in value:
                addrs.add(value)
    return addrs


def _route_webhooks(msg, domain: str) -> list[str]:
    """
    Decide which Slack webhook env var(s) an email should post to, based on which
    alias(es) it was sent to. Falls back to SLACK_WEBHOOK_EMAIL when nothing matches.
    """
    matched: list[str] = []
    for addr in _recipient_addresses(msg):
        local, _, dom = addr.partition("@")
        if domain and dom != domain:
            continue  # ignore recipients outside our domain
        env = _ALIAS_ROUTES.get(local)
        if env and env not in matched:
            matched.append(env)
    return matched or [_FALLBACK_WEBHOOK]


def _format_message(msg) -> tuple[str, list]:
    """Build the Slack text + blocks for one email message."""
    sender = msg.from_ or "(unknown sender)"
    subject = (msg.subject or "(no subject)").strip()
    to_line = ", ".join(msg.to) if msg.to else "info@"
    date = msg.date.strftime("%Y-%m-%d %H:%M") if msg.date else ""

    body = (msg.text or msg.html or "").strip()
    if len(body) > _MAX_BODY_CHARS:
        body = body[:_MAX_BODY_CHARS] + "\n… (truncated)"

    text = f"📩 New email to {to_line}\n*From:* {sender}\n*Subject:* {subject}"
    blocks = [
        {"type": "header", "text": {"type": "plain_text", "text": f"📩 {subject}"[:150]}},
        {"type": "section", "fields": [
            {"type": "mrkdwn", "text": f"*From:*\n{sender}"},
            {"type": "mrkdwn", "text": f"*To:*\n{to_line}"},
        ]},
    ]
    if date:
        blocks.append({"type": "context", "elements": [{"type": "mrkdwn", "text": f"🕒 {date}"}]})
    if body:
        blocks.append({"type": "section", "text": {"type": "mrkdwn", "text": f"```{body}```"}})
    return text, blocks


def poll_once() -> int:
    """
    One poll: fetch unseen mail, route + post each to Slack, mark posted ones seen.
    Returns the number of emails forwarded. Never raises.
    """
    cfg = _config()
    if cfg is None:
        return 0

    from imap_tools import AND, MailBox, MailMessageFlags  # lazy import

    forwarded = 0
    try:
        with MailBox(cfg["host"], port=cfg["port"]).login(cfg["user"], cfg["password"]) as mailbox:
            messages = list(
                mailbox.fetch(AND(seen=False), mark_seen=False, limit=cfg["max_per_poll"], reverse=False)
            )
            for msg in messages:
                text, blocks = _format_message(msg)
                # Resolve each routed alias to its webhook; if an alias channel is
                # not configured yet, fall back so the email is never stuck unseen.
                webhooks: list[str] = []
                for env in _route_webhooks(msg, cfg["domain"]):
                    chosen = env if os.environ.get(env) else _FALLBACK_WEBHOOK
                    if chosen not in webhooks:
                        webhooks.append(chosen)
                posted_any = False
                for env in webhooks:
                    if post_to_slack(env, text=text, blocks=blocks):
                        posted_any = True
                if posted_any:
                    # Mark seen only after at least one channel accepted it, so a
                    # total failure leaves the mail unread to retry next poll.
                    mailbox.flag(msg.uid, MailMessageFlags.SEEN, True)
                    forwarded += 1
                else:
                    print(f"[IMAP Poller] All Slack posts failed for uid={msg.uid} — will retry")
    except Exception as exc:  # noqa: BLE001 — best-effort background job, never crash the API
        print(f"[IMAP Poller] Poll failed: {exc}")
        return forwarded

    if forwarded:
        print(f"[IMAP Poller] Forwarded {forwarded} email(s) to Slack")
    return forwarded


def run_email_poller() -> None:
    """Startup daemon loop: poll every IMAP_POLL_SECONDS (default 120s)."""
    if _config() is None:
        return  # dormant — nothing to do on this machine
    interval = int(os.environ.get("IMAP_POLL_SECONDS", "120"))
    print(f"[IMAP Poller] Started — polling every {interval}s")
    while True:
        poll_once()
        time.sleep(interval)
