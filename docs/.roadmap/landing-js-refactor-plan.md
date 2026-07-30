# Landing JS Refactor — Detailed Plan (session 41, branch `perf/landing-js-split`)

## Goal
Remove the Supabase client (`@supabase/*`, ~60 KiB gzip) from the **eager entry
JS chunk** that the public landing page ("/") downloads, WITHOUT changing how
anything looks or behaves. Full refactor, done carefully, verified before/after.

## Why (verified diagnosis)
- Real Lighthouse (mobile, live `hakkiu.com`): score ~65, FCP 4.2s, LCP 5.5s,
  SI 6.8s. TTFB 50ms (server fast), TBT 70ms, CLS 0 (fine).
- Root cause = **JS**: landing loads one `index-*.js` entry chunk = 253 KiB
  transfer (861 KB raw), **149 KiB unused**, main-thread work 1.8s.
- The entry chunk bundles the WHOLE route tree (all app routes) + the Supabase
  client. Route **components** are already code-split; route **definition
  modules** (top-level imports) are eager (`routeTree.gen.ts` statically imports
  every route). So any module-scope `import { supabase }` in a route file (or a
  component a route imports at module scope) lands in the entry chunk.
- Landing itself (`routes/index.tsx` + `components/landing/*`) has NO supabase
  imports — so removing supabase from the shared entry is pure win for landing
  with zero landing-visual risk.

## Approach chosen: A — surgical per-file lazy import
Convert each static `import { supabase | helper } from "@/lib/supabase"` into a
dynamic `const { ... } = await import("@/lib/supabase")` INSIDE the existing
async function / effect / handler where it is used. This matches the ALREADY
PROVEN pattern in `src/lib/auth.tsx` and `src/lib/api.ts` (done earlier this
session). No new abstraction layer (rejected Approach B: react-query hooks
layer = more surface/risk). No routing restructure (rejected Approach C = high
risk). `manualChunks` rejected (D: still modulepreloaded, no real win).

Dynamic `import()` is module-cached by the browser, so repeated calls reuse one
download. All call sites are already in async contexts (effects/handlers/
queryFns), so no render-path restructuring is needed. `import type {...}` lines
are erased at build → left untouched.

## Baseline (BEFORE) — measured on main / live
- Landing entry chunk: `index-C2jHLrb1.js` = 860,950 bytes raw (~253 KiB
  transfer); contains `GoTrueClient` (supabase) — 7 occurrences.
- Lighthouse mobile: score 65, FCP 4.2s, LCP 5.5s, SI 6.8s.
- (Images + Inter-subset safe wins already merged to main earlier this session.)

## Files to change (exhaustive) and per-file call-site map

Already done (do not touch): `src/lib/api.ts` (apiFetch), `src/lib/auth.tsx`.

### EASY
1. `src/routes/auth.callback.tsx` — `import { supabase }` used once in a
   useEffect async `exchange()` calling `supabase.auth.exchangeCodeForSession`.
   → move `const { supabase } = await import("@/lib/supabase")` inside the async
   fn, keep the `if (!supabase) return` guard.
2. `src/routes/cases.tsx` — `import { deleteInfringementFromSupabase }`, called
   in async `handleDeleteCase()`. → `const { deleteInfringementFromSupabase } =
   await import("@/lib/supabase")` inside the handler.
3. `src/routes/monitoring.$caseId.tsx` — `import { fetchCaseFromSupabase }`,
   used in an async effect and an async handler (2 sites). → lazy-import in each.
4. `src/components/notification-delivery-log.tsx` — `import { supabase }` in a
   react-query `queryFn` (async). → lazy-import inside queryFn.
   NOTE: verify whether this component is imported anywhere; if orphaned/dead,
   SKIP (dead code is tree-shaken, not in the bundle) to minimise churn.

### MEDIUM
5. `src/routes/settings.tsx` — `import { supabase }`, 5 call sites, all inside
   async effect `loadOrgSettings()` + async handlers `handleSaveProfile()` /
   `switchPersona()`. → one `const { supabase } = await import(...)` at the top
   of EACH async fn that uses it, before first use.
