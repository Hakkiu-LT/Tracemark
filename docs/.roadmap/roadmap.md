# Unified Feature Roadmap

This document unifies the frontend and backend roadmap tasks, organized by **Feature Areas**.

> **Legend**: ✅ Done · ⚠️ Partial · ❌ Missing

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
- **Sign-up page (`/auth/sign-up`)** | ✅ Done | `auth.sign-up.tsx`.
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

## 7. Billing, Stripe Payments & Entitlements
*Real Stripe subscription payments, plan-based limits, and entitlement checks.*

### Backend
- **`POST /api/v1/billing/create-subscription`** | ✅ Done | Creates customer + incomplete subscription, returns PaymentIntent client_secret.
- **`POST /api/v1/billing/update-subscription`** | ✅ Done | Change plan/interval or reconcile add-on quantities with prorations.
- **`POST /api/v1/billing/cancel-subscription`** | ✅ Done | Cancel at period end / resume.
- **`GET /api/v1/billing/subscription` · `GET /api/v1/billing/invoices`** | ✅ Done | Read current subscription + add-ons and synced invoice history.
- **`POST /api/v1/billing/create-portal-session`** | ✅ Done | Stripe billing portal redirect session.
- **`POST /api/v1/billing/webhook`** | ✅ Done | Verifies signature; syncs subscriptions, addons, invoices, and mirrors `profiles.plan`.
- **`POST /api/v1/billing/charge-managed-takedown`** | ✅ Done | One-off $500 invoice item per successful managed takedown.
- **Webhook idempotency** | ✅ Done | `stripe_events` ledger dedupes by event ID.
- **Stripe error handling** | ✅ Done | `_do_stripe` maps `CardError`→402, `StripeError`→502.
- **Stripe Price seeding helper** | ✅ Done | `seed_stripe.py` script.
- **Plan entitlements service** | ✅ Done | `services/entitlements.py` — computes effective limits.
- **`get_current_profile` dependency** | ✅ Done | Resolves org, plan, and entitlements for endpoint limit enforcement.
- **Brands persisted server-side** | ✅ Done | CRUD `routes/brands.py` + `POST /brands` limit checks (402 + upsell).
- **Scan limit enforcement** | ✅ Done | Gated platforms, regions, domains, and locked brands on check-brand.
- **Downgrade/upgrade reconciliation** | ✅ Done | Locks excess brands on downgrade, unlocks on upgrade.
- **Unit tests `test_billing.py` & `test_entitlements.py`** | ✅ Done | 26/26 checks passing.

### Frontend
- **`/settings/billing` page** | ✅ Done | Displays plan+interval, next invoice, add-on management, Stripe portal, invoice history with PDFs.
- **`/billing/success` + `/billing/cancel` pages** | ✅ Done | Success page polls billing endpoint until active.
- **Shared plan/add-on metadata** | ✅ Done | `src/lib/billing.ts` — single authority for pricing tiers, intervals, and add-ons.
- **Stripe.js loader** | ✅ Done | `src/lib/stripe.ts` using publishable key.
- **Billing API fetchers** | ✅ Done | `src/lib/api.ts` wired for Stripe integrations.
- **`/plans` tier switcher** | ✅ Done | Real tiers + monthly/yearly toggle + enterprise contact.
- **`/checkout` (Stripe Elements)** | ✅ Done | `<PaymentElement>` subscription checkout and plan changes with add-on picker.
- **Managed-takedown "bill" action** | ✅ Done | "Let us handle it — $500" action button in takedown flow for Pro/Agency tiers.

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

## 10. Scraper Health Monitoring & E2E Validation
*Establishing validation protocols, automated alerts, and health metrics across all target scraping channels.*

