# Unified Feature Roadmap

This document unifies the frontend and backend roadmap tasks, organized by **Feature Areas**.

> **Legend**: ✅ Done · ⚠️ Partial · ❌ Missing · 🔴 High Priority

---

## ⚠️ MANDATORY RULE — Admin Portal parity for every new feature

**Any new feature that creates, stores, or changes customer data MUST also be wired into the Admin Portal (`apps/admin` + `apps/admin-api`).** When you add functionality:
1. **Expose it in admin** — staff must be able to VIEW the new data across all organizations (add/extend an admin-api route reading via `customer_sb()`, gated by a staff permission).
2. **Make it editable in admin** — staff must be able to EDIT/manage it (PATCH/DELETE), reusing the same DB tables the customer app uses (so changes reflect on both sides), and log every mutation via `write_audit_log`.
3. **Add a permission** to the catalog (`apps/admin-api/.../permissions.py` + `apps/admin/src/lib/permissions.ts`) if the feature is a new resource.
4. **Surface it in the UI** — a page/section under the relevant Company/Case/User view.

Rationale: admin ≠ a copy of the app; it reads/writes the SAME Supabase tables, so parity keeps staff able to support, test, and control everything customers do. A feature is not "done" until it is usable from the Admin Portal.

---

## 🔴 HIGH PRIORITY — Automation Rules Builder
*Allow users to create if/then rules that automatically trigger actions (takedown, escalate, notify) based on detection conditions — without manual review per case. Red Points sells this as "Unlimited Automation Rules". This is a top sales differentiator.*

### Backend
- **`automation_rules` DB schema migration** | ❌ Missing | Table storing rule conditions (platform, confidence threshold, risk level, keyword match) and actions (auto-takedown, escalate, notify, dismiss).
- **Rules evaluation engine** | ❌ Missing | Service that runs after `detection_funnel.py` / `decision.py` — checks each new infringement against saved user rules and executes matching actions automatically.
- **`POST/GET/PUT/DELETE /api/v1/rules` endpoints** | ❌ Missing | CRUD for automation rules, scoped per org.
- **Integration hook in pipeline** | ❌ Missing | After `persist_infringement()`, call rules engine to evaluate and execute any matching rules immediately.

### Frontend
- **`/settings/automation` route + Rules Builder UI** | ❌ Missing | Page listing active rules with enable/disable toggles.
- **Rule creation dialog** | ❌ Missing | If/then form: condition selectors (platform, confidence %, risk level, keyword match) + action selector (send takedown, escalate, dismiss, email notify).
- **Rules activity log** | ❌ Missing | Show which rule triggered on which case (audit trail).

---

## 1. Core Platform & MVP Foundations
*Initial dashboard layout, database schemas, brand checking forms, and basic LangGraph pipeline.*

### Backend
- **Multi-tier `gather_evidence` scraper** | ✅ Done | Scraping engine routing to BS4 custom scrapers, WHOIS, and Firecrawl fallback.
- **`cases`, `evidence`, `decisions` schema migrations** | ✅ Done | Supabase database migrations establishing tables, FKs, and RLS policies.
- **LangGraph brand-check AI pipeline** | ✅ Done | Orchestrates evidence gathering, Gemini-based analysis, and decision creation.
- **`/api/v1/monitoring/gather-evidence` endpoint** | ✅ Done | Exposes scraping and typosquatting results to client.
- **`/api/v1/monitoring/make-decision` endpoint** | ✅ Done | Triggers AI analysis on evidence and outputs structured risk scores.

### Frontend
- **Brand search and check form** | ✅ Done | Interactive user form to search brands and trigger monitoring pipelines.
- **Dashboard overview layout** | ✅ Done | Skeleton layout listing check logs and basic alert summaries.
- **Mock response integration** | ✅ Done | Wired form to mock check-brand API for local frontend design.
- **Real endpoint wiring** | ✅ Done | Connected brand check button to live backend `/monitoring/check-brand`.
- **Verification of results display** | ✅ Done | Shows dynamic card outputs of detected listings and WHOIS typos.

---

## 2. Platform Integrations & Scrapers
*Specific parsers and scraping logic for all target channels (e-commerce marketplaces, social media, ad networks, domains) and frontend registration configurations.*

