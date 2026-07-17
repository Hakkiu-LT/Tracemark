# Notifications & Email — Plan

The complete plan for **when Tracemark sends an email**, to whom, with what
urgency, and why. Grounded in the product's real events; the event hooks below
mostly already exist in code but currently hit a no-op dispatcher
(`services/notifications.py`).

Status: **plan / spec** (not yet implemented). See §7 for build order.

---

## 1. Design principles

These rules keep notifications valuable instead of becoming spam.

1. **Severity routing.** HIGH-risk / legally urgent findings → **immediate**.
   MEDIUM / LOW → **rolled into a digest**. Immediate email for everything = alert
   fatigue = users mute us. This is the most important rule.
2. **Batch per scan, not per finding.** A scan that finds 40 listings sends
   **one** "40 new infringements" email, never 40 emails.
3. **Dedupe on NEW only.** The unique constraint `infringements(case_id, source_url)`
   means only a genuinely new row triggers an alert — never a re-detection of the
   same listing.
4. **User preferences.** Per-user toggles: immediate vs digest per severity,
   per-brand mute, digest frequency (off / daily / weekly), quiet hours. Stored on
   `org_settings` (which already holds `notification_email`).
5. **Frequency cap + quiet hours.** Never more than N immediate emails/hour per
   org; hold non-urgent mail until working hours.
6. **One clear CTA per email**, deep-linked into the app (View case / Review
   takedown / Update card).
7. **Deliverability first.** Verified sending domain (SPF + DKIM + DMARC). An
   alert in spam is worse than no alert.

---

## 2. Detection / monitoring — the core value

| # | Event | Timing | To | Why |
|---|---|---|---|---|
| 1 | **First infringement ever for a brand** | Immediate | Owner | The activation "aha" — proves the product works. |
| 2 | **New HIGH-risk infringement** | Immediate | Owner / assignee | The core promise; urgency justifies interruption. |
| 3 | **Clone domain detected** | Immediate | Owner | Legal urgency (phishing / typosquat). |
| 4 | **Ad hijacking detected** | Immediate | Owner | Active revenue theft — time-sensitive. |
| 5 | **New MEDIUM / LOW infringements** | Daily digest | Owner | Real but not urgent — batch to protect attention. |
| 6 | **Scan completed (N new findings)** | Digest / on-demand | Owner | Summary, not per-item. |
| 7 | **Scan failed / degraded (quota hit)** | Immediate | Owner + ops | Tell the user their scan was incomplete instead of silently returning partial data when Firecrawl/Gemini caps are hit. |
| 8 | **Spike alert** (unusual burst of new infringements) | Immediate | Owner | Signals a counterfeit *campaign*, not a one-off. (Phase 2.) |

---

## 3. Enforcement / workflow

| # | Event | Timing | To | Why |
|---|---|---|---|---|
| 9 | **Takedown report generated / ready** | Immediate | Owner | Action is ready to review + send. |
| 10 | **Takedown submitted / sent** | Immediate | Owner | Confirmation of a legally significant action. Only mark "sent" when the send actually succeeds. |
| 11 | **Takedown acknowledged / resolved** | Immediate | Owner | Closes the loop; success drives retention. |
| 12 | **Managed takedown requested ($500)** | Immediate | Owner + Tracemark team | Owner gets confirmation; the team gets a work ticket. |
| 13 | **Managed takedown completed** | Immediate | Owner | Justifies the $500. |
| 14 | **Pending-action reminder** ("5 HIGH infringements awaiting review for 3 days") | Scheduled nudge | Owner | Builds the enforcement habit; prevents churn-by-neglect. |
| 15 | **Case escalated / dismissed** | Optional / team | Team members | Multi-user awareness (if the org has teammates). |

---

## 4. Digests & reports (retention engine)

| # | Event | Timing | To | Why |
|---|---|---|---|---|
| 16 | **Daily digest** | Daily (opt-in) | Owner | Yesterday's new findings across all brands, in one email. |
| 17 | **Weekly summary** | Weekly (default) | Owner | Brands watched, new infringements, takedowns sent, success rate, top platforms. The #1 "you're getting value" email. |
| 18 | **Monthly branded PDF report** | Monthly | Owner (Pro / Agency) | Ties to the `advanced_reports` entitlement; law firms forward these to clients. |

---

## 5. Account, billing, usage, security (transactional)