6. `src/components/ClientsPage.tsx` — `import { supabase }`, 3 sites: async
   effect `fetchDbClients()`, async `submit()`, async `handleRemove()`. →
   lazy-import at top of each async fn.
7. `src/components/auth/auth-screen.tsx` — `import { supabase }`, 3 sites, all
   in async handlers (`onGoogle`, `onForgot`, `onSubmit`). → lazy-import in each.

### HARD (only because of a SYNC storage call — trivially handled)
8. `src/routes/cases.$caseId.takedown.tsx` — `import { supabase }`, 3 sites in
   async `saveToSupabaseStorage()`; includes sync `.storage.from().getPublicUrl`.
   → `const { supabase } = await import(...)` at the START of the async fn, then
   use `supabase` (incl. the sync method) exactly as before.
9. `src/routes/monitoring.$caseId.takedown.tsx` — `import { fetchCaseFromSupabase,
   supabase }`, same pattern in async `handleSaveToSupabase()`; also
   `fetchCaseFromSupabase` used elsewhere. → lazy-import both where used.

## Self-review refinements (verified against actual code)
- **notification-delivery-log.tsx is DEAD CODE** (imported nowhere) → tree-shaken,
  not in bundle → **SKIP** (drop S4). Net files to change: **8**, not 9.
- **settings.tsx**: the `!supabase` null-check is in the OUTER effect body / at the
  top of `handleSaveProfile` (before `setSavingProfile(true)`) / inline in
  `switchPersona`. When lazy-importing, MOVE the `!supabase` check INSIDE each
  async fn (after `await import`), and preserve loading-state correctness:
  - `loadOrgSettings` effect: outer guard becomes `if (!orgId) { setLoadingProfile(false); return; }`; inside the async fn do `const { supabase } = await import(...); if (!supabase) { setLoadingProfile(false); return; }` — the existing `finally { setLoadingProfile(false) }` also covers it.
  - `handleSaveProfile`: `if (!user) return; const { supabase } = await import(...); if (!supabase) return; setSavingProfile(true); ...` — check supabase BEFORE setSavingProfile(true) so it can't get stuck true.
  - `switchPersona`: `const { supabase } = await import(...); if (supabase && orgId) { ... }` (same inline guard, just after import).
- **ClientsPage.tsx**: 3 async fns (`fetchDbClients` effect, `submit`, `handleRemove`) each use `supabase!`. Add `const { supabase } = await import("@/lib/supabase"); if (!supabase) return/appropriate;` at the top of each, preserving existing outer mock/no-supabase guards and loading-state resets.
- **monitoring.$caseId.tsx**: site 1 (line ~59) is `await fetchCaseFromSupabase` in an async handler → lazy-import at top. Site 2 (line ~98) is a `.then()` chain in a useEffect (NOT awaited) → rewrite as `import("@/lib/supabase").then(({ fetchCaseFromSupabase }) => fetchCaseFromSupabase(caseId)).then((data) => {...}).finally(...)`, keeping the `cancelled` flag logic.
- **takedown files**: `getPublicUrl()` is synchronous but lives inside an async handler — do `const { supabase } = await import("@/lib/supabase"); if (!supabase) return;` once at the top of the handler, then use `supabase` (incl. the sync method) unchanged.

## Independent reviewer corrections (verdict: GO WITH CORRECTIONS) — MANDATORY
1. **ClientsPage `fetchDbClients` (correctness):** the current OUTER no-supabase
   guard does TWO things — `setDbClients(clients)` (Zustand store fallback list)
   AND `setIsLoading(false)`. When moving the null-check inside the async fn, the
   `if (!supabase)` branch MUST reproduce BOTH `setDbClients(clients)` and
   `setIsLoading(false)` — not only the loading reset — or the mock/no-supabase
   client list silently becomes empty.
2. **monitoring.$caseId.takedown.tsx has THREE sites (not two):**
   - `handleSaveToSupabase` (~line 215) async handler — lazy-import at top.
   - `loadCase` (~line 272) — `await fetchCaseFromSupabase` — lazy-import at top.
   - useEffect `.then()` chain (~line 286) — rewrite as
     `import("@/lib/supabase").then(({ fetchCaseFromSupabase }) => fetchCaseFromSupabase(caseId)).then(...).finally(...)`, PRESERVING the `cancelled` flag (same shape as monitoring.$caseId.tsx:98). Do NOT naively `await` in the non-async effect body.