### Backend
- **Amazon Scraper** | ✅ Done | Static HTML (requests + BS4, $0). Custom parser extracting titles, prices, and links without Firecrawl credits.
- **eBay Scraper** | ✅ Done | Static HTML (requests + BS4, $0).
- **AliExpress Scraper** | ✅ Done | JS-heavy (Firecrawl, 10 credits/call) + Gemini structured extraction.
- **Shopify Scraper** | ✅ Done | Hybrid (direct JSON products.json API + Google SERP discovery, $0).
- **Etsy Scraper** | ✅ Done | Static HTML search card parsing (requests + BS4, $0).
- **Facebook Marketplace Scraper** | ✅ Done | JS-heavy (Firecrawl) + Gemini structured extraction.
- **TikTok Scraper** | ✅ Done | JS-heavy (Firecrawl) + video description and views extraction.
- **Instagram Scraper** | ✅ Done | JS-heavy (Firecrawl) + caption and usernames extraction.
- **Google Shopping Scraper** | ✅ Done | Static HTML parsing (requests + BS4, $0).
- **Domain Surveillance** | ✅ Done | `GoogleSERPAPI` + `WhoisAPI` (SERP search links + WHOIS registry checks and whitelisting).
- **Google Ads** | ✅ Done | Google Ads Transparency Center JSON API query with HTML fallbacks.
- **Meta Ads** | ✅ Done | Graph API v19.0 query with screenshot capture & token exchanges.
- **Alibaba Scraper** | ✅ Done | Static HTML parsing (requests + BS4, $0).
- **Unified Scraper Routing Engine (`unified_scraper.py`)** | ✅ Done | General-purpose web scraper routing targets across 3 tiers *(Note: These are HTTP/JS scraping tiers, separate from the 0/1/2 detection funnel tiers in Section 3/17)*:
  - **Tier 1 — Known Static Domains**: Uses local `requests` + `BeautifulSoup` ($0 cost, local CPU) for speed and efficiency. Targets include `amazon.com`, `ebay.com`, `alibaba.com`, `walmart.com`, `etsy.com`, `craigslist.org`, `google.com`, `wikipedia.org`, `dhgate.com`, and `made-in-china.com`. **Resiliency Fallback**: If the static scrape fails, encounters an antibot/CAPTCHA challenge, or extracts fewer than 200 characters, it automatically falls back to Firecrawl (Tier 2).
  - **Tier 2 — Known JS-heavy Domains**: Directly routes to `Firecrawl` (paid external API) for JavaScript rendering and SPA support. Targets include `aliexpress.com`, `tiktok.com`, `instagram.com`, `facebook.com`, `twitter.com`, `x.com`, `pinterest.com`, `shopify.com`, `taobao.com`, `jd.com`, and `rakuten.com`.
  - **Tier 3 — Unknown Domains**: Runs a runtime heuristic JS-detection probe (inspecting HTTP status, Cloudflare/CAPTCHA signatures, empty SPA mounting divs, framework script tags, and text-to-HTML ratios). Tries static scraping first, falling back to JS rendering/Firecrawl if JS dependency or challenge pages are detected.

### Frontend
- **Register basic platforms config** | ✅ Done | Uncommented Shopify, eBay, AliExpress, Instagram, and TikTok in `platforms.ts`.
- **Add new platform listings config** | ✅ Done | Registered Alibaba, Etsy, Facebook Marketplace, and Google Shopping details inside config.
- **Type safety unions** | ✅ Done | Added `"Alibaba" | "Etsy" | "Facebook Marketplace" | "Google Shopping"` to `Platform` type in `store.ts`.
- **Platform dropdown rendering** | ✅ Done | Updated standard `ALL_PLATFORMS` selection mapping arrays in monitoring pages.

---

## 3. Brand Matching & AI Verification Engine
*Foundational matchers, image inspection, OCR, and AI decision logic.*

### Backend
- **`MatchResult` Pydantic model** | ✅ Done | Defined in `services/detection.py` — supports `keyword`, `image_hash`, `none` match types.
- **`keyword_matcher()` (Levenshtein fuzzy)** | ✅ Done | `services/detection.py` — uses rapidfuzz `partial_ratio`, threshold=0.80.
- **`hash_matcher()` (pHash via ImageHash)** | ✅ Done | `services/detection.py` — uses `imagehash.phash`, Hamming distance, max_distance=10.
- **Unit tests `test_matchers.py`** | ✅ Done | 28 tests in `apps/api/tests/test_matchers.py` — covers keyword, hash, OCR, model validation.
- **Image OCR (Gemini Vision)** | ✅ Done | `ocr_extract_text()` in `services/detection.py` — uses Gemini 2.5 Flash vision.
- **`generate_analysis()` in `ai.py` (AIAnalysis schema)** | ✅ Done | `AIAnalysis` model + `generate_evidence_analysis()` in `services/ai.py` — structured per-evidence output via Gemini Vision.
- **`ai_analysis (jsonb)` stored on evidence row** | ✅ Done | `persist_evidence()` auto-populates when `brand_name` is provided.
- **Fuzzy Domain Pre-Filter & Clone Validation** | ✅ Done | Filters out non-brand relevant domains (similarity < 0.60) and ignores non-clone domains from evidence scoring.
- **Confidence scoring & weights tuning** | ✅ Done | Composite scoring based on text overlap and image similarity.

