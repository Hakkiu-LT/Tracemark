# HAKKIU — Full SEO Audit Report

**Site:** https://hakkiu.com · **Date:** 2026-07-30 · **Type:** B2B SaaS (Trademark Monitoring / Brand Protection)
**Overall SEO Health Score: 64 / 100**

Field data (CrUX/GSC/GA4) is not connected — scores are lab + code-based. Add Google API OAuth to unlock field metrics.

**Scope constraints (per business direction):** no competitor-comparison content (legal risk), no pricing page (demo/meeting-led sales), no third-party testimonials yet (pre-customers). Recommendations below stay within these rules.

---

## Category Scores

| Category | Weight | Score |
|---|---|---|
| Technical SEO | 22% | 74 |
| Content Quality & E-E-A-T | 23% | 58 |
| On-Page SEO | 20% | 65 |
| Schema / Structured Data | 10% | 61 |
| Performance (CWV) | 10% | 72 |
| AI Search Readiness (GEO) | 10% | 52 |
| Images | 5% | 60 |
| **Weighted total** | | **64** |

---

## ⚠️ Data-accuracy note
The `seo-geo` specialist reported "no server-rendered FAQPage/Organization schema". **This is incorrect.** A direct render (`render_page.py`, `is_spa=false`, `mode=raw`) confirmed **4 valid JSON-LD blocks in the server HTML** (Organization+WebSite+Person+ContactPoint, SoftwareApplication, FAQPage, WebPage). Schema is present and server-rendered — treat schema recommendations as "improve", not "add from scratch".

---

## Top issues worth fixing (rules-safe)
1. **Mobile LCP 4.4s** (threshold 2.5s) — render-blocking 165KiB CSS, 291KiB fonts (9 requests), 650KiB uncompressed main JS. No critical-CSS split.
2. **`/solutions` parent returns 404** — crawl dead-end on a linked hub.
3. **Dead FAQPage schema** on 3 pages (FAQ rich results retired 2026-05-07) + homepage schema split across 4 scripts instead of one `@graph`.
4. **Thin content** (~350 words/page) with no editorial/resource hub — the main non-branded organic gap. Fixable with *educational* content only.
5. **Generic OG descriptions** on `/about` + `/contact`; incomplete legal identity in the imprint (`company.ts` placeholders).

## Quick wins
1. Fix `/solutions` 404 (index page or 301).
2. Unique OG descriptions/titles on `/about` + `/contact`.
3. Remove dead FAQPage JSON-LD; consolidate homepage schema into one `@graph`.
4. Externalize base64 icons; logo → WebP; icons → SVG (~40KiB + smaller HTML).
5. Organization schema: add legalName/address, encode LinkedIn URL, fix contactType.

---

## Category detail
Per-category findings with severities and fixes are in `findings/`:
- `findings/technical.md` (74) — headers, canonicals, OG, base64 icons, /solutions 404, preconnect
- `findings/content.md` (58) — thin content, E-E-A-T, own-expertise authority, incomplete legal identity
- `findings/schema.md` (61) — Service node, dead FAQPage, @graph consolidation, Organization fixes
- `findings/sitemap.md` (62) — changefreq/priority dead weight, static lastmod, coverage
- `findings/performance.md` (72) — mobile LCP, non-composited animations, unused JS, fonts
- `findings/geo.md` (52) — short FAQ answers, own-authority signals, long-form educational content gap

See `ACTION-PLAN.md` for the prioritized roadmap.

### Explicitly out of scope (per direction)
Competitor comparison / "alternatives" / "vs" pages · `/pricing` page · third-party testimonials / review-platform listings.
