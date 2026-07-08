# Frontend Tasks Roadmap

This document outlines the priority ordering for frontend routes, components, and integrations across all development phases (Phase 1, Phase 2, and Phase 3).

> Legend: ✅ Done · ⚠️ Partial · ❌ Missing

---

## 1. Phase 1: MVP Foundations (Done)
*Sets up the initial dashboard view, brand check forms, and MVP pipeline wiring.*

| Task | Status | Notes |
|---|---|---|
| Brand search and check form | ✅ Done | Interactive user form to search brands and trigger monitoring pipelines |
| Dashboard overview layout | ✅ Done | Skeleton layout listing check logs and basic alert summaries |
| Mock response integration | ✅ Done | Wired form to mock check-brand API for local frontend design |
| Real endpoint wiring | ✅ Done | Connected brand check button to live backend `/monitoring/check-brand` |
| Verification of results display | ✅ Done | Shows dynamic card outputs of detected listings and WHOIS typos |
| Case details UI polish | ✅ Done | Basic timeline and evidence layout for MVP cases |

---

## 2. Platform Config & UI Registration (Done)
*Integrating target channels inside the local stores and sidebar layout mappings.*

| Task | Status | Notes |
|---|---|---|
| Register basic platforms config | ✅ Done | Uncommented Shopify, eBay, AliExpress, Instagram, and TikTok in `platforms.ts` |
| Add new platform listings config | ✅ Done | Registered Alibaba, Etsy, Facebook Marketplace, and Google Shopping details inside config |
| Type safety unions | ✅ Done | Added `"Alibaba" \| "Etsy" \| "Facebook Marketplace" \| "Google Shopping"` to `Platform` type in `store.ts` |
| Platform dropdown rendering | ✅ Done | Updated standard `ALL_PLATFORMS` selection mapping arrays in monitoring pages |

---

## 3. Phase 2: Dashboard Feed & API Foundations (Done)
*Sets up the landing feed for alerts and the backend endpoints needed to load data.*

| Task | Status | Notes |
|---|---|---|
| `GET /api/v1/infringements` API endpoint | ✅ Done | `routes/infringements.py` — list + single + evidence, 6 tests passing |
| `<InfringementAlertFeed />` React component | ✅ Done | Live alert feed listing database-sourced violations |
| TanStack Query polling every 30s | ✅ Done | Configured auto-polling hook in query |
| Filter bar (Risk Level, Platform, Status, Date Range) | ✅ Done | Implemented search & filters for risk, platform, status, and date |
| Protected route guard (`<RequireAuth />`) | ✅ Done | Implemented in `__root.tsx` via `RequireAuth` |
| Sign-in page (`/auth/sign-in`) | ✅ Done | `auth.sign-in.tsx` |
| Sign-up page (`/auth/sign-up`) | ✅ Done | `auth.sign-up.tsx` |
| Auth callback route (`/auth/callback`) | ✅ Done | `auth.callback.tsx` |
| User menu with avatar + sign-out | ✅ Done | `src/components/user-menu.tsx` |

---

## 4. Case Details & Evidence View (Done)
*Allows navigating from the feed into a specific case to view captured screenshots, metadata, and AI analyses.*

| Task | Status | Notes |
|---|---|---|
| `/cases/$id` route | ✅ Done | `src/routes/cases.$caseId.tsx` exists |
| `GET /api/v1/infringements/{id}` API endpoint | ✅ Done | `routes/infringements.py` — 404 on missing |
| `GET /api/v1/infringements/{id}/evidence` API endpoint | ✅ Done | `routes/infringements.py` — newest-first |
| `<CaseDetailView />` integration | ✅ Done | Connect to the new dedicated evidence/infringement records rather than check-brand AI output |
| Loading skeletons | ✅ Done | Visual loading skeletons for smooth state transitions |
| "Generate Takedown Notice" / "Escalate" / "Dismiss" buttons | ✅ Done | Escalate/dismiss status updates to Supabase are missing |
| Case Detail: `capture_failed` banner + "Retry" button | ✅ Done | Banner and action to retry failed screenshot captures |
| Case timeline sidebar | ✅ Done | Shows progression history of the infringement |
| Delete Case button (with Supabase sync) | ✅ Done | Small X hover button on case rows deletes cases and related records from Supabase |
| Segmented Cases listing blocks | ✅ Done | Splits pending cases into a Pending Review card above, and triage history below |
| Light Green "Marked Safe" badges | ✅ Done | Changes marked safe (safe/dismissed) status styling to green instead of gray |
| WHOIS metadata grid on Case Details page | ✅ Done | Displays domain registration dates, organization, country, abuse emails, and name servers |

---

## 5. Inline Takedown Editor (Done)
*The editing UI and database integrations to customize generated takedown notices.*

| Task | Status | Notes |
|---|---|---|
| Make notice preview text editable inline on `/monitoring/$caseId/takedown` | ✅ Done | Allow manual tweaks to notice text before sending |
| `PUT /api/v1/monitoring/takedowns/{id}` integration | ✅ Done | Save user edits to notice text to the DB |
| Notice status update buttons | ✅ Done | Mark notices as Sent, Acknowledged, or Dismissed |
| Toast feedback and state syncing | ✅ Done | Sync UI state and badges when notice statuses change |
| Notice actions parity: Download PDF & Save | ✅ Done | Added Download PDF and Save buttons to the monitoring case takedown sidebar actions |

---

## 6. Notifications & Email Dispatch Panel (Done)
*Configure automated delivery settings and send notifications directly via the UI.*

