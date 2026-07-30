# Technical SEO Audit — hakkiu.com
**Date:** 2026-07-30
**Scope:** Public marketing pages (/, /about, /contact, /solutions/law-firms, /solutions/brand-owners, /legal/*)
**Rendering:** Server-side rendered (TanStack Start + Cloudflare Workers via Caddy reverse proxy). `is_spa: false` confirmed across all pages.

---

## Overall Score: 74 / 100

| Category | Score | Status |
|---|---|---|
| Crawlability | 18/20 | Pass |
| Indexability | 14/20 | Partial |
| Security / HTTPS | 19/20 | Pass |
| URL Structure | 13/15 | Pass |
| Mobile | 9/10 | Pass |
| Core Web Vitals (lab signals) | 8/15 | Needs Work |
| **Total** | **74/100** | |

---

## What Works (Strengths)

- **HTTPS everywhere.** HTTP 308 permanent redirect to HTTPS at the Caddy layer. HSTS deployed with `max-age=63072000; includeSubDomains; preload` — preload-eligible configuration.
- **www canonicalization.** `www.hakkiu.com` issues a 301 to apex. No duplicate www/apex indexation risk.
- **Robots.txt is well-structured.** App routes (`/dashboard`, `/cases`, `/monitoring`, `/clients`, `/settings`, `/auth/`) are correctly disallowed. AI crawler tokens (GPTBot, ClaudeBot, OAI-SearchBot, PerplexityBot, Google-Extended) are explicitly permitted on public content.
- **Sitemap valid and declared.** `sitemap.xml` is linked in robots.txt, returns HTTP 200, validates as a well-formed urlset. 13 URLs, all using `https://hakkiu.com` canonical base.
- **Meta robots on all crawled pages.** Every page carries `index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1` — correct for a B2B SaaS marketing site.
- **No X-Robots-Tag conflicts.** HTTP headers do not emit any X-Robots-Tag that would shadow page-level meta robots.
- **Canonical tags present and self-referencing.** All 5 crawled pages have a `<link rel="canonical">` pointing to the correct canonical URL (no trailing slash variants, no www).
- **Security headers are strong.** CSP, Permissions-Policy, Referrer-Policy, X-Content-Type-Options, X-Frame-Options all set. No X-XSS-Protection (correct — deprecated and removed from Chrome).
- **Structured data is rich.** Homepage carries 4 JSON-LD blocks: Organization (with ContactPoint, ImageObject, WebSite), SoftwareApplication, FAQPage, WebPage. All parse as valid JSON.
- **Asset caching is correct.** JS/CSS bundles carry `cache-control: public, max-age=31536000, immutable` (content-hashed filenames). HTML carries `max-age=0, must-revalidate` which is correct for SSR pages.
- **All images have `loading="lazy"`.** Every `<img>` element on the homepage carries the `loading="lazy"` attribute, preventing off-screen images from blocking initial render.
- **Font preloads in place.** `sora-800.woff2` and `inter-400.woff2` are preloaded with `as="font" crossorigin="anonymous"`.
- **Trailing-slash redirect is consistent.** `/about/` issues a 301 to `/about`. No duplicate-content trailing-slash issue.
- **Mobile viewport meta set.** `<meta name="viewport" content="width=device-width, initial-scale=1"/>` present on all pages.
- **No Supabase JS on public pages.** The Lever A deferral is confirmed — no supabase.co requests appear in public page source, eliminating third-party connection overhead on marketing pages.

---

## Findings by Severity

### [HIGH] — Generic OG description on /contact and /about

**Pages affected:** `/contact`, `/about`

Both pages share the same `og:description`:
> "Monitor your trademarks, detect infringements, and automate takedowns across Amazon, Shopify, and the web."

This is the generic homepage OG description copy-pasted. When either URL is shared on LinkedIn, Slack, or other platforms that read Open Graph tags, the card body text is irrelevant to the page content. For a B2B SaaS targeting IP teams, LinkedIn previews are a meaningful referral channel.

**Fix:** Set page-specific `og:description` values:
- `/contact`: "Book a demo or reach the HAKKIU team — sales, privacy, security and legal contacts."
- `/about`: "HAKKIU is an EU-based brand-protection platform helping brand owners and law firms detect infringements and automate takedowns."

---

### [HIGH] — No `fetchpriority="high"` on LCP element

**Page:** `/` (and all solution pages)

The hero section's LCP candidate is rendered as text (the H1: "Protect your brand at internet speed.") backed by CSS — there is no above-the-fold `<img>` that is the LCP element. However, the main JS bundle (`index-DDmjMfKv.js`) is 649 KB uncompressed. Without a measured LCP from field data, the lab signal is concerning: 21 `<link rel="modulepreload">` hints are present in the `<head>`, which means the browser is hinting 21 JS chunks before it has completed parsing. This can delay the critical rendering path.

No image has `fetchpriority="high"`. If any hero image is confirmed as LCP via CrUX, add `fetchpriority="high"` and remove `loading="lazy"` from that specific element.

**Fix:** Run a real Lighthouse or CrUX lab test to confirm the LCP element. If it is a text node (likely), the bottleneck is render-blocking JS hydration. Consider splitting the modulepreload list to load only the critical above-the-fold chunk first.

---

### [HIGH] — 84 KB of base64-inlined images in HTML payload

**Page:** `/` (confirmed; likely affects all pages)

28 marketplace/platform logo images are embedded as base64 data URIs directly in the HTML, totalling approximately 84 KB of base64 text. This inflates the HTML payload delivered on first byte, delaying the browser's ability to begin parsing and rendering.

At 260 KB raw HTML (which gzip compresses well, but still), this is a meaningful overhead on mobile connections. These icons are `h-5 w-5` (20x20 px) logo thumbnails that could instead be served as:
- External `.png`/`.webp` files with immutable cache headers (already working for `/assets/shopify-CviJuviz.png`), or
- An SVG sprite sheet.

**Fix:** Extract all inline base64 logo images into versioned static assets. The Shopify logo already uses `/assets/shopify-CviJuviz.png` — apply the same pattern to all marketplace icons. This will reduce the HTML payload by ~84 KB and allow logos to be cached independently.

---

### [MEDIUM] — No `<link rel="preconnect">` for external origins

**Pages:** All public pages

The site loads resources from `fonts.googleapis.com`, `fonts.gstatic.com`, `www.googletagmanager.com`, and `www.google-analytics.com`. None of these origins have a `<link rel="preconnect">` or `<link rel="dns-prefetch">` hint in the `<head>`.

Preconnect hints allow the browser to establish TCP+TLS connections to these origins in parallel with HTML parsing, reducing the round-trip latency for the first resource from each origin. For Google Fonts, the gap between preconnect and no-preconnect is typically 100–300ms on median connections.

**Fix:** Add to `<head>` on all pages:
```html
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link rel="preconnect" href="https://www.googletagmanager.com"/>
```

---

### [MEDIUM] — /contact page title is thin (16 characters)

**Page:** `/contact`

Title: `Contact — HAKKIU` (16 characters).

While technically valid, this title provides no keyword signal and is well below the optimal 50–60 character range. Google will typically expand it in SERPs using on-page content, but that replacement is unpredictable. For a demo-request page that is the primary conversion point, the title should communicate the action.

**Fix:** `Book a Demo — HAKKIU Trademark Monitoring` (45 chars) or `Contact HAKKIU — Book a Brand Protection Demo` (46 chars).

---

### [MEDIUM] — /about page meta description is 167 characters (over recommended limit)

**Page:** `/about`

Meta description: 167 characters. Google's display limit is approximately 155–160 characters (depending on pixel width). The description will be truncated in SERPs, cutting off the end of the sentence: "...detect infringements and automate takedowns across marketplaces and the open web." The truncation occurs at "...across marketplaces and the open web" which removes the final qualifying phrase.

**Fix:** Trim to under 155 characters: "HAKKIU is an EU-based brand-protection platform that helps brand owners and law firms detect infringements and automate takedowns — built for IP teams." (151 chars).

---

### [MEDIUM] — /solutions route returns 404 (no index or redirect)

**URL:** `https://hakkiu.com/solutions`

Requesting the parent path `/solutions` (without a sub-path) returns HTTP 404. While neither `/solutions/law-firms` nor `/solutions/brand-owners` is linked from `/solutions` canonically, any inbound link or internal reference to the parent path will land on a 404. This also means Googlebot, if it encounters the parent path, will not be able to crawl it.

**Fix (Option A):** 301 redirect `/solutions` to `/solutions/brand-owners` (the higher-priority audience page) or to `/` if there is no sensible landing page.

**Fix (Option B):** Create a `/solutions` index page listing both audience verticals, which would also provide an internal linking hub.

---

### [MEDIUM] — No IndexNow implementation

IndexNow is supported by Bing, Yandex, and Naver. For a new domain with a small sitemap (13 URLs), IndexNow is the fastest mechanism to notify these engines of content updates. The site has no IndexNow key file, no sitemap ping endpoint configured for Bing Webmaster Tools, and no IndexNow JavaScript integration.

**Fix:** Generate an IndexNow key, place the key file at `https://hakkiu.com/<key>.txt`, and add the key meta tag to `<head>`:
```html
<meta name="indexnow-key" content="<your-key>"/>
```
Then POST to `https://api.indexnow.org/indexnow` on every deploy or content change.

---

### [LOW] — 21 modulepreload hints may be excessive

**Page:** `/` (all pages share the same bundle structure)

The `<head>` contains 21 `<link rel="modulepreload">` hints covering individual icon JS chunks (lock, search, sparkles, shield-check, file-text, etc.). While modulepreload is correct for ES modules, 21 simultaneous preloads can saturate HTTP/2 multiplexing on slower connections and may cause the browser to de-prioritize the critical render-blocking main bundle.

**Fix:** Limit explicit `modulepreload` to the 2–3 critical entry-point chunks (`index-DDmjMfKv.js`, `index-BIrFogIK.js`, `landing-nav-*`). Let the browser discover icon chunks lazily via dynamic import, which is their intended loading pattern. Vite's `build.rollupOptions.output.manualChunks` controls this grouping.

---

### [LOW] — CSP contains `unsafe-inline` in script-src

The Content-Security Policy allows `'unsafe-inline'` in `script-src`. This was noted as a deliberate trade-off (GTM requires it), but it meaningfully reduces the XSS protection CSP provides. Google Tag Manager supports deploying via a CSP-compatible nonce-based approach.

**Fix (long-term):** Migrate GTM to nonce-based loading. In the interim, document the deliberate decision. This is a security advisory, not a crawlability issue.

---

### [LOW] — No hreflang (note, not currently a gap)

No hreflang links are present. The site is English-only and targets a global B2B audience from an EU base. This is correct for now. Flag for when Lithuanian, German, or French market pages are added — at that point, hreflang on all language variants (including `x-default`) will be required.

---

### [LOW] — Sitemap missing /legal/security and /legal/imprint in changefreq cadence

Both `/legal/security` and `/legal/subprocessors` have `changefreq: monthly` which is appropriate given that subprocessors and security practices change. However, the sitemap lists 13 URLs but the sitemap count (13) does not match the stated "14 pages" in the audit brief. Verify that all live public routes are included.

---

## Core Web Vitals — Lab Signal Summary

| Signal | Lab Assessment | Risk |
|---|---|---|
| LCP | Cannot confirm without field data. HTML is SSR (good). Font preloads present. Main JS bundle is 649 KB raw / ~165 KB compressed. Risk from 21 modulepreloads and 84 KB inline b64 payload inflating TTFB-to-parse time. | Medium |
| INP | No JavaScript frameworks requiring hydration in the traditional SPA sense (SSR). However 8 inline `<script>` blocks and 21 module preloads suggest significant JS execution on load. INP impact depends on interaction handler registration timing. | Low-Medium |
| CLS | All 48 images carry `loading="lazy"` (good). Font preloads present (reduces FOUT). No explicit `width`/`height` on `<img>` elements — CLS stability relies entirely on Tailwind utility classes (`h-5 w-5`). This is acceptable as long as CSS loads before images. | Low |

**Recommendation:** Run a Lighthouse audit from a cold cache mobile simulation and a PageSpeed Insights field-data check once the domain accumulates sufficient CrUX data. The primary LCP and INP risks are the JS bundle size and the 84 KB inline-image HTML inflation.

---

## Structured Data Summary

| Block | Type | Valid | Notes |
|---|---|---|---|
| 1 | Organization, WebSite, ContactPoint, ImageObject, Person | Yes | Rich — includes employees, founding date, contact info |
| 2 | SoftwareApplication | Yes | applicationCategory, featureList populated |
| 3 | FAQPage (with Questions + Answers) | Yes | Long-form answers — eligible for FAQ rich results |
| 4 | WebPage | Yes | datePublished, dateModified, isPartOf WebSite |

No validation errors detected. The FAQ schema is the highest-value rich result opportunity — ensure the FAQ section is visible in the rendered HTML (it is, confirmed from SSR output).

---

## Redirect Chain Summary

| Request | Chain | Result |
|---|---|---|
| `http://hakkiu.com/` | 308 → `https://hakkiu.com/` | Pass (1 hop, permanent) |
| `https://www.hakkiu.com/` | 301 → `https://hakkiu.com/` | Pass (1 hop, permanent) |
| `https://hakkiu.com/about/` | 301 → `https://hakkiu.com/about` | Pass (1 hop, trailing slash removed) |
| `https://hakkiu.com/solutions` | — | 404 (issue — see HIGH finding) |
| `https://hakkiu.com/solutions/law-firms` | None | 200 Pass |
| `https://hakkiu.com/solutions/brand-owners` | None | 200 Pass |

No redirect chains longer than 1 hop. No redirect loops detected.

---

## Action Priority List

| Priority | Finding | Effort |
|---|---|---|
| 1 | Fix generic OG descriptions on /contact and /about | Low (config change) |
| 2 | Extract 28 base64 logos to static assets | Medium (build change) |
| 3 | Add preconnect hints for fonts.googleapis.com, gstatic.com, GTM | Low (1 line) |
| 4 | Add 301 redirect for /solutions → /solutions/brand-owners | Low (routing config) |
| 5 | Strengthen /contact page title | Low (config change) |
| 6 | Trim /about meta description to <155 chars | Low (config change) |
| 7 | Implement IndexNow for Bing/Yandex | Low-Medium |
| 8 | Reduce modulepreload hints to critical 3 chunks | Medium (Vite config) |
| 9 | Run Lighthouse mobile cold-cache to confirm LCP element and INP | Diagnostic |
