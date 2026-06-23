# Frontend Tasks

This document contains all frontend tasks, routes, components, and frontend-supporting API endpoints for Phase 2 and Phase 3.

> Legend: ✅ Done · ⚠️ Partial · ❌ Missing

---

## Detection Engine Foundation

### Alert Feed & API Support
| Task | Status | Notes |
|---|---|---|
| `<InfringementAlertFeed />` React component | ❌ Missing | Not in `src/components/dashboard/` |
| TanStack Query polling every 30s | ❌ Missing | Needs setup on the feed component |
| `GET /api/v1/infringements` API endpoint | ❌ Missing | No `routes/infringements.py` exists (Backend API supporting feed) |

---

## Case Detail & Evidence View

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

## Dashboard Filters, Error States & Polish

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

## Authentication & Payments

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

## Takedown Editor & Inline Editing UI

### Inline Notice Editor & Actions
| Task | Status | Notes |
|---|---|---|
| Make notice preview text editable inline on `/monitoring/$caseId/takedown` | ❌ Missing | Allow manual tweaks to notice text before copying/sending |
| Notice status update buttons (e.g. mark as Sent, Acknowledged, or Dismissed) | ⚠️ Partial | "Send email" marks as sent; other statuses can be updated in DB |
| Toast feedback and state syncing | ⚠️ Partial | Refresh notice list and badge indicators when statuses change |
| `PUT /api/v1/monitoring/takedowns/{id}` integration | ❌ Missing | Save user edits to notice text to the DB |

---

## Notification Settings UI & Logs

### Notifications Frontend
| Task | Status | Notes |
|---|---|---|
| `/settings/notifications` route + `<NotificationSettingsPanel />` | ❌ Missing | UI panel to configure notification emails |
| `<NotificationDeliveryLog />` component | ❌ Missing | Table showing last 20 notification delivery events with status badges |
| `POST /api/v1/notifications/test/email` API endpoint | ❌ Missing | Backend API supporting test connections |
| `POST /api/v1/monitoring/takedowns/{id}/send-email` integration | ❌ Missing | Frontend trigger to email the notice directly via backend SMTP |

---

## Law Firm Mode & Final Polish

### Law Firm Settings & E2E Validation
| Task | Status | Notes |
|---|---|---|
| Persona toggle persisted to `org_settings` in Supabase | ❌ Missing | Persona toggle works but is stored in local Zustand store only |
| `/settings/clients` route + `<ClientManagementTable />` | ⚠️ Partial | `src/routes/clients.tsx` exists but appears to be a standalone client-list page, not wired to the backend `clients` table |
| Optimize case/takedown pages for browser print-to-PDF (`@media print` CSS) | ❌ Missing | Allows both Brand Owners and Law Firms to cleanly print or save PDF reports from the browser |
| `<ClientBillingCard />` with CSV export | ❌ Missing | Dashboard component for client metrics export |
| End-to-end QA + `docs/phase3-demo.md` | ❌ Missing | Complete verification and demo walkthrough documentation |