| Task | Status | Notes |
|---|---|---|
| `/settings/notifications` route + `<NotificationSettingsPanel />` | ✅ Done | Form saves to `org_settings` table, SMTP connection test triggers backend |
| `<NotificationDeliveryLog />` component | ✅ Done | Fetches last 20 audit events from `notification_deliveries` table with styled badges |
| `POST /api/v1/notifications/test/email` API endpoint | ✅ Done | Fully implemented, verified via unit tests and frontend settings panel |
| `POST /api/v1/monitoring/takedowns/{id}/send-email` integration | ✅ Done | Integrated in takedown editor actions; triggers SMTP dispatch and status sync |

---

## 7. Billing, Admin Controls & UI Polish (Done)
*Limits access, integrates checkout/subscription redirects, and polishes the global UI.*

| Task | Status | Notes |
|---|---|---|
| `/settings/billing` page | ✅ Done | Real data: current plan+interval, next-invoice date, add-on management, cancel, Stripe portal, real invoice history w/ PDF links |
| `/billing/success` + `/billing/cancel` pages | ✅ Done | Success page polls `GET /billing/subscription` until `active` (webhook is source of truth; no browser plan writes) |
| Restrict API Usage tab/route visibility to allowed admin emails | ✅ Done | Sidebar hidden + api-usage.tsx route permission check enforced |
| Global error boundary | ✅ Done | `ErrorComponent` in `__root.tsx` |
| Toast notifications on actions | ✅ Done | Brand scan completion & retry capture promise notifications wired |
| Dark Mode UI / Styling | ✅ Done | Modern dark theme styling applied across all views for premium brand protection aesthetic |

---

## 7b. Stripe Billing (Real Payments) — Done
*Replaces the mock checkout with a real Stripe Elements subscription flow. See `docs/BILLING.md`.*

| Task | Status | Notes |
|---|---|---|
| Shared plan/add-on metadata `src/lib/billing.ts` | ✅ Done | 5 tiers (starter/growth/pro/agency/enterprise), monthly+yearly, add-ons; single UI source of truth |
| Stripe.js loader `src/lib/stripe.ts` | ✅ Done | Shared `loadStripe` from `VITE_STRIPE_PUBLISHABLE_KEY` |
| Billing API fetchers in `src/lib/api.ts` | ✅ Done | create/update/cancel/get subscription, invoices, portal, managed-takedown; parses `detail` errors |
| `/plans` — real tiers + monthly/yearly toggle | ✅ Done | Upgrade/Downgrade labels (interval- and enterprise-aware); Enterprise = Contact sales |
| `/checkout` — Stripe Elements | ✅ Done | `<PaymentElement>` + `confirmPayment`; new subscribers pay, existing subscribers do a plan change (update-subscription, card on file); add-on picker + order summary |
| `/settings` billing tab | ✅ Done | Add-on management (prorated), cancel (period end), portal, live invoices; cache invalidation + `refreshProfile` after changes |
| Landing pricing `components/landing/pricing.tsx` | ✅ Done | All 5 tiers, responsive grid |
| Manual + live E2E verification | ✅ Done | 26/26 live E2E checks (create→pay→webhook→update→cancel→invoices→managed takedown) |
| Managed-takedown "bill" button in takedown flow | ✅ Done | `ManagedTakedownAction` on `/monitoring/$caseId/takedown`, Pro/Agency only, idempotent per report id |

---

## 8. Law Firm Mode & Print/E2E Polish
*Expands the platform to support Law Firms managing multiple clients, PDF exports, and final validation.*

| Task | Status | Notes |
|---|---|---|
| Persona toggle persisted to `org_settings` in Supabase | ✅ Done | Persona loaded from and updated to org_settings table on Supabase |
| `/settings/clients` route + `<ClientManagementTable />` | ✅ Done | Hooked clients page and settings subroute to Supabase clients table with robust local Zustand fallbacks |
| `<ClientBillingCard />` with CSV export | ✅ Done | Dashboard component showing aggregated client metrics with dynamic CSV generation & download |
| Optimize case/takedown pages for browser print-to-PDF (`@media print` CSS) | ✅ Done | Clean print styles targeting headers, layout grids, sidebars, and typography |
| Manual PDF Save to Storage Button | ✅ Done | "Save" button in takedown editor uploads PDF to legal-documents bucket & logs metadata |
| End-to-end QA Walkthrough verification | ✅ Done | Tested alert feeds, screenshot retries, SMTP connection test, and client portfolios |

---

## 9. Geo-Targeted Scans & Proxy Location Management
*Interactive controls to set and monitor regional scans per brand using a hybrid macro-region and country-specific selection.*

| Task | Status | Notes |
|---|---|---|
| store.ts: add `targetRegions` (ISO country codes list) to Mark state | ✅ Done | Added `targetRegions` array to `Mark` schema and initialized mock data |
| Add/Edit Mark Modal: hybrid region and country selector | ✅ Done | Added macro-region checkbox selector panels with collapsing country lists in creation and edit dialogs |
| UI Tooltips: explain geo-proxy scanning logic | ✅ Done | Added tooltips next to the proxy locations heading explaining localization proxy routing |
| Monitored Assets table: display active target regions | ✅ Done | Display active locations as country flags and code badges under the website URL |
| Separate Cases per Detection Region | ✅ Done | Grouped and filtered statistics/lists by macro-regions with active filter tabs on Dashboard and Cases list |
| Infringement details: show detection location | ✅ Done | Display detection proxy information with country flag under case details panel |