### 5.1 Account / lifecycle
| # | Event | Timing | Why |
|---|---|---|---|
| 19 | Verify email (Supabase Auth) | Immediate | Table-stakes; enables safe `enable_confirmations`. |
| 20 | Welcome / "add your first brand" | On signup | Onboarding — no brand = no value. |
| 21 | First scan complete | Immediate | Reinforces the loop early. |
| 22 | Re-engagement (no activity X days) | Scheduled | Win-back before churn. |
| 23 | Team invite / role change | Immediate | If/when multi-user orgs exist. |

### 5.2 Billing (protects revenue)
| # | Event | Timing | Why |
|---|---|---|---|
| 24 | Payment receipt (`invoice.paid`) | Immediate | Expected; reduces support load. |
| 25 | Payment failed → dunning (day 0, 3, 7) | Sequence | Recovers failed payments; link to update card. |
| 26 | Card expiring soon | Scheduled | Prevents involuntary churn. |
| 27 | Trial ending (3 days / 1 day) | Scheduled | Conversion nudge. |
| 28 | Subscription changed (up / down / cancel) | Immediate | Confirmation + clarity. |
| 29 | Managed-takedown $500 receipt | Immediate | A real charge needs a receipt. |
| 30 | Brand locked (downgrade) | Immediate | `reconcile_brand_locks` locks the oldest brands on downgrade — explain why + how to restore. |

### 5.3 Usage / limits (upsell + no surprises)
| # | Event | Timing | Why |
|---|---|---|---|
| 31 | 80% of credits / quota used | On threshold | Heads-up before disruption. |
| 32 | Quota exhausted | Immediate | Upgrade / buy-credits CTA, and the user learns scans stopped instead of getting silently empty results. |
| 33 | Approaching brand limit | On threshold | Natural upgrade prompt. |

### 5.4 Security
| # | Event | Why |
|---|---|---|
| 34 | Password reset | Table-stakes (Supabase Auth). |
| 35 | Password / email changed | Account-takeover awareness. |
| 36 | New-device login | Optional; higher trust. |

---

## 6. User preference model

Stored per org (extend `org_settings`) and optionally per user:

- `notification_email` — recipient (already exists).
- `digest_frequency` — `off` | `daily` | `weekly` (default `weekly`).
- `immediate_severities` — which severities send immediately (default `["HIGH"]`).
- `muted_brands` — brand ids to suppress.
- `quiet_hours` — e.g. `22:00–07:00` local; hold non-urgent mail.
- Transactional email (billing, security, verification) is **always on** — not
  subject to preferences.

---

## 7. Build order

**MVP (first — highest value, lowest effort):**
- Transactional: verify email, password reset (Supabase SMTP); payment receipt +
  payment-failed dunning (Stripe webhooks already fire these).
- Core value: new HIGH infringement (immediate); weekly digest; quota-hit /
  scan-degraded alert.
- Enforcement: takedown-submitted confirmation.

**Phase 2:** daily digest, MEDIUM/LOW batching, managed-takedown emails, monthly
PDF report, pending-action reminders, usage-threshold nudges, re-engagement.

**Phase 3:** spike / campaign detection, team notifications, new-device login,
Slack / webhook channel.

---

## 8. Implementation notes

**Events already emitted in code** (currently no-op — plumbing is half there):

| Event key | Fired in | Maps to |
|---|---|---|
| `new_infringement` | `services/persistence.py` | #1–5 |
| `case_escalated` / `case_dismissed` | `routes/monitoring.py` | #15 |
| `takedown_generated` | `routes/documents.py`, `services/document_persistence.py` | #9 |
| `takedown_submitted` | `routes/monitoring.py` | #10 |
| `invoice.paid`, `invoice.payment_failed`, `customer.subscription.*` | `routes/billing.py` (webhooks) | #24–30 |

**What's missing to make this real:**
1. A real sender behind a **provider adapter** (`EMAIL_PROVIDER` env: `resend` |
   `ses`) so switching providers is a one-function change. Start with **Resend**
   (free tier, simplest); move to **Amazon SES** at scale (~10× cheaper per email).
2. **Severity routing + batching + digests** — a small scheduler (also needed for
   the missing "real-time monitoring" scans).
3. **Preferences** in `org_settings` (§6).
4. **Missing events**: #7 quota-hit / degraded, #16–17 digests, #25 dunning
   sequence, #31–33 usage thresholds.
5. **Honest delivery log** — only mark `notification_deliveries.status = 'sent'`
   (and takedown status) on a real 2xx from the provider. Today the takedown
   endpoint reports success while sending nothing.
6. **Deliverability** — verify the sending domain (SPF / DKIM / DMARC) before any
   volume, or alerts land in spam.
