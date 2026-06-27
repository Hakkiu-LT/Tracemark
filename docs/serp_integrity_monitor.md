# SERP Integrity Monitor — Algorithm & Data Flow Design

## Overview

The **SERP Integrity Monitor** is a defensive detection module for Tracemark that scans Google/Bing search engine result pages (SERPs) for indexed URLs belonging to a protected brand's own domain, then identifies anomalies caused by XSS-based open redirect attacks, title injection, and SERP hijacking campaigns.

Unlike the main infringement engine (which searches for *other domains* copying a brand), this module detects attackers **weaponizing the brand's own legitimate domain** to serve malicious redirects — appearing trustworthy in search results while silently forwarding victims to adversary-controlled sites.

---

## The Attack Pattern

An attacker exploiting an open redirect or XSS vulnerability on a trusted domain can cause Google to index a URL like:

```
https://trusted-brand.com/redirect?url=https://evil-shop.com
```

In the SERP snippet, this appears as:

| SERP Field       | Value                          | Status   |
|------------------|--------------------------------|----------|
| Favicon          | trusted-brand.com icon         | Legit    |
| Displayed domain | trusted-brand.com              | Legit    |
| Meta description | Original brand description     | Legit    |
| Title tag        | "Buy Fake Goods — evil-shop"   | ANOMALY  |
| Actual redirect  | evil-shop.com                  | ATTACK   |

The key signal: **domain is yours, but title and/or redirect destination is not**.

---

## Detection Strategy

The module cross-validates 4 layers of data for every indexed URL on the brand's domain:

```
Layer 1 — SERP Data:       title, displayed_url, snippet, favicon
Layer 2 — HTTP Resolution: redirect chain, final URL, status codes
Layer 3 — DOM Inspection:  live <title>, meta tags, canonical URL
Layer 4 — Historical Diff: delta vs. last known snapshot of the same URL
```

Any URL where **Layer 1 title != Layer 3 title** or **Layer 2 final URL != brand domain** is flagged as a candidate case.

---

## Full Algorithm & Data Flow

### Step 1 — Build the Known-Good Baseline

Before monitoring begins, index all legitimate pages of the protected brand:

```
Input:  brand_domain (e.g., "trusted-brand.com")
        sitemap.xml or crawl seed URLs

Process:
  FOR each page in brand sitemap:
    store {
      url:               canonical URL
      expected_title:    <title> tag value
      expected_desc:     <meta name="description"> content
      expected_canonical:<link rel="canonical"> href
      last_crawled:      timestamp
      content_hash:      SHA-256 of normalized DOM text
    }

Output: brand_page_registry (stored in DB, per brand client)
```

This registry is the ground truth for anomaly comparison.

---

### Step 2 — SERP Crawl (Scheduled, Per Brand)

Query Google and Bing for all indexed pages under the brand's domain:

```
Query templates:
  site:trusted-brand.com
  site:trusted-brand.com inurl:redirect
  site:trusted-brand.com inurl:url=
  site:trusted-brand.com inurl:goto=
  site:trusted-brand.com inurl:out=
  site:trusted-brand.com inurl:link=

APIs:
  Primary:   Google Custom Search JSON API  (100 free queries/day, $5/1000 after)
  Secondary: SerpAPI / Serper.dev           (richer SERP metadata)
  Tertiary:  Bing Web Search API            (independent index, catches different results)

Per result, extract:
  serp_title:    text of the title link in the snippet
  serp_url:      the href of the result link
  serp_snippet:  the description text shown
  serp_favicon:  favicon URL shown in the result

Pagination: iterate all result pages until exhausted (10 per page, up to 100 results)
Rate limit:  1 req/sec, randomized delay 800ms-2000ms, rotating API keys
```

---

### Step 3 — Title Anomaly Detection

Compare SERP-fetched titles against the known-good baseline:

```python
def detect_title_anomaly(serp_result, brand_registry):
    url = serp_result.url
    known = brand_registry.get(url)

    if known is None:
        # URL not in registry — could be new legit page or injected URL
        return AnomalyType.UNKNOWN_URL, score=0.5

    similarity = fuzzy_ratio(serp_result.title, known.expected_title)

    if similarity < 0.75:
        return AnomalyType.TITLE_MISMATCH, score=(1.0 - similarity)

    return None
```

