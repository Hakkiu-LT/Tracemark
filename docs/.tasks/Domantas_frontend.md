# Phase 2 & Phase 3 — Frontend Tasks

This document contains all frontend tasks, routes, components, and frontend-supporting API endpoints for Phase 2 and Phase 3.

> Legend: ✅ Done · ⚠️ Partial · ❌ Missing

---

## Phase 2 — Week 1: Detection Engine Foundation

### Alert Feed & API Support
| Task | Status | Notes |
|---|---|---|
| `<InfringementAlertFeed />` React component | ❌ Missing | Not in `src/components/dashboard/` |
| TanStack Query polling every 30s | ❌ Missing | Needs setup on the feed component |
| `GET /api/v1/infringements` API endpoint | ❌ Missing | No `routes/infringements.py` exists (Backend API supporting feed) |

---

## Phase 2 — Week 2: Case Detail & Evidence View

### Case Detail View
| Task | Status | Notes |
|---|---|---|
| `/cases/$id` route | ✅ Done | `src/routes/cases.$caseId.tsx` exists |
| `<CaseDetailView />` with screenshot + metadata + AI analysis | ⚠️ Partial | Evidence section components exist (`evidence-section.tsx`, `evidence-screenshot-section.tsx`), but pull from the existing check-brand AI output, not a dedicated evidence/infringement record |
| "Generate Takedown Notice" / "Escalate" / "Dismiss" action buttons | ⚠️ Partial | Takedown route (`cases.$caseId.takedown.tsx`) exists; escalate/dismiss status updates to Supabase missing |
| Loading skeletons | ❌ Missing | Needed for smooth loading state transitions |
| `GET /api/v1/infringements/{id}` API endpoint | ❌ Missing | Backend API supporting case details |
| `GET /api/v1/evidence/{infringement_id}` API endpoint | ❌ Missing | Backend API supporting evidence loading |

---

## Phase 2 — Week 3: Dashboard Filters, Error States & Polish

### Dashboard & Polish
| Task | Status | Notes |
|---|---|---|
| Filter bar (Risk Level, Platform, Status, Date Range) on Alert Feed | ❌ Missing | Alert Feed itself doesn't exist yet |
| Case Detail: `capture_failed` banner + "Retry Screenshot" button | ❌ Missing | Required to trigger recaptures |
| Case timeline sidebar | ❌ Missing | Shows progression history of the infringement |
| Global error boundary | ✅ Done | `ErrorComponent` in `__root.tsx` |
| Skeleton loaders on data-fetching components | ❌ Missing | Ensure visual consistency |
| Toast notifications on actions | ⚠️ Partial | `sonner` Toaster is wired; action toasts are not fully connected |
| `docs/phase2-demo.md` | ❌ Missing | Demo instructions documentation |

---

## Phase 2 — Week 4: Authentication & Payments

### Auth — Frontend
| Task | Status | Notes |
|---|---|---|
| Sign-in page (`/auth/sign-in`) with Google OAuth + email/password | ✅ Done | `auth.sign-in.tsx` → `<AuthScreen />` |
| Sign-up page (`/auth/sign-up`) | ✅ Done | `auth.sign-up.tsx` → `<AuthScreen />` |
| Auth callback route (`/auth/callback`) | ✅ Done | `auth.callback.tsx` exists |
| Protected route guard (`<RequireAuth />`) | ✅ Done | Implemented in `__root.tsx` via `RequireAuth` |
| User menu with avatar + sign-out | ✅ Done | `src/components/user-menu.tsx` exists |

### Stripe Billing — Frontend
| Task | Status | Notes |
|---|---|---|
| `/settings/billing` page | ❌ Missing | No billing route exists |
| `/billing/success` + `/billing/cancel` pages | ❌ Missing | Landing/callback pages for checkout completion |

---

## Phase 3 — Week 1: Document Generation UI

### Document Generator View
| Task | Status | Notes |
|---|---|---|
| `/documents/generate` frontend route + `<DocumentGeneratorView />` | ❌ Missing | No such route; takedown is handled in `cases.$caseId.takedown.tsx` but needs full editor & preview layout |
| `<DocumentActions />` bar (Download PDF, Download Docx, Send via Email) | ❌ Missing | Buttons need to be implemented and wired |
| `GET /api/v1/documents/preview` API endpoint | ❌ Missing | Backend API supporting the live editable preview text |
| `POST /api/v1/documents/generate` API endpoint | ❌ Missing | Backend API supporting document file compilation |

---

## Phase 3 — Week 2: Notification Settings UI & Logs

### Notifications Frontend
| Task | Status | Notes |
|---|---|---|
| `/settings/notifications` route + `<NotificationSettingsPanel />` | ❌ Missing | UI panel to configure notification emails |
| `<NotificationDeliveryLog />` component | ❌ Missing | Table showing last 20 notification delivery events with status badges |
| `POST /api/v1/notifications/test/email` API endpoint | ❌ Missing | Backend API supporting test connections |
| `POST /api/v1/documents/{id}/send-email` API endpoint | ❌ Missing | Backend API supporting document delivery via email |

---

## Phase 3 — Week 3: Law Firm Mode & Final Polish

### Law Firm Settings & E2E Validation
| Task | Status | Notes |
|---|---|---|
| Persona toggle persisted to `org_settings` in Supabase | ❌ Missing | Persona toggle works but is stored in local Zustand store only |
| `/settings/clients` route + `<ClientManagementTable />` | ⚠️ Partial | `src/routes/clients.tsx` exists but appears to be a standalone client-list page, not wired to the backend `clients` table |
| `<ClientBillingCard />` with CSV export | ❌ Missing | Dashboard component for client metrics export |
| End-to-end QA + `docs/phase3-demo.md` | ❌ Missing | Complete verification and demo walkthrough documentation |