---

## 4. Dashboard Feed, Polling & Authentication
*Alert feed UI, live data updates, and authentication guards.*

### Backend
- **`GET /api/v1/infringements` API endpoint** | ✅ Done | `routes/infringements.py` — list + single + evidence, 6 tests passing.
- **`GET /api/v1/me` endpoint** | ✅ Done | `routes/auth.py` — validates Supabase JWT, returns `UserProfile`.
- **Google OAuth configured in Supabase** | ✅ Done | Enabled on Supabase dashboard, Client ID/Secret added.
- **`pytest tests/test_auth.py`** | ✅ Done | 7 tests — /me JWT validation, admin 403/200, no-token 401.

### Frontend
- **`<InfringementAlertFeed />` React component** | ✅ Done | Live alert feed listing database-sourced violations.
- **TanStack Query polling every 30s** | ✅ Done | Configured auto-polling hook in query.
- **Filter bar (Risk Level, Platform, Status, Date Range)** | ✅ Done | Implemented search & filters for risk, platform, status, and date.
- **Protected route guard (`<RequireAuth />`)** | ✅ Done | Implemented in `__root.tsx` via `RequireAuth`.
- **Sign-in page (`/auth/sign-in`)** | ✅ Done | `auth.sign-in.tsx`.
- **Sign-up page (`/auth/sign-up`)** | ✅ Done → 🔒 disabled (book-a-demo) | Route redirects to `/landing`; `auth-screen.tsx` is now sign-in only (no `signUp()` path). Public signup off in `config.toml`; ⚠️ still must be disabled in the prod Supabase Dashboard (Auth → Sign In / Up) to block direct anon-key signups.
- **Auth callback route (`/auth/callback`)** | ✅ Done | `auth.callback.tsx`.
- **User menu with avatar + sign-out** | ✅ Done | `src/components/user-menu.tsx`.

---

## 5. Case Details & Evidence View
*Case details pages, timeline events, WHOIS lookups, and case action controls.*

### Backend
- **`GET /api/v1/infringements/{id}` API endpoint** | ✅ Done | `routes/infringements.py` — 404 on missing.
- **`GET /api/v1/infringements/{id}/evidence` API endpoint** | ✅ Done | `routes/infringements.py` — newest-first.
- **WHOIS Typosquatting lookup generator** | ✅ Done | Generates domain variations and queries registry data via python-whois.
- **Extra WHOIS Metadata Parsing** | ✅ Done | Extracts registration age, registrar dates, name servers, registrant organization/country, and contact email.
- **AI Domain Triage & Similarity Scorer** | ✅ Done | Uses Gemini 2.5 Flash to evaluate domain name + WHOIS metadata, determine copycat status, and assign similarity scores.
- **`risk_scorer()`** | ✅ Done | Implemented in `services/persistence.py`.
- **`persist_infringement()`** | ✅ Done | Implemented in `services/persistence.py` (upsert by `case_id+source_url`).
- **`evidence` table migration** | ✅ Done | `20260618000002_evidence.sql` — RLS enabled.
- **`persist_evidence()`** | ✅ Done | Implemented in `services/persistence.py`.
- **Decline case database schema migration & fallback** | ✅ Done | Added migration for `decline_reason` columns on cases/infringements with database update fallback.
- **Integration tests `test_persistence.py`** | ✅ Done | File exists in `apps/api/tests/`.

