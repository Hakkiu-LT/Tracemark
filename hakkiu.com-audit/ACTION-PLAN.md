# HAKKIU — SEO Action Plan

**Constraints honored:** no competitor-comparison content (legal risk), no pricing page (demo/meeting-led sales), no third-party testimonials yet (pre-customers). Everything below is achievable within those rules.

Ordered Critical → Ongoing. Each item notes effort + why.

## 🔴 Critical (Week 1) — technical health
- **Fix mobile LCP 4.4s → <2.5s.** Inline ~5–10KiB above-the-fold CSS and async-load the 165KiB stylesheet; preload only above-fold fonts; scope dashboard-only fonts (Hanken Grotesk, JetBrains Mono) out of the marketing bundle. *Why:* mobile LCP is the single largest Core Web Vitals failure and hurts both rankings and real users. Effort: ~1 day.
- **Fix `/solutions` parent 404** (add an index page or 301 to a child). *Why:* crawl dead-end on a linked hub. Effort: <1h.
- **Remove the dead FAQPage JSON-LD** from all 3 pages (Google retired FAQ rich results 2026-05-07) and **consolidate the homepage's 4 JSON-LD blocks into one `@graph`** so cross-references resolve. *Why:* deletes markup that no longer does anything and makes the remaining schema coherent. Effort: 1–2h. Keep the visible FAQ text — only the markup goes.
- **Add unique `og:description` (and titles) to `/about` and `/contact`.** *Why:* both currently inherit the homepage copy, so link previews show the wrong text. Effort: 15 min.

## 🟠 High (Weeks 2–3) — performance + schema quality
- **Externalize the 28 base64-inlined icons; convert logo PNG → WebP/AVIF; replace 20×20 platform icons with inline SVG.** *Why:* ~40KiB saved + ~84KiB smaller HTML payload → faster first paint. Effort: 2–3h.
- **Fix desktop interactivity (TBT 780ms).** Code-split `landing-nav` JS (72% unused), make the 11 animations GPU-composited (`will-change: transform`), remove the forced reflow. *Why:* desktop INP risk. Effort: ~1 day.
- **Improve the Organization schema:** add `legalName` + `address` (PostalAddress), switch `contactType` "sales" → "customer support", percent-encode the non-ASCII LinkedIn URL. *Why:* knowledge-panel quality + valid markup. Effort: 30 min.
- **Replace the `offers`-less SoftwareApplication gap with a `Service` node** (`serviceType`, `provider`, `areaServed`, `audience`) instead of adding a price. *Why:* a `Service` conveys the offering to Google without any pricing data — the right fit for demo-led sales. Effort: 30 min.
- **Fill the real legal entity on `/legal/imprint`** (legalName, registered address, VAT/registration no.) and mirror into Organization schema. *Why:* Trust signal for IP-lawyer buyers + EU compliance; `company.ts` currently has placeholders. Effort: 1h (needs the real facts).
- **Add `WebPage` + `BreadcrumbList` to the 8 `/legal/*` pages** and a `preconnect` for Google Fonts + GTM. *Why:* breadcrumb eligibility, freshness signals, one fewer round-trip. Effort: 1–2h.

## 🟡 Medium (Month 2) — content & authority (rules-safe)
- **Launch an educational resource hub / blog** with *informational* long-form pages — e.g. "How to file a trademark takedown on Amazon", "What evidence a UDRP complaint needs", "How perceptual image hashing detects counterfeits". Purely educational, **no competitor names or comparisons**. *Why:* the site is ~350 words/page; this is the only rules-safe lever for non-branded organic traffic and AI citations, and it showcases your own expertise. Effort: ongoing.
- **Expand FAQ answers to ~130–160 words each** (keep the direct answer first, then add one concrete example + one process detail + one outcome). *Why:* current answers (39–62 words) are too short for AI Overviews / Perplexity to cite. Effort: half a day.
- **Add author bylines + publish/updated dates** to resource content. *Why:* real named experts are your strongest E-E-A-T asset (you already have 5 named team members with LinkedIn profiles). Effort: baked into the hub.
- **Create a neutral company profile on Crunchbase** (facts only — founding, team, product; not a review/comparison listing). *Why:* a rules-safe third-party existence signal for AI systems and knowledge panels. Effort: 1–2h.

## 🟢 Low / Ongoing
- **Connect Google Search Console + GA4** (OAuth) — unlocks field Core Web Vitals, indexation status, and organic traffic data (currently unavailable). *Why:* you can't measure what you can't see.
- **Add IndexNow** ping on deploy; **build-stamp sitemap `lastmod`**; **strip `changefreq`/`priority`** (ignored by Google). Effort: small.
- Add `fetchpriority=high` to the LCP image; add font `unicode-range` Latin subsets.
- Re-run this audit monthly; watch for CrUX field data once traffic qualifies.

---

### Explicitly dropped per your direction
- ❌ Competitor comparison / "alternatives" / "vs" pages — legal risk.
- ❌ `/pricing` page — sales are demo/meeting-led.
- ❌ Third-party testimonials / G2 / Capterra review listings — no customers yet (revisit once you do, using your own case studies with consent).
