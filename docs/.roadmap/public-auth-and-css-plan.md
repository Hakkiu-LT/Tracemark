# Session 41 — Lever A (supabase off public pages) + Lever B (CSS) plan

Branch: `perf/landing-css-and-public-auth`. Same careful process as the JS refactor:
investigate (done, 2 subagents) → plan → self-review → independent confirm →
step-by-step with checks → before/after verification.

## Lever B (render-blocking CSS) — DECISION: DO NOT do the risky version
Investigation (subagent) concluded the async-CSS-swap / critical-CSS-inline is
NOT worth it and CONFLICTS with the user's absolute "must look the same / no
FOUC" rule:
- SSR-only build (no prerendered HTML) → auto critical-CSS tools (beasties/
  critters) can't hook in; would need a hand-authored critical set that drifts.
- Tailwind v4 emits ONE global un-splittable sheet (26.6 KiB gzip); can't shrink
  it safely because nearly every rule/font/utility is used SOMEWHERE in the app
  (removing = changing how those pages look).
- The `media=print`→`all` async swap risks a real FOUC flash; only ~100–200ms
  lab gain (~0–3 Lighthouse points). FCP 4.2s is dominated by TTFB/hydration, not
  the 27 KiB CSS.
Verdict: skip B. Being careful = not doing a fragile, low-value change that risks
the very thing the user forbade. Real FCP lever (TTFB/hydration) is a separate,
bigger effort to propose later. Deliver A (the safe, real win) as "lever B was
investigated and safely declined."

## Lever A — remove Supabase load from public MARKETING pages
Problem: `AuthProvider` (in `src/routes/__root.tsx`, wraps every route) runs a
session-check useEffect on mount that dynamically imports supabase — so even the
landing page downloads the ~55 KiB supabase chunk after hydration (PSI flags it
as unused JS on "/"). Public marketing/legal pages never read `useAuth()`.

Safety (verified by subagent): NO public/marketing component uses `useAuth`.
Login (auth-screen), OAuth callback, book-a-demo, talk-to-sales, request-demo are
all self-contained — they either import supabase themselves inside handlers or
POST to the main API; none rely on AuthProvider's eager session check. There is
NO "redirect if already logged in" to break. `LeadModalsProvider` and
`ConsentManager` do NOT use `useAuth` (AuthProvider stays mounted anyway).

Recommended scope: skip the eager check on public paths EXCEPT auth paths
(keep it on /auth/sign-in, /auth/sign-up, /auth/callback, /legacy/login,
/legacy/signup — those either self-load supabase or benefit from pre-warming).

### Design (stateful "activate once")
`AuthProvider` gets a `deferAuth: boolean` prop = "current route is public and
NOT an auth path". Behavior:
- Initial `activated = !deferAuth`, `loading = !deferAuth`.
- Effect 1: `if (!deferAuth) setActivated(true)` — once we land on/navigate to a
  route that needs auth, activate PERMANENTLY (never set back to false), so no
  re-check flicker when bouncing back to marketing.
- Effect 2 (deps [activated]): if `!activated` → return (supabase never loaded,
  loading already false). Else setLoading(true), dynamic-import supabase,
  getSession, subscribe onAuthStateChange, unsubscribe on cleanup. (Same body as
  today, just gated by `activated`.)
- Profile effect + signOut/refreshProfile: unchanged (already lazy-import).

Result: on a public marketing page (initial load or SPA nav within marketing),
supabase is NEVER downloaded. On any auth/app route it loads exactly as today.
Logged-in users bouncing marketing↔app: supabase loads once (on first app/auth
route) and stays; no repeated checks.

### __root.tsx change
- Add `const AUTH_PATHS = new Set(["/auth/sign-in","/auth/sign-up","/auth/callback","/legacy/login","/legacy/signup"])`.
- `const deferAuth = isPublic && !AUTH_PATHS.has(pathname)` (pathname already read at line 226).
- `<AuthProvider deferAuth={deferAuth}>`.

### Files to change (2)
1. `src/lib/auth.tsx` — add `deferAuth` prop + activate-once logic (Effects 1 & 2).
2. `src/routes/__root.tsx` — AUTH_PATHS + compute deferAuth + pass prop.

### Verification (before/after)
- BEFORE (main, live): landing loads `supabase-*.js` (54.8 KiB) — PSI "unused JS".
- AFTER: build + serve locally; landing HTML/network must NOT reference the
  supabase chunk at all. Auth paths (/auth/sign-in) MUST still load it on demand
  (click → network shows supabase chunk). Protected route while logged-out →
  redirect to /auth/sign-in (RequireAuth still works).
- tsc 0, vite build 0. Visual: landing + sign-in screenshots identical.
- Controlled local Lighthouse before/after (directional).

### Risk register
- R1 logged-in user visiting a protected route: activated=true path runs getSession
  → RequireAuth gates on loading → works as today. OK.
- R2 SPA nav marketing→app: deferAuth flips false → activate once → check runs. OK.
- R3 sign-in/callback: unchanged (self-import supabase). OK.
- R4 someone adds a useAuth caller to a public page later: AuthProvider still
  mounted so context exists; it'd just return loading=false/session=null until a
  non-public route activates. Acceptable; document it.

### ⚠️ Independent review CORRECTION (applied) — logged-in redirect race
Original design (flip `activated` in an effect, init `loading=!deferAuth`) had a
real bug: navigating "/" → "/dashboard", `RequireAuth` mounts reading the stale
committed `loading=false, session=null` and its redirect effect fires BEFORE the
session check runs → **logged-in user wrongly bounced to /auth/sign-in.**
Corrected design (A2 + render-phase activation):
- `loading` initial = `true` ALWAYS (unchanged from today → SSR/CSR agree, and
  RequireAuth can never see loading=false without a completed check).
- Gate only the supabase IMPORT via `activated` (init `!deferAuth`).
- Flip activation DURING RENDER, not in an effect:
  `if (!activated && !deferAuth) { setActivated(true); setLoading(true); }`
  (guarded → runs once on the transition; sets loading=true synchronously so
  RequireAuth mounts with loading=true → spinner, no premature redirect).
- Effect (dep `[activated]`): if `!activated` → `setLoading(false)` (public page,
  no supabase). Else `setLoading(true)` + import supabase + getSession + subscribe.
Invariant guaranteed: RequireAuth (mounts only when !isPublic ⇒ activated=true)
never observes `loading===false` before getSession completes on the current mount.

### Merge gate
Merge only if: landing no longer loads supabase (verified in built HTML/network),
sign-in still loads it on demand, tsc/build clean, screenshots identical.