### Frontend
- **`/cases/$id` route** | ✅ Done | `src/routes/cases.$caseId.tsx` exists.
- **`<CaseDetailView />` integration** | ✅ Done | Connects to dedicated evidence/infringement records rather than check-brand AI output.
- **Loading skeletons** | ✅ Done | Visual loading skeletons for smooth state transitions.
- **"Generate Takedown Notice" / "Escalate" / "Dismiss" buttons** | ✅ Done | Escalate/dismiss status updates to Supabase.
- **Case Detail: `capture_failed` banner + "Retry" button** | ✅ Done | Banner and action to retry failed screenshot captures.
- **Case timeline sidebar** | ✅ Done | Shows progression history of the infringement.
- **Delete Case button (with Supabase sync)** | ✅ Done | Small X hover button on case rows deletes cases and related records from Supabase.
- **Segmented Cases listing blocks** | ✅ Done | Refined Pending Review vs. Triage History route partitioning (complete/resolved items go to history).
- **Light Green "Marked Safe" badges** | ✅ Done | Changes marked safe (safe/dismissed) status styling to green instead of gray.
- **WHOIS metadata grid on Case Details page** | ✅ Done | Displays domain registration dates, organization, country, abuse emails, and name servers.
- **Decline case dialog + button rename** | ✅ Done | Added "Declined" action button with Radix UI textarea dialog to capture decline reason, renamed Safe/Complete button labels.

---

## 6. Inline Takedown Editor & PDF/SMTP Notice Dispatch
*Generating, editing, saving, and sending legal takedown notices.*

### Backend
- **DMCA notice generator backend stub** | ✅ Done | Notice text auto-generation templates.
- **`PUT /api/v1/monitoring/takedowns/{id}` endpoint** | ✅ Done | Update notice text and status (`pending`, `sent`, `acknowledged`) in `takedown_reports` table.
- **`POST /api/v1/notifications/test/email` API endpoint** | ✅ Done | Fully implemented, verified via unit tests and frontend settings panel.
- **`POST /api/v1/monitoring/takedowns/{id}/send-email` endpoint** | ✅ Done | Sends takedown notice text via SMTP, records log, updates status.
- **`notification_deliveries` Supabase migration** | ✅ Done | `20260625000002_notification_deliveries.sql` — RLS enabled.
- **`documents` Supabase migration** | ✅ Done | `20260625000001_documents.sql` — FK to infringements, RLS enabled.
- **`legal-documents` Storage bucket** | ✅ Done | Auto-created by `_ensure_bucket()` in `document_persistence.py`.
- **`persist_document()`** | ✅ Done | `services/document_persistence.py` — uploads bytes, inserts row, returns record.
- **`get_documents_by_infringement()`** | ✅ Done | `services/document_persistence.py` — newest-first query.
- **`test_document_persistence.py` & notifications tests** | ✅ Done | Verification tests covering document persistence and email notifications logs.

### Frontend
- **Make notice preview text editable inline** | ✅ Done | `/monitoring/$caseId/takedown` — allow manual tweaks to notice text before sending.
- **`PUT /api/v1/monitoring/takedowns/{id}` integration** | ✅ Done | Save user edits to notice text to the DB.
- **Notice status update buttons** | ✅ Done | Mark notices as Sent, Acknowledged, or Dismissed.
- **Toast feedback and state syncing** | ✅ Done | Sync UI state and badges when notice statuses change.
- **Notice actions parity: Download PDF & Save** | ✅ Done | Added Download PDF and Save buttons to the monitoring case takedown sidebar actions.
- **`/settings/notifications` route + `<NotificationSettingsPanel />`** | ✅ Done | Form saves to `org_settings` table, SMTP connection test triggers backend.
- **Manual PDF Save to Storage Button** | ✅ Done | "Save" button in takedown editor uploads PDF to legal-documents bucket & logs metadata.
- **Optimize pages for browser print-to-PDF** | ✅ Done | `@media print` CSS clean print styles targeting headers, layout grids, sidebars, and typography.

---

## 7. Billing, Stripe Payments & Entitlements — ❌ REMOVED (book-a-demo pivot, 2026-07-27)
*The entire Stripe billing / plan-limits / entitlements subsystem was removed when the
business model changed to book-a-demo (no self-serve payments). Every logged-in user now has
unlimited access; new customers are provisioned manually by staff via the admin portal.*

Removed in the pivot: `routes/billing.py`, `services/entitlements.py`, `services/billing_config.py`,
`scripts/seed_stripe.py`, `test_billing.py`, `test_entitlements.py`, admin `billing_admin.py`,
customer `src/lib/{billing,entitlements,stripe}.ts`, `ClientBillingCard.tsx`, and all
`/checkout` `/plans` `/billing/*` routes. The `stripe` dependency and `STRIPE_*` env vars are gone.
The unused `subscriptions` / `subscription_addons` / `invoices` / `org_entitlement_overrides` /
`stripe_events` DB tables + `org_settings.stripe_customer_id` were dropped by forward migration
`20260728000001_drop_billing_tables.sql` (✅ applied to prod 2026-07-28, verified). `profiles.plan`
+ its protection trigger are intentionally kept (trigger also guards `is_admin`; the column is
still returned by `GET /me`).

