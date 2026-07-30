# Performance Audit — hakkiu.com

**Audit date:** 2026-07-30
**Tool:** PageSpeed Insights (Lighthouse 13.x) via `pagespeed_check.py`
**CrUX field data:** Unavailable — insufficient Chrome traffic volume for origin eligibility

---

## Scores (Lighthouse lab)

| Category        | Mobile | Desktop |
|-----------------|--------|---------|
| Performance     | 73     | 70      |
| Accessibility   | 97     | 97      |
| Best Practices  | 100    | 100     |
| SEO             | 100    | 100     |

---

## Core Web Vitals — Lab Data (no CrUX field data available)

| Metric | Mobile (lab) | Desktop (lab) | Threshold | Status |
|--------|-------------|---------------|-----------|--------|
| LCP    | 4.4 s       | 0.9 s         | ≤ 2.5 s   | FAIL mobile / PASS desktop |
| CLS    | 0           | ~0            | ≤ 0.1     | PASS both |
| INP    | N/A (lab)   | N/A (lab)     | ≤ 200 ms  | No field data |
| TBT (INP proxy) | 10 ms | 780 ms   | —         | Critical on desktop |
| FCP    | 4.1 s       | 0.8 s         | —         | Poor mobile |
| TTI    | 4.4 s       | 11.3 s        | —         | Critical desktop |
| Speed Index | 5.2 s  | 1.6 s        | —         | Poor mobile |

Note: CrUX returned 404 (no eligible field data). Lab data is from a single simulated Lighthouse
run on emulated mobile hardware. Desktop TBT/TTI numbers are severe due to animation-heavy JS
executing on an unconstrained desktop engine — these correlate directly with poor real-world INP
on desktop.

---

## What Works Well

- **CLS is 0** on mobile and near-zero (~0.0001) on desktop — excellent layout stability.
- **TTFB is ~27 ms** — server response is very fast (Cloudflare Workers edge delivery working).
- **Total page weight is reasonable** — 698 KiB mobile / 716 KiB desktop (passes Lighthouse byte-weight audit).
- **Fonts self-hosted with `font-display: swap`** — no render-blocking Google Fonts requests.
- **Critical fonts preloaded** — sora-800.woff2 and inter-400.woff2 are preloaded in `<head>` with correct `crossorigin` attribute.
- **H2 protocol** — all first-party assets served over HTTP/2.
- **SEO and Best Practices scores are 100** — no crawlability, meta, or canonical issues.

---

## Findings

### [CRITICAL] LCP 4.4 s on mobile (threshold: 2.5 s)

Mobile LCP is in the "Poor" band (>4.0 s). This is the single most important metric to fix.

**Root causes identified:**

1. **Render-blocking CSS — `styles-C7j1Xtlp.css` (est. 1,350 ms savings on mobile)**
   The main stylesheet (27.7 KiB compressed / 165 KiB uncompressed) is loaded as a blocking
   `<link rel="stylesheet">` from `__root.tsx`. Lighthouse flags this as a render-blocking
   request worth ~1,350 ms on mobile. On desktop it is flagged but the savings estimate is not
   quantified (the render path is faster). The CSS is loaded via `import appCss from
   "../styles.css?url"` and injected as `{ rel: "stylesheet", href: appCss }` — there is no
   critical-CSS extraction or async loading.

2. **Network dependency chain depth**
   HTML → CSS + JS (parallel) → fonts (discovered only after CSS parses). Even with the two
   font preloads in `<head>`, the remaining 12 font faces (inter-500/600/700, sora-500/600/700,
   hanken-grotesk ×4, jetbrains-mono ×2) are not preloaded and are discovered late. 9 font
   requests total were recorded in the mobile run, transferring 291 KiB — the largest single
   resource category after scripts.

3. **Large main JS bundle — `index-DDmjMfKv.js` (200 KiB compressed / 650 KiB uncompressed)**
   This file has 104 KiB of unused JavaScript on initial load. On desktop this file's total
   main-thread execution time is 2,462 ms. It fires long tasks at 4,051 ms startTime
   (duration 57 ms) on mobile — this is what keeps LCP element render delayed.

4. **`landing-nav-hV8l8F4p.js` — 42 KiB compressed, 30 KiB unused**
   On desktop this file accounts for 8,993 ms of total main-thread time (dominated by animation
   loops and the reveal/sheen animation system). Combined with index-DDmjMfKv.js, these two
   bundles drive 13.5 s of main-thread work on desktop — directly explaining the 11.3 s TTI
   and the 780 ms TBT (strong INP risk on desktop).

---

### [HIGH] TBT 780 ms on desktop — INP risk

Total Blocking Time of 780 ms on desktop is a direct proxy for poor INP. Long tasks from
`landing-nav-hV8l8F4p.js` (20 long tasks flagged, worst 78 ms at 6,228 ms startTime) and
`index-DDmjMfKv.js` dominate. The "Other" main-thread work category is 10,869 ms on desktop —
an abnormally high figure suggesting the CSS animation system (`hakkiu-sheen`, `animate-rainbow`,
`::before` pseudo-element animations) is triggering continuous style recalculation and rendering
work outside of script evaluation time.

Lighthouse also flagged **forced reflow** — JavaScript is querying geometric properties
(`offsetWidth` or equivalent) after DOM mutations, causing synchronous layout operations that
block the main thread.

---

### [HIGH] Non-composited animations (11 instances)

Eleven animation elements are flagged as non-composited. These run on the CPU main thread instead
of the GPU compositor thread, meaning they block interaction response. Elements identified:

- `.hakkiu-sheen` span (hero section)
- `button.group` CTA buttons (multiple: header, hero, FAQ) — `animate-rainbow` or similar CSS
  class applied to `::before` pseudo-elements
