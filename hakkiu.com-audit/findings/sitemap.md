# Sitemap Audit — hakkiu.com

**Audit date:** 2026-07-30
**Score: 62 / 100**

---

## Validation Checks

| Check | Result | Detail |
|---|---|---|
| XML well-formed | PASS | Valid XML 1.0 UTF-8, correct `urlset` namespace |
| URL count vs 50k limit | PASS | 13 URLs (well under limit) |
| URL count vs 50MB limit | PASS | ~2 KB uncompressed |
| All URLs return 200 | PASS | All 13 checked; none 404 or redirected |
| No noindexed URLs in sitemap | UNVERIFIED | Requires browser render to read meta robots tag |
| robots.txt allows all sitemap URLs | PASS | All paths (`/`, `/about`, `/contact`, `/solutions/`, `/legal/`) are explicitly allowed |
| robots.txt declares sitemap | PASS | `Sitemap: https://hakkiu.com/sitemap.xml` present |
| `changefreq` tag | FAIL (info) | Present on all 13 URLs — ignored by Google; adds noise |
| `priority` tag | FAIL (info) | Present on all 13 URLs — ignored by Google; adds noise |
| `lastmod` W3C Datetime format | PASS | All dates are valid `YYYY-MM-DD` format |
| `lastmod` accuracy / uniqueness | WARN | Dates appear to reflect the initial build batch (2026-07-28/29), not actual individual page change dates. All legal pages share the identical date. This is acceptable for a new site but will degrade signal value over time if never updated on real changes. |
| No orphan/blocked pages in sitemap | PASS | No disallowed paths appear in sitemap |
| Sitemap source consistency | PASS | `public/sitemap.xml` and `dist/client/sitemap.xml` are identical |
| URL count stated by user | INFO | User said 14 URLs; actual count is 13. No issue — just a mismatch in the brief. |

---

## What Works Well

- Clean, valid XML. No syntax errors.
- All 13 URLs return HTTP 200 with no redirect chains.
- robots.txt and sitemap are fully coherent — no allowed-in-sitemap/blocked-in-robots conflicts.
- Authenticated app paths (`/dashboard`, `/cases`, `/auth/`) are correctly excluded from both the sitemap and allowed in robots.txt.
- AI crawler policy is explicit and correctly scoped (GPTBot, ClaudeBot, PerplexityBot, etc. are welcome on public content, blocked on app paths).
- Sitemap declared in robots.txt at the standard location.
- Legal pages correctly deprioritised (0.3–0.4) relative to solution pages (0.8).
- No location page pattern — quality gate is not triggered.

---

## Findings

### F1 — Deprecated tags present (Info, -5 pts)
`<changefreq>` and `<priority>` appear on every URL. Google has publicly confirmed both are ignored. They add ~30% file bloat for zero benefit. Recommended action: strip both tags from all entries.

### F2 — `lastmod` is not build-stamped dynamically (Low, -8 pts)
The dates are hardcoded in `public/sitemap.xml`. If a page is updated and the file is not manually edited, `lastmod` will silently go stale. This matters most for `/` and the two solution pages, where Google uses `lastmod` to decide recrawl frequency. Recommended action: generate `lastmod` from the file's git commit timestamp at build time (a one-liner in the build script), or at minimum add a reminder to update the date on every deploy that changes content.

### F3 — No content hub / blog (Medium, -10 pts)
`/blog` returns 404. For a B2B SaaS in trademark/brand protection, long-tail *informational* content (`how to file a trademark takedown`, `what evidence a UDRP complaint needs`, `how perceptual hashing detects counterfeits`) drives the majority of qualified organic traffic. Keep it purely educational — no competitor comparisons. Without it, the site can only rank for branded queries. Not penalised at current scale, but it is the primary growth lever that is entirely absent.

### F5 — `/solutions` parent returns 404 (Low, -5 pts)
`/solutions/law-firms` and `/solutions/brand-owners` are in the sitemap and return 200, but their parent `/solutions` returns 404. Google will crawl the parent URL from internal links and encounter a dead end. This also means there is no hub page to pass link equity to both solution pages, and no breadcrumb anchor for structured data. Recommended action: add a `/solutions` index page (even a simple one listing both audiences) or redirect `/solutions` to one of the two existing pages.

### F6 — No `<lastmod>` variance between solution pages and legal pages (Info)
Solution pages (`/solutions/law-firms`, `/solutions/brand-owners`) share `2026-07-29`; all legal pages share `2026-07-28`. This is technically fine for a site launched in a single batch. It becomes a concern if legal pages are later updated and the date is not changed, or if solution page copy is revised without bumping the date.

---

## Missing Pages (in sitemap but broken: none | absent from sitemap and live: none | expected but 404)

Pages probed that do not exist but represent common B2B SaaS gaps:

| URL | Status | Priority |
|---|---|---|
| `/solutions` | 404 | Medium — parent hub for two existing solution pages |
| `/blog` | 404 | Medium — primary long-tail (educational) organic growth lever |
| `/features` | 404 | Low — supports mid-funnel evaluation queries |

*(A `/pricing` page is intentionally not part of this plan — sales are demo/meeting-led.)*

---

## Orphan / Blocked Pages

None found. All app-side paths are consistently disallowed in robots.txt and absent from the sitemap.

---

## robots.txt Cross-Check

| Sitemap URL | robots.txt Allow rule | Conflict? |
|---|---|---|
| `https://hakkiu.com/` | `Allow: /$` | None |
| `https://hakkiu.com/about` | `Allow: /about` | None |
| `https://hakkiu.com/contact` | `Allow: /contact` | None |
| `https://hakkiu.com/solutions/law-firms` | `Allow: /solutions/` | None |
| `https://hakkiu.com/solutions/brand-owners` | `Allow: /solutions/` | None |
| `https://hakkiu.com/legal/*` (8 pages) | `Allow: /legal/` | None |

robots.txt is clean and consistent with the sitemap.

---

## Recommendations (priority order)

1. **Create `/solutions` index** — a two-card hub linking to `/solutions/law-firms` and `/solutions/brand-owners`. Eliminates the 404 parent and builds internal link equity.
2. **Strip `<changefreq>` and `<priority>`** from all sitemap entries — both are ignored by Google.
3. **Automate `lastmod` from git commit date** — wire it into the build step so it reflects real content changes.
4. **Launch an educational `/blog`** (informational guides only, no competitor comparisons) once resourced.
5. **Plan a content hub** (`/blog` or `/resources`) — the primary lever for capturing non-branded organic traffic in the trademark/brand protection space.