---

## 8. Law Firm & Multi-Client Mode
*Multi-tenant scoping for law firms to manage separate client portfolios under a single organization account.*

### Backend
- **`clients` database migration** | ✅ Done | Table + `client_id` FK on cases/infringements.
- **Client CRUD endpoints (`routes/clients.py`)** | ✅ Done | Client creation and management.
- **`GET /api/v1/clients/{id}/billing` endpoint** | ✅ Done | Usage metrics per client.
- **Per-client RLS policies** | ✅ Done | Database-level client isolation.
- **Independent Mode Isolation** | ✅ Done | Brands/cases saved in Brand Owner mode (`client_id` is NULL) must not be accessible or shown under Law Firm mode configurations (`client_id` is NOT NULL).
- **Law Firm branding custom templates** | ✅ Done | Customizes notifications and downloaded PDFs using firm logo/name metadata.

### Frontend
- **Persona toggle** | ✅ Done | Persistent persona configuration saved to `org_settings` on Supabase.
- **`/settings/clients` route + `<ClientManagementTable />`** | ✅ Done | CRUD table with Zustand local fallbacks.
- **`<ClientBillingCard />` with CSV export** | ✅ Done | Dashboard metrics panel with dynamic client data CSV exporter.

---

## 9. Geo-Targeted Scans & Proxy Location Management
*Localized scanning utilizing macro-region & country filters via SerpApi, Firecrawl location routing, and country-specific marketplace domains.*

### Backend
- **Database locations on cases/brands** | ✅ Done | Added `target_regions` array to brands/cases and `detection_region` column.
- **Case Creation regional splitting** | ✅ Done | Split scanning loop in `/check-brand` to execute parallel scans for each target region.
- **API Integration: multi-region parameter mapping** | ✅ Done | Mapped target countries to SerpApi query params, Firecrawl headers, and local marketplace domains in `geo.py`.
- **Parallel Scraper Execution** | ✅ Done | Concurrent executions via `asyncio.gather` over country/platform configs.
- **Scraper adjustments** | ✅ Done | Mapped regional parameters for Google Search & Ads, localized marketplace scraper domains (Amazon, eBay, etc.), routed country codes for Meta Ads, and mapped Firecrawl locations for Instagram and TikTok.

### Frontend
- **store.ts targetRegions state** | ✅ Done | Added `targetRegions` (ISO country codes list) to Mark state.
- **Add/Edit Mark Modal** | ✅ Done | Hybrid region and country selector with collapsible country lists.
- **UI Tooltips** | ✅ Done | Detailed explanations of geo-proxy scanning next to configuration sections.
- **Monitored Assets table display** | ✅ Done | Visual representation of active target regions with country flags and badges.
- **Separate Cases filtering** | ✅ Done | Split and filter dashboard statistics/lists by macro-regions.
- **Infringement details detection location** | ✅ Done | Shows detection proxy info and country flag in case detail panel.

---

## 10. Organization & User Group Management (Multi-Member Dashboards)
*Implementing multi-user support to group registered accounts under organizations, allowing teams to share dashboards and manage brands collaboratively.*

### Backend
- **User Organization & Groups Schema Migration** | ✅ Done | `organizations` + `organization_members` (roles owner/admin/member) migration `20260720000014`; safe backfill preserving the billing anchor (org.id = user id for single-member); `handle_new_user` creates org + owner membership on signup.
- **Organization-Scoped API Routing** | ⚠️ Partial | Entitlements/billing anchor on `organization_id` (unchanged). Member management exposed via **admin portal** (`/organizations/{id}/members`). Customer-app org-scoped middleware not reworked.
- **Admin: Create company + owner login** | ✅ Done | `POST /organizations` (admin-api, perm `customers.create`) creates the owner auth user (trigger builds org+profile+owner-membership), brands the org (name/industry), sets persona/notification_email via `org_settings`, audit-logged. UI: "New company" dialog on Companies page + "Create user" dialog inside a company (session 18, 2026-07-28). Verified E2E against live DB with cleanup.
- **Member Invitation API & SMTP Invites** | ❌ Missing | (Fazė F) Customer-side invite endpoints + activation tokens + SMTP. Staff can add members from admin today.