**Fuzzy matching** (e.g., RapidFuzz `token_sort_ratio`) handles minor CMS-generated title variations without false positives.

Suspicious title patterns that auto-escalate to HIGH risk:
- Contains competitor brand names
- Contains "buy", "cheap", "free", "download", "login" not in original
- Contains non-Latin characters mixed into a Latin-domain title (homoglyph injection)
- Dramatically shorter or longer than expected (> 2x length delta)

---

### Step 4 — HTTP Redirect Chain Resolution

For every flagged URL (and all open-redirect-pattern URLs regardless of title), resolve the full redirect chain:

```
Process:
  1. HEAD request to serp_url (follow_redirects=True, max_redirects=10)
  2. Record full chain:  [url_1 -> url_2 -> url_3 -> ... -> final_url]
  3. Record each hop:    status_code, Location header, response time
  4. Analyze final_url:
       - Matches brand_domain?    -> Clean
       - Matches known CDN/proxy? -> Clean (whitelist check)
       - Matches external domain? -> FLAG as REDIRECT_HIJACK

Risk escalation rules:
  302/301 to external domain        -> HIGH risk
  Meta-refresh to external domain   -> HIGH risk
  JS-based redirect (no Location)   -> requires Step 5 (headless)
  Multiple hops before external     -> CRITICAL (deliberate obfuscation)
```

**Whitelist** known-good redirect targets (CDN, SSO providers, affiliate partners) per brand client to suppress false positives.

---

### Step 5 — Headless DOM Verification (Playwright)

For all HIGH risk candidates, launch a headless browser to:

1. Capture the **live page title** at load time and after JS execution
2. Detect **JS-based redirects** invisible to HEAD requests
3. Record the **final landing URL** after all client-side navigation
4. Take a **full-page timestamped screenshot** for evidence
5. Extract **page metadata**: canonical, og:url, og:title, og:site_name

```typescript
// Playwright snippet
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto(suspiciousUrl, { waitUntil: 'networkidle', timeout: 15000 });

const evidence = {
  timestamp:   new Date().toISOString(),
  initial_url: suspiciousUrl,
  final_url:   page.url(),
  live_title:  await page.title(),
  screenshot:  await page.screenshot({ fullPage: true }),
  ip_resolved: await resolveIP(suspiciousUrl),
  redirected:  page.url() !== suspiciousUrl,
};

await browser.close();
```

Screenshots are stored with metadata: `{ url, timestamp, ip, screenshot_hash, evidence_id }`.

---

### Step 6 — Risk Scoring

Each candidate receives a composite risk score (0.0 to 1.0):

| Signal                              | Weight | Notes                                     |
|-------------------------------------|--------|-------------------------------------------|
| Title similarity < 0.75             | +0.25  | Core anomaly signal                       |
| External redirect detected          | +0.35  | Strong indicator                          |
| JS-only redirect (hidden from HEAD) | +0.10  | Obfuscation attempt                       |
| URL contains open-redirect keywords | +0.10  | redirect=, url=, goto=, out=              |
| Unknown URL (not in registry)       | +0.10  | Could be new legit page — needs review    |
| Multiple redirect hops              | +0.05  | Deliberate evasion                        |
| Final domain on abuse blacklist     | +0.05  | Cross-reference PhishTank, URLhaus, SURBL |

**Risk Levels:**

| Score Range | Level    | Action                                      |
|-------------|----------|---------------------------------------------|
| 0.75 – 1.0  | CRITICAL | Auto-generate evidence + notify immediately |
| 0.50 – 0.74 | HIGH     | Queue for analyst review within 1h          |
| 0.25 – 0.49 | MEDIUM   | Queue for daily batch review                |
| 0.00 – 0.24 | LOW      | Log only, suppress notification             |

---

### Step 7 — Case Creation & Evidence Package

For every CRITICAL or HIGH case, auto-assemble an evidence bundle:

```
Evidence Package Contents:
  - serp_screenshot.png       Full SERP page showing the malicious snippet
  - landing_screenshot.png    Full-page screenshot of redirect destination
  - redirect_chain.json       All HTTP hops with status codes and timestamps
  - metadata.json             {
                                brand_domain, malicious_url, final_url,
                                serp_title, expected_title, similarity_score,
                                ip_address, timestamp, risk_score, risk_level
                              }
  - vulnerability_summary.md  Auto-generated: attack type, affected URL pattern,
                               recommended fix (patch open redirect / report XSS)
```

This package feeds directly into:
- **Google Search Console removal request** (URL removal tool)
- **Hosting provider abuse report**
- **Internal security team alert** (XSS/open redirect patch required)
- **Slack/webhook notification** to the brand owner

---

### Step 8 — Feedback Loop & Registry Update

After analyst review:

```
If case CONFIRMED (true positive):
  -> Add malicious URL pattern to brand watchlist
  -> Flag the URL path pattern as a known attack vector
  -> Retrain title anomaly threshold for this brand
  -> Trigger re-scan of similar URL patterns on same domain

If case DISMISSED (false positive):
  -> Add URL to brand whitelist
  -> Adjust fuzzy threshold up for this page type
  -> Log reason (e.g., "legitimate A/B test title variant")

Registry update schedule:
  -> Re-crawl confirmed-clean pages every 7 days
  -> Re-crawl flagged URL patterns every 24h
  -> Full domain re-baseline every 30 days
```

---

## Complete Data Flow

```
[Brand Registry DB]
       |
       v
  [Scheduler / cron]  --site:domain queries-->  [SERP APIs: Google / Bing / SerpAPI]
                                                          |
                                                  SERP result cards
                                                          |
                                                          v
                                              [Title Anomaly Detector]
                                              (fuzzy match vs registry)
                                                          |
                                          .--------------+--------------.
                                          |                             |
                                     Clean (skip)           Anomaly detected
                                                                        |
                                                                        v
                                                         [HTTP Redirect Chain Resolver]
                                                              (HEAD requests)
                                                                        |
                                                   .--------------+-------------.
                                                   |                            |
                                            Stays on domain          External redirect
                                            (log, low risk)              detected
                                                                              |
                                                                              v
                                                                  [Playwright Headless]
                                                                  DOM + Screenshot
                                                                              |
                                                                              v
                                                                    [Risk Scorer]
                                                                  (composite score)
                                                                              |
                                                         .-----------+----------------.
                                                         |                            |
                                                   LOW / MEDIUM             HIGH / CRITICAL
                                                   (log only)                        |
                                                                                      v
                                                                        [Evidence Package Generator]
                                                                                      |
                                                                    .---------+----------------.
                                                                    |                          |
                                                             [Case Manager]           [Notifications]
                                                             (analyst review)         (Slack/webhook)
                                                                    |
                                                                    v
                                                             [Feedback Loop]
                                                        (whitelist / confirm / retrain)
```

---

## Recommended Tech Stack Integration

| Component            | Recommended Tool                      | Reason                                   |
|----------------------|---------------------------------------|------------------------------------------|
| SERP data            | SerpAPI or Serper.dev                 | Structured JSON, supports pagination     |
| HTTP resolution      | Node.js `undici` / Python `httpx`     | Async, follows redirects, captures chain |
| Headless browser     | Playwright (Chromium)                 | Reliable JS execution, screenshot API    |
| Fuzzy title matching | RapidFuzz (Python) / fuzzysort (TS)   | Fast, accurate token-level comparison    |
| Blacklist cross-ref  | URLhaus API, PhishTank API, SURBL     | Free threat intelligence feeds          |
| Scheduling           | pg-boss (Postgres) / BullMQ           | Fits existing Supabase/Postgres stack    |
| Evidence storage     | Supabase Storage (S3-compatible)      | Screenshots + JSON bundles per case      |
| Notifications        | Existing Slack/Zapier webhook pipeline| Reuse from main infringement engine      |

---

## Key Differentiator vs. Existing Tools

Most brand protection platforms (Red Points, Corsearch, Incopro) focus exclusively on **external domains impersonating the brand**. The SERP Integrity Monitor addresses a fundamentally different and largely undetected attack surface: **the brand's own domain being abused as a trustworthy delivery vector**.

This makes it a unique defensive capability — functioning as both a brand protection feature and a **web security vulnerability scanner** surfaced directly inside the brand protection workflow.
