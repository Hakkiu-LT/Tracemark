# MarkGuard — Trademark & Brand Protection Dashboard

A modern legal-tech SaaS dashboard with a deep-blue / clean-gray aesthetic, sharp data visualization, and a Brand Owner ↔ Law Firm persona toggle that conditionally reveals features.

All data is mocked client-side (no backend yet) so every interaction — adding marks, takedowns, status changes — updates local state immediately.

## Design system

- **Palette**: deep navy primary (`oklch(0.22 0.06 260)`), electric blue accent (`oklch(0.58 0.18 255)`), neutral grays for surfaces, semantic risk colors (red/amber/emerald) for High/Medium/Low.
- **Typography**: Inter for UI, JetBrains Mono for evidence metadata (URLs, IPs, timestamps).
- **Components**: shadcn primitives (Card, Table, Dialog, Tabs, Badge, Sheet, Form) themed via `src/styles.css` tokens.
- **Layout**: collapsible sidebar (shadcn Sidebar) + top header with persona indicator and search.
- **Charts**: Recharts for success-rate trend and platform breakdown.

## Routes (TanStack Start, file-based)

```
src/routes/
  __root.tsx                  # SidebarProvider shell, persona context, QueryClientProvider
  index.tsx                   # Dashboard overview
  monitoring.tsx              # List of monitored marks
  monitoring.new.tsx          # Add asset form
  cases.tsx                   # Infringement case list
  cases.$caseId.tsx           # Case detail / evidence
  cases.$caseId.takedown.tsx  # Document generator (side-by-side)
  clients.tsx                 # Law-firm-only client management
  settings.tsx                # Persona toggle, profile, notifications
```

Each route gets its own `head()` with route-specific title + description.

## Persona model

- Global `PersonaContext` (React context, persisted to `localStorage`) with `"brand_owner" | "law_firm"`.
- Toggle lives in Settings (per spec). Sidebar nav and dashboard widgets read from context:
  - `clients` route + "Active Client" switcher in header are only rendered for `law_firm`.
  - Brand Owner dashboard shows their own metrics; Law Firm dashboard aggregates across clients with a client filter.

## Mock data layer

`src/lib/mock-data.ts` exports seed arrays + a tiny in-memory store using Zustand (or a plain context+reducer) so clicks (Takedown / Mark as Safe / Escalate) mutate state and re-render everywhere.

Entities: `Mark`, `Client`, `Infringement` (with `riskLevel`, `platform`, `thumbnailUrl`, `status`), `Evidence`, `TakedownDocument`.

## Page-by-page

### 1. Dashboard Overview (`/`)
- 4 metric cards: Monitored Marks, Active Infringements, Successful Takedowns, Success Rate %.
- Success-rate sparkline (last 30 days) + platform breakdown donut.
- **Infringement Alert Feed**: virtualized list of recent detections — thumbnail, risk badge (High=red, Medium=amber, Low=emerald), platform icon (Amazon/Shopify/Web), detected-at timestamp, "View case" link → `/cases/$caseId`.
- Law-firm variant adds a "Client" column and a client filter chip row.

### 2. Monitoring (`/monitoring`, `/monitoring/new`)
- `/monitoring`: table of monitored marks with status, platforms, last scan, # active infringements.
- `/monitoring/new`: react-hook-form + Zod schema for Brand Name, Trademark Reg #, Logo upload (preview only), Official Website, multi-select Target Platforms (Amazon, Shopify, eBay, AliExpress, Web Domains, Instagram, TikTok). Submit pushes into mock store and navigates back.

### 3. Case Management (`/cases`, `/cases/$caseId`)
- List view: filterable/sortable table of all infringements.
- Detail view sections:
  - **Infringer**: seller name, store URL, country, contact.
  - **Evidence**: large screenshot placeholder (skeleton-styled image card) with mono-font metadata block (Timestamp, URL, IP, User Agent, Detection Method).
  - **AI Infringement Analysis**: card with confidence score, matched elements (logo similarity %, brand name match, product category), and a generated rationale paragraph.
  - **Action bar**: "Generate Takedown Notice" → navigates to takedown route, "Escalate to Counsel" (law-firm only or shows lawyer picker for brand owner), "Mark as Safe" (updates status with toast + optimistic UI).

### 4. Document Generator (`/cases/$caseId/takedown`)
- Split layout (resizable on desktop, stacked on mobile):
  - **Left**: editable DMCA / Cease & Desist letter pre-filled from case data, with template switcher (DMCA Takedown, Cease & Desist, Platform-specific Amazon/Shopify form).
  - **Right**: evidence package — screenshots, metadata, trademark cert reference, AI analysis summary, attached as a checklist.
- Footer actions: "Download PDF" (uses `jspdf` to generate from the editable text), "Send via Webhook" (mock — opens dialog with webhook URL field, shows success toast).

### 5. Settings (`/settings`)
- Tabs: Profile, **Persona** (the toggle: Brand Owner vs Law Firm), Notifications, API/Webhooks.
- Persona toggle is a prominent segmented control with descriptions of what each mode changes.

### 6. Law Firm Clients (`/clients`) — conditional
- Only present in nav when persona = `law_firm`. Direct visit when brand owner shows a friendly "switch persona" empty state.
- Table of clients: name, industry, monitored marks, active cases, MRR, last activity.
- "Add Client" dialog (name, contact, plan).
- Per-client drawer: billing summary (current period usage, takedowns count, invoice list — mocked), and a "Switch to this client" action that filters the rest of the app to that client's data.

## Interactivity / state changes (mocked)

- Clicking **Takedown** on a case: status → `takedown_sent`, increments Successful Takedowns metric, adds entry to activity feed, toast confirmation.
- **Mark as Safe**: removes from Active Infringements count, moves to "Resolved" tab.
- **Escalate**: status → `escalated`, badge changes color, appears in law-firm queue.
- Adding a Mark in `/monitoring/new`: increments Monitored Marks metric and seeds 0–2 fake infringements after a 1s "scan" simulation.

## Responsiveness

- Sidebar collapses to icon rail < 1024px, becomes Sheet drawer < 768px.
- Dashboard metric grid: 4 cols → 2 cols → 1 col.
- Case detail switches from 2-column (evidence | analysis) to stacked.
- Document generator split becomes tabs ("Letter" / "Evidence") on mobile.

## Technical notes

- TanStack Router file routes; no React Router.
- Forms with `react-hook-form` + `zod` (already standard).
- Charts: `recharts` (install if missing).
- PDF: `jspdf` (install).
- State: lightweight Zustand store (install) for mock data mutations — keeps clicks reactive everywhere without prop drilling.
- All colors via semantic tokens in `src/styles.css` (`--primary`, `--risk-high`, `--risk-med`, `--risk-low`, `--surface`, etc.). No raw hex in components.
- No backend / Lovable Cloud yet — can be added later for real persistence, auth, and scanning jobs.

## Out of scope (this iteration)

- Real auth, real scanning, real platform integrations.
- Multi-tenant data isolation (mocked via active-client filter only).
- Email/webhook delivery (button mocks the action).

Ready to build on approval.