### Frontend
- **Organization Switcher & Settings Panel** | ❌ Missing | (Fazė F) Customer-app tenant switcher + org settings.
- **Member Invite & Access Control UI** | ⚠️ Partial | Members list + roles + add/remove live in the **admin portal** (OrganizationDetail). "Add existing" now uses a debounced user search-select (`GET /search`, staff excluded, current members filtered out) instead of a raw UUID paste (session 19). Customer-facing invite modal not built (Fazė F).
- **Zustand Store Organization Scoping** | ❌ Missing | Scope customer-app state by current organization ID (Fazė F).

---

## 11. Scraper Health Monitoring & E2E Validation
*Establishing validation protocols, automated alerts, and health metrics across all target scraping channels.*

### Backend
- **Manual Scraper Audit & Verification** | ❌ Missing | Conduct a manual check for each of the 12 target platforms (Amazon, eBay, etc.) via local tests or checking routes to confirm current parsing structures are fully functional. *(Manual QA task — not code.)*
- **Automated Integration Test Suite** | ⚠️ Partial | Daily **lightweight reachability probe** per platform (`scraper_health.run_reachability_probes`, daemon thread in `main.py`) records a `source='probe'` health row. Cheap HTTP GETs only — does NOT yet validate parser selectors against a controlled test listing.
- **Scraper Health Metrics API & Alerting (Supabase)** | ⚠️ Partial | Per-platform health logged to Supabase `scraper_health_log` (migration `20260721000001`; ⚠️ needs `supabase db push`). Written from `marketplace.batch_detect` via `scraper_health.probe(...)` with error categories (timeout/blocked/parse_error/api_error/http_error). **Push alerting (Slack/SMTP) deferred** — degraded platforms flagged in-page only.
- **Centralized Diagnostic Dashboard** | ✅ Done | Admin `GET /scraper-health` + `ScraperHealth.tsx` page: real-time per-platform success rate, latency, recent failures, and Firecrawl credit consumption (from `api_usage_records`); 24h/7d window; gated by `scraper_health.view`. Per-platform drill-down included: `brand_name`/`caller_id` columns added to `scraper_health_log` (migration `20260721000002`); `GET /scraper-health/{platform}/events` endpoint returns individual scrape events (brand scanned, country, success/failure, error detail, latency, source, timestamp); `ScraperHealthDetail.tsx` page with window/status/source filters; platform names in list are clickable links.

---

## 12. Startup Production Hosting (Hetzner CCX13 Deployment)
*Transitioning from local/development setups to a highly secure, high-performance, cost-effective dedicated server hosting architecture on Hetzner.*

### Infrastructure — LIVE on Hetzner CCX13 (116.202.8.87) as of 2026-07-27
- **Hetzner CCX13 Instance Provisioning** | ✅ Done | Ubuntu 24.04 provisioned + hardened: `deploy` user, SSH keys-only (root+password login off), ufw (22/80/443), fail2ban, unattended-upgrades, 4G swap, Docker 29.6 + Compose v5.3.
- **Dockerized Container Architecture** | ✅ Done | 4 images built + running via `docker-compose.yml` (api, admin-api, frontend/workerd, admin/nginx) + Caddy; env_file loads root `.env`; json-file log rotation (10m×3) on all services.
- **Caddy Reverse Proxy & SSL Auto-Renewal** | ✅ Done | Caddy obtained Let's Encrypt certs for all 5 hostnames (hakkiu.com, www, api, admin, admin-api); www→apex 301; auto-renew via `caddy_data` volume. External HTTPS verified (apex 200, both `/health` 200, admin SPA 200).
- **CI/CD Deployment Pipelines** | ✅ Done | `ci.yml` + `deploy.yml` (SSH auto-deploy after green CI) live. The four `SSH_*` Actions secrets were added 2026-07-28; every green push to `main` now auto-deploys to Hetzner (verified: all runs since succeed, all 4 domains 200). Manual `git pull && docker compose up -d --build` remains as a fallback.
- **Automated DB & Storage Backups** | ⚠️ Partial | `scripts/backup.sh` ready on server. Pending: install `postgresql-client`, set `DATABASE_URL`, add nightly cron.

---

## 13. SEO, Web Analytics & Conversion Tracking
*Integrating analytics tools to measure acquisition, trace user funnels, and optimize pages for organic search visibility.*