3. **Verification hardening:** in S10, grep the entry chunk for `createClient`
   and `@supabase/postgrest` too (not just `GoTrueClient`), AND confirm the
   supabase-containing chunk is referenced via lazy `import()` and is NOT
   `modulepreload`-ed from the landing "/" HTML (else the browser still eagerly
   fetches it on landing).

## Execution order (one file per step, verify between each)
Order: easy → medium → hard, so any breakage is caught early on simple cases.
After EACH file:
  - `npx tsc --noEmit` must be 0 errors.
  - `npx vite build` must succeed.
Do NOT proceed to the next file until both pass.

Steps:
- S0. Confirm baseline: build current branch, record entry-chunk size + confirm
  supabase still present (expected — proves the measurement works).
- S1. auth.callback.tsx  → tsc + build
- S2. cases.tsx          → tsc + build
- S3. monitoring.$caseId.tsx → tsc + build
- S4. notification-delivery-log.tsx (or skip if orphaned) → tsc + build
- S5. settings.tsx       → tsc + build
- S6. ClientsPage.tsx    → tsc + build
- S7. auth-screen.tsx    → tsc + build
- S8. cases.$caseId.takedown.tsx → tsc + build
- S9. monitoring.$caseId.takedown.tsx → tsc + build
- S10. FINAL build → confirm `GoTrueClient` is GONE from the entry chunk and it
  now lives in a SEPARATE async chunk. Record new entry-chunk size.

## Verification (AFTER) — the "prieš/po" the user asked for
1. **Bundle proof (deterministic):** grep built chunks — supabase must NOT be in
   the landing entry chunk; entry-chunk KiB before vs after. Target: entry drops
   by ~40–60 KiB transfer.
2. **Type/build:** tsc 0, vite build 0, no new warnings.
3. **Visual parity (public pages, no auth needed):** run `npm run dev`, headless
   Chrome screenshot BEFORE (main) vs AFTER (branch) for: `/`, `/auth/sign-in`,
   `/auth/sign-up`, `/about`, `/contact`, `/solutions/brand-owners`,
   `/legal/privacy`. Must be pixel-identical (these are exactly the pages whose
   look could regress from routing/import changes).
4. **Functional (authed) sanity:** these pages need a session so can't be fully
   screenshotted without creds. Verify each authed route still COMPILES and its
   component chunk loads (build graph); manually confirm the sign-in page renders
   and the supabase chunk loads on demand (network) when hitting an auth action.
5. **Local Lighthouse:** if a local production serve is available (wrangler/vite
   preview), run mobile Lighthouse on `/` before vs after for FCP/LCP direction.
   If not feasible locally, rely on bundle proof + deploy-then-PSI.

## Merge gate
Merge to `main` ONLY if: supabase confirmed out of the landing entry chunk AND
entry chunk is smaller AND tsc/build clean AND public-page screenshots identical.
If the win is negligible or anything regresses → do NOT merge; report and stop.

## Risk register
- R1 Hydration mismatch from changing imports → mitigated: we change only the
  IMPORT MECHANISM inside already-client-side async code; SSR output of these
  route DEFINITIONS is unchanged (head/meta untouched). Landing unaffected.
- R2 Auth flow break (sign-in/callback) → mitigated: same calls, same guards,
  just `await import` first; verify sign-in loads + login works.
- R3 A missed static supabase edge keeps it in entry → mitigated: S10 grep proof;
  if present, find remaining importer and convert.
- R4 Null-guard regressions → keep every existing `if (!supabase) return`.
- R5 Dead-code file (notification-delivery-log) → verify importers; skip if unused.

## Rollback
All changes on branch `perf/landing-js-split`; `main` already has the safe
image+font wins. If verification fails, delete the branch — `main` unaffected.
Font/image originals also backed up in `/tmp/hakkiu-img-backup/`.
