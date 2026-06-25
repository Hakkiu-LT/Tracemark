# Frontend Tasks Roadmap

This document outlines the priority ordering for frontend tasks, routes, components, and supporting API endpoints for Phase 2 and Phase 3.

> Legend: ✅ Done · ⚠️ Partial · ❌ Missing

---

## 1. Dashboard Feed & API Foundations (High Priority)
*Sets up the landing feed for alerts and the backend endpoints needed to load data.*

| Task | Status | Notes |
|---|---|---|
| `GET /api/v1/infringements` API endpoint | ✅ Done | `routes/infringements.py` — list + single + evidence, 6 tests passing |
| `<InfringementAlertFeed />` React component | ❌ Missing | Core dashboard alert feed |
| TanStack Query polling every 30s | ❌ Missing | Real-time polling setup on the feed component |
| Filter bar (Risk Level, Platform, Status, Date Range) | ❌ Missing | Filters on the Alert Feed |
| Protected route guard (`<RequireAuth />`) | ✅ Done | Implemented in `__root.tsx` via `RequireAuth` |
| Sign-in page (`/auth/sign-in`) | ✅ Done | `auth.sign-in.tsx` |
| Sign-up page (`/auth/sign-up`) | ✅ Done | `auth.sign-up.tsx` |
| Auth callback route (`/auth/callback`) | ✅ Done | `auth.callback.tsx` |
| User menu with avatar + sign-out | ✅ Done | `src/components/user-menu.tsx` |

---

## 2. Case Details & Evidence View
*Allows navigating from the feed into a specific case to view captured screenshots, metadata, and AI analyses.*

| Task | Status | Notes |
|---|---|---|
| `/cases/$id` route | ✅ Done | `src/routes/cases.$caseId.tsx` exists |
| `GET /api/v1/infringements/{id}` API endpoint | ✅ Done | `routes/infringements.py` — 404 on missing |
| `GET /api/v1/infringements/{id}/evidence` API endpoint | ✅ Done | `routes/infringements.py` — newest-first |
| `<CaseDetailView />` integration | ⚠️ Partial | Connect to the new dedicated evidence/infringement records rather than check-brand AI output |
| Loading skeletons | ❌ Missing | Visual loading skeletons for smooth state transitions |
| "Generate Takedown Notice" / "Escalate" / "Dismiss" buttons | ⚠️ Partial | Escalate/dismiss status updates to Supabase are missing |
| Case Detail: `capture_failed` banner + "Retry" button | ❌ Missing | Banner and action to retry failed screenshot captures |
| Case timeline sidebar | ❌ Missing | Shows progression history of the infringement |

---

## 3. Inline Takedown Editor
*The editing UI and database integrations to customize generated takedown notices.*

| Task | Status | Notes |
|---|---|---|
| Make notice preview text editable inline on `/monitoring/$caseId/takedown` | ❌ Missing | Allow manual tweaks to notice text before sending |
| `PUT /api/v1/monitoring/takedowns/{id}` integration | ❌ Missing | Save user edits to notice text to the DB |
| Notice status update buttons | ⚠️ Partial | Mark notices as Sent, Acknowledged, or Dismissed |
| Toast feedback and state syncing | ⚠️ Partial | Sync UI state and badges when notice statuses change |

---

## 4. Notifications & Email Dispatch Panel
*Configure automated delivery settings and send notifications directly via the UI.*

| Task | Status | Notes |
|---|---|---|
| `/settings/notifications` route + `<NotificationSettingsPanel />` | ❌ Missing | UI panel to configure notification email addresses and preferences |
| `<NotificationDeliveryLog />` component | ❌ Missing | Table showing last 20 notification delivery events with status badges |
| `POST /api/v1/notifications/test/email` API endpoint | ❌ Missing | Backend API supporting test SMTP connections |
| `POST /api/v1/monitoring/takedowns/{id}/send-email` integration | ❌ Missing | Frontend trigger to email the notice directly via backend SMTP |

---

## 5. Billing, Admin Controls & UI Polish
*Limits access, integrates checkout/subscription redirects, and polishes the global UI.*

| Task | Status | Notes |
|---|---|---|
| `/settings/billing` page | ❌ Missing | No billing route exists |
| `/billing/success` + `/billing/cancel` pages | ❌ Missing | Landing/callback pages for checkout completion |
| Restrict API Usage tab/route visibility to allowed admin emails | ✅ Done | `app-sidebar.tsx` — ADMIN_EMAILS sąrašas, API Usage rodomas tik adminams |
| Global error boundary | ✅ Done | `ErrorComponent` in `__root.tsx` |
| Toast notifications on actions | ⚠️ Partial | Fully connect action response statuses to `sonner` toasts |

---

## 6. Phase 3: Law Firm Mode & Print/E2E Polish
*Expands the platform to support Law Firms managing multiple clients, PDF exports, and final validation.*

| Task | Status | Notes |
|---|---|---|
| Persona toggle persisted to `org_settings` in Supabase | ❌ Missing | Persona toggle works but is stored in local Zustand store only |
| `/settings/clients` route + `<ClientManagementTable />` | ⚠️ Partial | Route exists but needs integration with the backend `clients` table |
| `<ClientBillingCard />` with CSV export | ❌ Missing | Dashboard component for client metrics export |
| Optimize case/takedown pages for browser print-to-PDF (`@media print` CSS) | ❌ Missing | Clean CSS print styles for report generation |
| End-to-end QA + `docs/phase2-demo.md` / `docs/phase3-demo.md` | ❌ Missing | Complete verification and demo walkthrough documentation |

---

## 7. Geo-Targeted Scans & Proxy Location Management
*Interactive controls to set and monitor regional scans per brand.*

| Task | Status | Notes |
|---|---|---|
| store.ts: add `targetRegions` to Mark state | ❌ Missing | Update client-side state model to persist selected scan locations |
| Add/Edit Mark Modal: multi-select region dropdown | ❌ Missing | Add checkboxes or multi-select dropdown for target regions (e.g., US, Europe, Asia) |
| UI Tooltips: explain geo-proxy scanning logic | ❌ Missing | Explain to users how selecting regions routes scans through local country proxies |
| Monitored Assets table: display active target regions | ❌ Missing | Display country/region flags or badges for active locations on each brand row |
| Infringement details: show detection location | ❌ Missing | Display which specific region/proxy location captured each piece of evidence |