### Frontend
- **Google Analytics 4 (GA4) Integration** | ✅ Done | (session 17) gtag.js for GA4 property `G-PH8369N5PD` in `RootShell` `<head>` (SSR + hydrated site-wide); CSP updated in `Caddyfile` + `public/_headers` to allow googletagmanager + GA collect endpoints.
- **SEO Optimization & Sitemap Generation** | ✅ Done | (session 17) `public/robots.txt` (allow public pages, disallow app/auth, explicit AI-crawler rules), `public/sitemap.xml` (`/landing` + `/request-demo`), `public/llms.txt` product summary. All copied into `dist/client/` on build.
- **Google Search Console (GSC) Verification** | ❌ Missing | Complete DNS-level site verification to monitor Google Search indexing, organic keyword queries, search impressions, and click-through rates.
- **Conversion Tracking & Funnel Auditing** | ❌ Missing | Wire custom GA4 events to track lead conversions (e.g., demo requested, lead submitted).
- **Legal & company footer pages** | ⚠️ Built, pending fill-in (session 21) | 10 pages: `/about`, `/contact`, `/legal/{privacy,terms,cookies,acceptable-use,dpa,subprocessors,security,imprint}`. GDPR Art 13+14 privacy, Art 28 DPA, cookie table, EU imprint. New `footer.tsx` (all legal links + LinkedIn icon → linkedin.com/company/hakkiu), shared `LegalLayout`, `src/lib/company.ts` single-source constants; added to sitemap.xml + robots.txt. **Remaining:** fill real company facts in `company.ts` (entity/reg-code/address/VAT), create `privacy@`/`legal@`/`security@`/`support@` aliases, lawyer review.
- **Cookie consent banner (GA4)** | ❌ Missing (compliance gap) | GA4 fires without prior consent; EU ePrivacy requires a CMP/banner with Google Consent Mode v2 (default denied) blocking analytics until opt-in. Cookie Policy page written; banner not yet built.

---

## 14. Admin Operations Portal (Subdomain Separation) — ✅ LARGELY DONE
*Separated internal operations into a dedicated subdomain admin portal (`apps/admin` SPA + `apps/admin-api` FastAPI). Staff auth is isolated via a `staff_accounts` table (same Supabase, separate from customer `auth.users` by row). Full customer control, all changes hit the same tables the customer app reads.*

### Infrastructure & Backend
- **Admin subdomain + separate app** | ✅ Done | `apps/admin` (Vite SPA) → own Cloudflare Worker at `admin.tracemark.ai` (`wrangler.jsonc`); `apps/admin-api` FastAPI (own CORS/auth). Coupled ops (resource/usage metrics, billing entitlements, Meta token, SMTP sends) go through main-API `/internal/*` gated by `INTERNAL_API_SECRET`.
- **Staff auth + granular RBAC** | ✅ Done | `staff_accounts` + `staff_permissions` + `admin_audit_log` migrations. `get_current_staff` + `require_permission()`; roles dev/sales/marketing/admin as presets + per-staff overrides. Multiple super-admins supported (with last-super-admin lockout protection). Permission catalog in `permissions.py`.
- **Admin API endpoints** | ✅ Done | staff, customers, organizations (+members/usage), brands, billing (plan/cancel), cases/infringements/evidence/decisions (incl. AI override), takedowns/documents (+send-email), resources, audit, global search.
- **Admin removed from customer app (Fazė 6)** | ✅ Done | Deleted customer `users`/`api-usage`/`resources` pages + main-API `admin`/`admin_resources`/`usage` routes + `is_admin→enterprise` overrides; resource sampler auto-starts in main API.

### Frontend
- **Isolated Admin Dashboard** | ✅ Done | Companies, Cases, Users, Staff, Monitoring (API + resources), Audit; deep drill-down (company → members/usage/billing/brands/cases; case → screenshots/AI/infringements/takedowns/documents) with inline editing; global search (⌘K); confirm dialogs.
- **MFA & Enterprise SSO Security** | ❌ Missing | Enforce MFA + domain-restricted access for admin logins (future hardening).
- **Self-serve org invitations (customer side)** | ❌ Missing | Roadmap §10 "Fazė F" — customers inviting their own teammates / org switcher (staff already manage members from admin).

---

## 15. Multi-Model AI Routing Engine
*Designing an AI provider abstraction layer to support multiple LLM/VLM backends (including OpenAI, Anthropic, and leading cost-efficient models) for Tier 2 evaluation and visual classification.*

### Backend
- **Unified LLM/VLM Interface Layer** | ❌ Missing | Implement an abstraction layer (using LiteLLM, LangChain, or custom connectors) allowing the pipeline to toggle between AI providers.
- **Advanced Model Evaluator** | ❌ Missing | Evaluate and benchmark visual models for visual copycat inspection, comparing OpenAI GPT-4o, Anthropic Claude 3.5 Sonnet, Gemini 1.5 Pro, and leading Chinese models (such as DeepSeek-VL or Qwen-VL) to achieve optimal price-to-performance.
- **Resilient AI Failover Logic** | ❌ Missing | Integrate auto-retry and failover mechanisms (e.g., if Gemini rate-limits, route visual verification tasks to Claude or DeepSeek transparently).