### Backend
- **Manual Scraper Audit & Verification** | ❌ Missing | Conduct a manual check for each of the 12 target platforms (Amazon, eBay, etc.) via local tests or checking routes to confirm current parsing structures are fully functional.
- **Automated Integration Test Suite** | ❌ Missing | Implement daily automated cron checks that query a controlled test listing/url on each of the 12 platforms (Amazon, eBay, etc.) to verify parser selectors have not broken due to layout changes.
- **Scraper Health Metrics API & Alerting (Supabase)** | ❌ Missing | Log scraping failure reasons (e.g., bot detection, network timeout, layout mismatch) directly to **Supabase** database tables and trigger notifications (Slack/Discord/SMTP) if success rates drop on any platform.
- **Centralized Diagnostic Dashboard** | ❌ Missing | Admin view showcasing real-time success rate, scraping latency, and Firecrawl API credit consumption per platform.

---

## 11. Startup Production Hosting (Hetzner CCX13 Deployment)
*Transitioning from local/development setups to a highly secure, high-performance, cost-effective dedicated server hosting architecture on Hetzner.*

### Infrastructure
- **Hetzner CCX13 Instance Provisioning** | ❌ Missing | Deploy and configure a dedicated vCPU cloud instance (CCX13: 2 dedicated vCPUs, 8 GB RAM) running Ubuntu Server.
- **Dockerized Container Architecture** | ❌ Missing | Package backend (FastAPI/Uvicorn), frontend (Vite/Nginx static build), and auxiliary services into Docker images managed by a production-ready `docker-compose.yml`.
- **Caddy/Nginx Reverse Proxy & SSL Auto-Renewal** | ❌ Missing | Configure Caddy or Nginx with automated Let's Encrypt SSL/TLS certificates and security header hardening.
- **CI/CD Deployment Pipelines** | ❌ Missing | Establish GitHub Actions workflow to run lint, test, build Docker images, push to registry, and trigger a zero-downtime rolling update on the CCX13 instance.
- **Automated DB & Storage Backups** | ❌ Missing | Schedule periodic database and storage bucket snapshots stored offsite on Hetzner Storage Boxes.

---

## 12. SEO, Web Analytics & Conversion Tracking
*Integrating analytics tools to measure acquisition, trace user funnels, and optimize pages for organic search visibility.*

### Frontend
- **Google Analytics 4 (GA4) Integration** | ❌ Missing | Embed tag management scripts on landing, pricing, and checkout routes to monitor user navigation flows, session events, and churn rates.
- **Google Search Console (GSC) Verification** | ❌ Missing | Complete DNS-level site verification to monitor Google Search indexing, organic keyword queries, search impressions, and click-through rates.
- **Conversion Tracking & Funnel Auditing** | ❌ Missing | Wire custom GA4 events to track user conversions (e.g., selecting pricing tiers, completing checkout, or upgrading subscription add-ons).
- **SEO Optimization & Sitemap Generation** | ❌ Missing | Configure sitemap generators (`sitemap.xml`) and `robots.txt` to maximize search indexation of marketing pages.

---

## 13. Admin Operations Portal (Subdomain Separation)
*Separating internal operations and administrative controls into a dedicated subdomain to isolate code complexity and protect system data.*

### Infrastructure & Backend
- **Admin Subdomain DNS & Router Mapping** | ❌ Missing | Route `admin.tracemark.ai` (or similar subdomains) to serve the administrative dashboard.
- **Administrative API Endpoint Guarding** | ❌ Missing | Move and restrict administrative API actions (fetching usage stats, altering user plans, manually overriding client limits) under strict administrative JWT scopes.

### Frontend
- **Isolated Admin Dashboard** | ❌ Missing | Build a standalone internal panel for Tracemark staff to manage clients, toggle user subscription states, configure API rate limits, audit system logs, and inspect background jobs.
- **MFA & Enterprise SSO Security** | ❌ Missing | Enforce Multi-Factor Authentication (MFA) and domain-restricted access for all administrative log-ins to prevent unauthorized system takeovers.

---

## 14. Multi-Model AI Routing Engine
*Designing an AI provider abstraction layer to support multiple LLM/VLM backends (including OpenAI, Anthropic, and leading cost-efficient models) for Tier 2 evaluation and visual classification.*