- `hakkiu-reveal-up` div

Non-composited animations should use only `transform` and `opacity` (or `will-change: transform`)
to promote to the compositor thread.

---

### [MEDIUM] Unused JavaScript — 131 KiB (est. 600 ms savings mobile)

| File | Total | Unused |
|------|-------|--------|
| `index-DDmjMfKv.js` | 203 KiB | 104 KiB (51%) |
| `landing-nav-hV8l8F4p.js` | 42 KiB | 30 KiB (72%) |

72% of the landing-nav bundle is unused on initial render. This suggests the navigation
component loads the full interactive app shell eagerly, even on the public marketing homepage
where most authenticated routes are never activated.

---

### [MEDIUM] Image delivery — 28–43 KiB savings

| Image | Total | Wasted | Issue |
|-------|-------|--------|-------|
| `hakkiu-lockup.png` | 26.5 KiB | 18 KiB | PNG, no modern format (WebP/AVIF), oversized for display dimensions |
| `shopify-CviJuviz.png` | 5.8 KiB | 5.6 KiB | Displayed at 20×20 px, full-size PNG served |
| `instagram-B7iiNZkf.png` | 5.2 KiB | 5.0 KiB | Same — 20×20 display, full-res PNG |
| `web-domain-BAsk2Wgw.png` | 6.1 KiB | 6.0 KiB | Same — 20×20 display |
| `meta-DrKtt3uR.png` | 4.9 KiB | 4.8 KiB | Same — 20×20 display |

The logo lockup (`hakkiu-lockup.png`) is the highest-value target: 18 KiB savings available by
converting to WebP or AVIF and serving it at the correct intrinsic size. The platform icon PNGs
(shopify, instagram, meta, web-domain) are each serving a full-resolution image for a 20×20 px
display slot — these should be served at 20–40 px (2× for retina) as SVG or 20×20 WebP.

---

### [LOW] Excess font weight — 291 KiB fonts per page load

14 font files are defined in `@font-face` rules across 4 families (Inter, Sora, Hanken Grotesk,
JetBrains Mono). The mobile run recorded 9 font requests totalling 291 KiB. Hanken Grotesk (4
weights) and JetBrains Mono appear to be used in the app dashboard, not on the marketing homepage.
If these are loaded on every page including the public landing page (driven by the single shared
`styles.css`), they represent dead weight on marketing pages.

Only `sora-800.woff2` and `inter-400.woff2` are preloaded. The remaining 12 faces are discovered
after CSS parse — adding preloads for the next most-used faces (inter-500, inter-600, sora-700)
or subsetting to Latin-only unicode ranges would reduce font payload.

---

## Prioritised Recommendations

**Priority 1 — Fix mobile LCP (from 4.4 s to under 2.5 s)**

1. **Extract and inline critical CSS** for above-the-fold content. The full `styles.css`
   (165 KiB uncompressed) is render-blocking for 1,350 ms on mobile. Inline ~5–10 KiB of
   critical path CSS (typography, hero layout, header) directly in `<head>` and load the rest
   asynchronously (`<link rel="stylesheet" media="print" onload="this.media='all'">`). Estimated
   LCP improvement: 800–1,200 ms on mobile.

2. **Fix non-composited animations** — audit every `animate-*` and `hakkiu-*` CSS class that
   touches properties other than `transform`/`opacity`. Add `will-change: transform` to elements
   using `::before` sheen effects. Expect a reduction in the 10,869 ms "Other" main-thread
   category on desktop.

3. **Convert logo to WebP/AVIF** — replace `hakkiu-lockup.png` with a WebP version at the
   correct intrinsic size. Use `<picture>` with AVIF + WebP + PNG fallback. ~18 KiB saving.

**Priority 2 — Reduce INP risk (desktop TBT 780 ms)**

4. **Code-split `landing-nav-hV8l8F4p.js`** — 30 KiB (72%) is unused on load. Split the
   animation/interaction logic from the static nav markup so the initial parse is minimal.
   Use dynamic `import()` for scroll-triggered effects or anything below the fold.

5. **Investigate forced reflow** in the animation system. Profile in Chrome DevTools Performance
   panel; look for `getBoundingClientRect`, `offsetWidth`, or `scrollTop` reads interleaved with
   DOM writes inside the sheen/reveal animation RAF loops.

6. **Replace platform icon PNGs with SVGs** — the shopify, instagram, meta, and web-domain
   icons are displayed at 20×20 px. Inline SVGs or a sprite eliminates 4 HTTP requests and
   ~22 KiB of wasted bytes.

**Priority 3 — Font loading**

7. **Add `unicode-range: U+0000-00FF` (Latin subset)** to all `@font-face` declarations.
   Full-range woff2 files are being served; subsetting to Basic Latin cuts each file by ~30–40%.

8. **Audit Hanken Grotesk and JetBrains Mono usage on marketing pages** — if these families are
   only used in the authenticated dashboard, split them into a separate CSS chunk that is only
   loaded on app routes, not on the public landing page.

---

## Evidence Summary

- PSI mobile performance score: **73/100**
- PSI desktop performance score: **70/100**
- Mobile LCP lab: **4.4 s (Poor)**
- Desktop LCP lab: **0.9 s (Good)**
- CLS: **0 / ~0 (Good, both)**
- Desktop TBT: **780 ms (Poor — INP risk)**
- Main-thread work desktop: **13.5 s total**
- Render-blocking CSS savings: **~1,350 ms mobile**
- Unused JS: **131 KiB across 2 bundles**
- Font payload: **291 KiB (9 requests)**
- CrUX field data: **not available** (insufficient traffic)
- TTFB: **27 ms (Excellent)**
- Server backend latency: **1–4 ms (Excellent)**