---

## 16. UI Case/Alert Decoupling & MVP Preparation
*Refining frontend views to present copycats as individual, actionable cases to maximize user engagement and streamline enforcement workflows.*

### Frontend
- **Decouple Scan Results into Individual UI Cases** | ✅ Done | `/cases` list now shows one case per copycat (from `GET /infringements`), with per-item platform/URL/risk/status/confidence, per-row delete, and rows linking to the per-copycat detail `/cases/$id`. Dashboard KPIs + 30-day success-rate trend count copycats instead of scans; the live alert feed links to per-copycat details. Backend scan stays a single case + single AI prompt. Supporting changes: `GET/PATCH /infringements` return the item's own status (`case_status` separate, no cascade to parent case), expose `brand_name`/`client_id`/`updated_at`; migration `20260725000001` adds `infringements.updated_at` + trigger. Admin parity already existed (admin case detail lists infringements; `infringements_admin.py` PATCH with audit log).
- **Patrick's Frontend Review Items** | ❌ Missing | Implement UI cleanups and adjustments as advised by Patrick.

### Backend
- **Patrick's Backend Review Items** | ❌ Missing | Perform backend refactoring, route cleaning, and test cases stabilization based on feedback from Patrick.

---

## 17. Transactional Email Integration (Resend) — ⚠️ LARGELY DONE
*Transactional + lifecycle emails via Resend (resend.com), chosen over Amazon SES for simpler
setup + Python SDK + Supabase Auth SMTP relay support.*

### Backend & Infrastructure
- **Template Delivery Engine** | ✅ Done | `services/email.py` Resend wrapper + `email_templates.py` HTML templates (infringement alert, domain lookalike, takedown submitted/removed/failed, welcome, first-detection, new-lead, weekly digest, dunning day-0, test). Wired into existing hooks in `routes/monitoring.py`, `routes/documents.py`, `services/persistence.py`, `routes/brands.py`, `routes/leads.py`.
- **Weekly digest + onboarding** | ✅ Done | `services/weekly_digest.py` daemon thread (Tuesdays 09:00 UTC); welcome on first brand; first-detection "aha" email. Deferred: 48h/day-14 nudges, day-3/day-7 dunning follow-ups, admin `/email-logs` page.
- **Domain & Sender Verification** | ❌ Missing (USER ACTION) | Verify `hakkiu.com` in Resend (SPF/DKIM DNS), replace the `RESEND_API_KEY` placeholder in `.env` with the real key.
- **Supabase Auth Custom SMTP Integration** | ❌ Missing (USER ACTION) | Point Supabase Auth SMTP at the Resend relay (host `smtp.resend.com`, port 465, user `resend`, pass = API key) for sign-up/reset tokens. (Admin password reset already bypasses this — it sends via the app's own Resend pipeline.)

---

## 18. Advanced Logo & Image Similarity Features
*Visual copycat detection using logo cropping, CLIP embeddings, and Gemini Vision verification.*

### Backend
- **Scraping Module (`scraper.py`)** | ⚠️ Partial | Extracting logo pHash from HTML image tags; falls back to whole-screenshot pHash.
- **CLIP Embedding & Similarity (`embedder.py`)** | ❌ Missing | *TODO*: Upgrade from pHash to CLIP embeddings for robust visual matches. Consider evaluating leading visual transformers (such as DeepSeek-VL or Qwen-VL models) alongside OpenAI/Gemini to optimize price-to-performance for visual detection.
- **Filtering Logic** | ⚠️ Partial | pHash-based filtering with Hamming distance thresholds in `detection_funnel.py`.
- **Gemini Visual Verification (`gemini_check.py`)** | ❌ Missing | *TODO*: Wire `generate_evidence_analysis` into Tier 2 for Gemini Vision adjudication. Document that this runs on-demand (1 request per screenshot for each found copycat to perform detailed OCR, logo, and counterfeit verification), preceded by Tier 0 and Tier 1 filters to discard non-matches before spending Gemini Vision API budget.
- **End-to-End Orchestrator (`pipeline.py`)** | ✅ Done | Integrated logo extraction -> pHash comparison -> classification in tiered funnel.
- **CV-based logo cropping** | ❌ Missing | *TODO*: Implement Gemini-based or OpenCV/YOLO-based logo region cropping from screenshots.