### Backend
- **Unified LLM/VLM Interface Layer** | ❌ Missing | Implement an abstraction layer (using LiteLLM, LangChain, or custom connectors) allowing the pipeline to toggle between AI providers.
- **Advanced Model Evaluator** | ❌ Missing | Evaluate and benchmark visual models for visual copycat inspection, comparing OpenAI GPT-4o, Anthropic Claude 3.5 Sonnet, Gemini 1.5 Pro, and leading Chinese models (such as DeepSeek-VL or Qwen-VL) to achieve optimal price-to-performance.
- **Resilient AI Failover Logic** | ❌ Missing | Integrate auto-retry and failover mechanisms (e.g., if Gemini rate-limits, route visual verification tasks to Claude or DeepSeek transparently).

---

## 15. UI Case/Alert Decoupling & MVP Preparation
*Refining frontend views to present copycats as individual, actionable cases to maximize user engagement and streamline enforcement workflows.*

### Frontend
- **Decouple Scan Results into Individual UI Cases** | ❌ Missing | Adapt the dashboard feed and details pages so that each detected copycat (drawn from the `infringements` table) is displayed as an independent, individual "case/alert." This will increase user alert density and allow the user to execute direct actions (takedown, escalation, whitelist, dismiss) on a per-copycat basis, while maintaining a single, cost-efficient scan execution on the backend.
- **Patrick's Frontend Review Items** | ❌ Missing | Implement UI cleanups and adjustments as advised by Patrick.

### Backend
- **Patrick's Backend Review Items** | ❌ Missing | Perform backend refactoring, route cleaning, and test cases stabilization based on feedback from Patrick.

---

## 16. Amazon SES Email Integration
*Setting up enterprise-grade transactional and authentication emails using Amazon Simple Email Service (SES).*

### Backend & Infrastructure
- **SES Domain & Sender Verification** | ❌ Missing | Configure AWS SES, verify domain DNS records (TXT, MX), and configure SPF, DKIM, and DMARC credentials to maximize email deliverability and avoid spam classification.
- **Supabase Auth Custom SMTP Integration** | ❌ Missing | Map Supabase Auth configuration to utilize verified AWS SES SMTP endpoints to send sign-up, sign-in OTP, and password reset tokens.
- **Noreply & Support Sender Routing** | ❌ Missing | Configure clean, branded custom email addresses (e.g., `noreply@tracemark.ai` for transactional alerts/verification and `support@tracemark.ai` for ticketing/replies).
- **Template Delivery Engine** | ❌ Missing | Integrate HTML templates for transactional emails (infringement alerts, takedown confirmations, weekly client reports) with clean corporate styles.

---

## 17. Advanced Logo & Image Similarity Features
*Visual copycat detection using logo cropping, CLIP embeddings, and Gemini Vision verification.*

### Backend
- **Scraping Module (`scraper.py`)** | ⚠️ Partial | Extracting logo pHash from HTML image tags; falls back to whole-screenshot pHash.
- **CLIP Embedding & Similarity (`embedder.py`)** | ❌ Missing | *TODO*: Upgrade from pHash to CLIP embeddings for robust visual matches. Consider evaluating leading visual transformers (such as DeepSeek-VL or Qwen-VL models) alongside OpenAI/Gemini to optimize price-to-performance for visual detection.
- **Filtering Logic** | ⚠️ Partial | pHash-based filtering with Hamming distance thresholds in `detection_funnel.py`.
- **Gemini Visual Verification (`gemini_check.py`)** | ❌ Missing | *TODO*: Wire `generate_evidence_analysis` into Tier 2 for Gemini Vision adjudication. Document that this runs on-demand (1 request per screenshot for each found copycat to perform detailed OCR, logo, and counterfeit verification), preceded by Tier 0 and Tier 1 filters to discard non-matches before spending Gemini Vision API budget.
- **End-to-End Orchestrator (`pipeline.py`)** | ✅ Done | Integrated logo extraction -> pHash comparison -> classification in tiered funnel.
- **CV-based logo cropping** | ❌ Missing | *TODO*: Implement Gemini-based or OpenCV/YOLO-based logo region cropping from screenshots.
