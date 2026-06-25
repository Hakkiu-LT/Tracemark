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

---

## 5. Inline Takedown Editor (Done)
*The editing UI and database integrations to customize generated takedown notices.*

| Task | Status | Notes |
|---|---|---|
| Make notice preview text editable inline on `/monitoring/$caseId/takedown` | ✅ Done | Allow manual tweaks to notice text before sending |
| `PUT /api/v1/monitoring/takedowns/{id}` integration | ✅ Done | Save user edits to notice text to the DB |
| Notice status update buttons | ✅ Done | Mark notices as Sent, Acknowledged, or Dismissed |
| Toast feedback and state syncing | ✅ Done | Sync UI state and badges when notice statuses change |

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
| `/settings/billing` page | ✅ Done | Implemented Settings tab, billing subroute and dashboard controls |
| `/billing/success` + `/billing/cancel` pages | ✅ Done | Dynamic checkout forms and status landing updates |
| Restrict API Usage tab/route visibility to allowed admin emails | ✅ Done | Sidebar hidden + api-usage.tsx route permission check enforced |
| Global error boundary | ✅ Done | `ErrorComponent` in `__root.tsx` |
| Toast notifications on actions | ✅ Done | Brand scan completion & retry capture promise notifications wired |

---

## 8. Law Firm Mode & Print/E2E Polish
*Expands the platform to support Law Firms managing multiple clients, PDF exports, and final validation.*

| Task | Status | Notes |
|---|---|---|
| Persona toggle persisted to `org_settings` in Supabase | ❌ Missing | Persona toggle works but is stored in local Zustand store only |
| `/settings/clients` route + `<ClientManagementTable />` | ⚠️ Partial | Route exists but needs integration with the backend `clients` table |
| `<ClientBillingCard />` with CSV export | ❌ Missing | Dashboard component for client metrics export |
| Optimize case/takedown pages for browser print-to-PDF (`@media print` CSS) | ❌ Missing | Clean CSS print styles for report generation |
| End-to-end QA + `docs/phase2-demo.md` / `docs/phase3-demo.md` | ❌ Missing | Complete verification and demo walkthrough documentation |

---

## 9. Geo-Targeted Scans & Proxy Location Management
*Interactive controls to set and monitor regional scans per brand.*

| Task | Status | Notes |
|---|---|---|
| store.ts: add `targetRegions` to Mark state | ❌ Missing | Update client-side state model to persist selected scan locations |
| Add/Edit Mark Modal: multi-select region dropdown | ❌ Missing | Add checkboxes or multi-select dropdown for target regions (e.g., US, Europe, Asia) |
| UI Tooltips: explain geo-proxy scanning logic | ❌ Missing | Explain to users how selecting regions routes scans through local country proxies |
| Monitored Assets table: display active target regions | ❌ Missing | Display country/region flags or badges for active locations on each brand row |
| Infringement details: show detection location | ❌ Missing | Display which specific region/proxy location captured each piece of evidence |
