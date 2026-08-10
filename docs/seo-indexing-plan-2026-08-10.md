# SEO Indexing Investigation & Plan — 2026-08-10

**Trigger:** Google Search Console (hakkiu.com) reports 6 pages "not indexed", 9 indexed.
User: "neindeksuoja puslapių, nežinau ar jie turi būti indeksuoti, bet sutvarkyk ką reikia."

**Property first detected by Google: 2026-08-05. GSC data as of 2026-08-07. The site is 5 days old.**

---

## 1. What GSC actually reports (from the screenshots)

| GSC status (LT) | English | Count | Example URLs |
|---|---|---|---|
| Puslapis su peradresavimu | Page with redirect | 1 | `http://hakkiu.com/` |
| Patikrinta – šiuo metu neindeksuota | Crawled – currently not indexed | 3 | `/legal/privacy`, `/solutions/brand-owners`, `/solutions/law-firms` |
| Atrasta – šiuo metu neindeksuota | Discovered – currently not indexed | 2 | `/legal/security`, `/legal/subprocessors` |

## 2. Investigation results (3 subagents + live-site verification)

All verified against BOTH the code and the **live production site** (`curl` as Googlebot):

- **HTTP status:** all 5 return `200`, no redirects. ✅
- **X-Robots-Tag header:** absent (not blocking). ✅
- **robots.txt:** live; none of the 5 paths blocked; `Sitemap:` line present. ✅
- **sitemap.xml:** live; **all 5 URLs listed**. ✅
- **`<meta name="robots">`:** live HTML has `index,follow,max-snippet:-1,...` — no `noindex` anywhere in the codebase. ✅
- **`<title>` / `<meta description>`:** live HTML has correct, page-specific values. ✅
- **`<link rel="canonical">`:** live HTML has correct **self-referential** canonical per page. ✅
- **Rendering:** full **SSR** (TanStack Start under `workerd`, self-hosted on Hetzner behind Caddy). Googlebot receives complete HTML + body text (privacy page = ~29 KB) with **no JS required**. ✅
- **Internal links:** all 5 are linked from the site-wide footer (`src/components/landing/footer.tsx`); `/legal/security` also in landing nav; solutions + privacy also linked from `/about`. ✅
- **Redirects:** `http→https` (308), `www→apex` (301), trailing-slash (301) via Caddy — single hop, no chains, correct. ✅

> **Verification caveat (for Section 5 checks):** BSD `grep -oE` returns nothing against this near-single-line SSR HTML (~29 KB, ~11 newlines) and produces a false "canonical/title missing" scare. Always split first: `curl … | tr '>' '>\n' | grep -iE …` (or use a Python byte-scan). Raw `grep` on the un-split stream is NOT a valid check.

### Diagnosis
**There is NO technical defect blocking indexing.** The pages are correctly served, crawlable, canonical, and in the sitemap.

- "Page with redirect" on `http://hakkiu.com/` is **expected** (HTTP→HTTPS). The HTTPS version is the one indexed. **No action, not a bug.**
- "Discovered/Crawled – currently not indexed" on a **5-day-old** site is **normal Google behaviour**, not a code bug. Google discovered the URLs (they're in the sitemap) but is deprioritising crawl/index of secondary pages until the domain earns more trust. This resolves with **time + authority + a manual nudge**, not with a code change.
- Legal boilerplate pages (privacy/security/subprocessors) are *inherently* low-value for search; Google very commonly parks them as "crawled – currently not indexed". This is acceptable and requires no fix.

### One genuine (minor) code defect found
Legal pages set page-specific `title` + `description` + `og:url`, but **do NOT set `og:title` / `og:description`**, so they inherit the **generic root** OG values (`"HAKKIU — Trademark & Brand Protection"`). Not a cause of non-indexing, but a real quality/consistency bug worth fixing. Affected: `src/routes/legal.*.tsx` (privacy, security, subprocessors, and the other legal pages for consistency).

## 3. Answer to "should they even be indexed?"

- **Solutions pages** (`/solutions/brand-owners`, `/solutions/law-firms`) — **YES**, these are commercial landing pages; getting them indexed matters. Prioritise these.
- **Legal pages** (privacy/security/subprocessors) — **optional**. No harm in being indexed; low SEO value. Recommendation: leave indexable, don't over-invest, let Google decide. Do NOT `noindex` them (they're linked from footer and are legitimate).

## 4. Proposed actions

### A. Code changes (this repo) — small, safe, legitimate
1. **Add page-specific `og:title` + `og:description`** to every `src/routes/legal.*.tsx` `head()` so social/OG metadata matches the page (fixes the inherited-generic-OG defect). Mirror the pattern already used in `solutions.brand-owners.tsx`.
2. **Strengthen internal linking to the two SOLUTIONS pages** (the ones that commercially matter):
   - Ensure the homepage (`src/routes/index.tsx`) has in-content contextual links to `/solutions/brand-owners` and `/solutions/law-firms` (not only footer). If already present, no-op.
   - Cross-link the two solutions pages to each other in-content.
   This raises their internal PageRank and signals importance to Google — the single most effective on-site lever for "discovered/crawled – not indexed".
3. **Bump `<lastmod>` in `public/sitemap.xml` ONLY for the legal pages whose `head()` actually changes in this task** (privacy/security/subprocessors + the other legal routes getting the OG fix). Do NOT bump the solutions-page lastmod — their content is not changing, so a fake freshness signal is cargo-culting. *(Reviewer correction: dropped the blanket "bump all affected URLs" from the original draft.)*
4. **(Optional) Add a build-time sitemap generator** so lastmod/coverage never drift from routes. Deferred — not required to fix indexing.

*Admin-portal parity note:* these are static marketing/SEO assets (routes, sitemap, meta), NOT customer data — the CLAUDE.md admin-parity rule does not apply. No admin-api/admin changes needed. (State this explicitly to the approver.)

### B. Non-code actions (must be done by a human in Google Search Console) — the actual "nudge"
These are what actually accelerates indexing; **the agent cannot do them** (no GSC API creds in repo):
1. In GSC → **URL Inspection** → enter each of the 5 URLs → **Request Indexing**. Do this for the 2 solutions pages first (highest priority).
2. Confirm the **sitemap is submitted** in GSC → Sitemaps (`https://hakkiu.com/sitemap.xml`).
3. Then **wait 1–3 weeks** and re-check. For a 5-day-old domain this is the expected timeline.
4. (Optional) Ignore `http://hakkiu.com/` "page with redirect" — it is correct behaviour.

### C. What we will NOT do (and why)
- **Not** add `noindex` to legal pages — they're legitimate, linked, and harmless to index.
- **Not** claim any code change "forces" indexing — indexing is Google's decision; we can only remove blockers (none exist) and improve signals.
- **Not** touch redirects/robots/canonical — all already correct.
- **Not** build competitor/comparison pages (out of scope; separately prohibited).

## 5. Acceptance criteria
- All `legal.*.tsx` pages emit self-consistent `og:title`/`og:description` in served HTML.
- Solutions pages have ≥1 in-content internal link from a high-authority page (home) beyond the footer.
- `sitemap.xml` lastmod refreshed; `curl` confirms all 5 URLs still 200 + correct canonical after deploy.
- A clear, written hand-off telling the user the GSC manual steps (Section B) and the realistic timeline.

## 6. Risk / blast radius
Very low. Changes are limited to marketing route `head()` metadata, in-content links, and a static XML file. No backend, DB, auth, or customer-data changes. No admin-portal impact.
