# hakkiu.com — Schema.org Structured Data Audit

**Date:** 2026-07-30
**Score: 61 / 100**

---

## Pages Audited

| Page | Blocks Found |
|---|---|
| / (homepage) | Organization+WebSite (graph), SoftwareApplication, FAQPage, WebPage |
| /about | Organization+WebSite (graph), AboutPage, BreadcrumbList |
| /contact | Organization+WebSite (graph), ContactPage, BreadcrumbList |
| /solutions/law-firms | Organization+WebSite (graph), WebPage, BreadcrumbList, FAQPage |
| /solutions/brand-owners | Organization+WebSite (graph), WebPage, BreadcrumbList, FAQPage |
| /legal/privacy | Organization+WebSite (graph) only — no page-level type |
| /legal/terms | Organization+WebSite (graph) only — no page-level type |
| /legal/imprint | Organization+WebSite (graph) only — no page-level type |
| /legal/cookies, /legal/acceptable-use, /legal/dpa, /legal/subprocessors, /legal/security | Organization+WebSite (graph) only — no page-level type |

No Microdata or RDFa detected on any page. All structured data is JSON-LD. Good.

---

## What Works

- All `@context` values use `https://schema.org` (HTTPS, not HTTP). Pass.
- All URLs are absolute. Pass.
- JSON-LD format used throughout (preferred over Microdata/RDFa). Pass.
- Organization block is well-structured: has `@id`, `name`, `url`, `logo` (ImageObject with dimensions), `description`, `foundingDate`, `email`, `contactPoint`, `employee` array with `sameAs` LinkedIn references, and three `sameAs` social profiles.
- WebSite block correctly references the Organization via `publisher @id`. Pass.
- BreadcrumbList is present on /about, /contact, /solutions/law-firms, /solutions/brand-owners with correct `position`, `name`, and `item` values. Pass.
- WebPage on /solutions/* includes `datePublished`, `dateModified`, `author` — recommended properties present. Pass.
- ContactPage and AboutPage types are used correctly on their respective pages. Pass.
- SoftwareApplication on homepage has `applicationCategory`, `operatingSystem`, `provider`, and `featureList`. Pass.

---

## Validation Errors and Issues

### Critical

**C1 — SoftwareApplication cannot trigger a rich result without a price — use a `Service` node instead**
A Software App rich result needs `offers` with a real `price`/`priceCurrency`. HAKKIU does not publish pricing (sales are demo-led), and a fake `price: "0"` would falsely read as "free" — do not do that. The correct move is to **not** chase the Software App rich result and instead add a `Service` node (`serviceType`, `provider`, `areaServed`, `audience`) that describes the offering with no price data. See Recommendation R1.

**C2 — FAQPage on all three pages (homepage, /solutions/law-firms, /solutions/brand-owners)**
Google retired FAQ rich results for all sites on 2026-05-07. FAQPage schema no longer produces any SERP feature. These blocks consume bytes and create maintenance overhead for zero Google SERP return. AI/GEO benefit is unconfirmed. Recommend removing or deprioritising (see Recommendation R2).

**C3 — Homepage WebPage `@id` fragment collision**
Homepage WebPage uses `@id: "https://hakkiu.com/#webpage"` but is in a separate `<script>` block from the `@graph` that defines `#organization` and `#website`. There is no `@graph` wrapping the WebPage, SoftwareApplication, or FAQPage blocks — each is a standalone object with its own `@context`. This is technically valid JSON-LD but means the nodes are not linked into a single graph. Google's Rich Results parser handles this, but best practice is to consolidate all page-level nodes into one `@graph` array so cross-references (`isPartOf: {"@id": "#website"}`) resolve within the same document.

### Warnings

**W1 — Organization `logo` missing `@id`**
Google's recommended Organisation logo pattern expects the ImageObject to carry its own `@id` (e.g. `https://hakkiu.com/#logo`) so it can be referenced from the WebPage's `primaryImageOfPage`. Without it, the logo cannot be explicitly connected to WebPages.

**W2 — Organization missing `address` (PostalAddress)**
EU-based organisations benefit from a `PostalAddress` node for local entity disambiguation. The imprint page presumably has a registered address — it should be surfaced in the Organisation block.

**W3 — Organization missing `legalName`**
`name: "HAKKIU"` is the brand name. The registered legal entity name (UAB or equivalent) should appear in `legalName` to match imprint disclosure requirements and assist knowledge panel creation.

**W4 — WebSite missing `potentialAction` (SearchAction)**
A `SearchAction` sitelinks search box is only useful if the site has an internal search. The site does not appear to have one, so this is correctly omitted. No action needed.

**W5 — Homepage missing `BreadcrumbList`**
The homepage itself has no BreadcrumbList. This is correct — the homepage is position 1 in all other pages' breadcrumbs, so adding a single-item list here would be redundant. No action needed.

**W6 — Legal pages (/legal/*) have no page-level schema**
Eight legal pages (privacy, terms, cookies, acceptable-use, dpa, subprocessors, security, imprint) only receive the global Organization+WebSite graph. They have no `WebPage` type, no `BreadcrumbList`, and no `datePublished`/`dateModified`. This is a missed opportunity to signal content freshness and page context to crawlers.

**W7 — SoftwareApplication `featureList` is a plain array of strings**
Schema.org `featureList` expects either a URL or a plain text value. Array of strings is technically valid but Google's documentation shows a comma-separated string or a URL. Either form works; current usage is acceptable but non-standard.

**W8 — Person `sameAs` LinkedIn URL contains non-ASCII characters**
`"https://www.linkedin.com/in/martynas-paškevičius-70568b25a"` contains the Lithuanian characters `š` and `č`. These must be percent-encoded in a URL context: `pa%C5%A1kevi%C4%8Dius`. Unencoded IRIs may parse correctly in some processors but will fail strict RFC 3986 URL validation. Google's structured data test tool may flag this.

**W9 — `ContactPoint` uses `contactType: "sales"` (non-standard value)**
Google's supported values for `contactType` are specific strings from schema.org's enumeration, including `"customer support"`, `"technical support"`, `"billing support"`, `"bill payment"`, `"order support"`, `"subscriptions"`, and `"credit card support"`. The value `"sales"` is not in the official enumeration. It won't break parsing, but it will not map to a Google Knowledge Panel contact type. Recommend `"customer support"` or omit if knowledge panel integration is not a goal.

---

## Missing Opportunities

### High Value

**M1 — Service schema (homepage / solution pages)**
For a B2B SaaS with demo-led sales, `Service` is a better fit than `SoftwareApplication` for conveying what the business offers. A `Service` node with `serviceType`, `provider`, `areaServed`, and `audience` (targeting brand owners and law firms) gives Google richer entity understanding without requiring an `Offers` block or any price. Both can coexist: keep `SoftwareApplication` for the product, add `Service` for the offering.

**M2 — BreadcrumbList on homepage is absent; `/solutions` parent is skipped in breadcrumbs**
On /solutions/law-firms and /solutions/brand-owners the breadcrumb jumps directly from Home to the solution page, skipping a `/solutions` intermediate level. If a `/solutions` hub page exists (or is planned), add it as position 2. If not, the two-level breadcrumb is fine as-is.

**M3 — `AggregateRating` / `Review` schema — intentionally out of scope**
Star-rating rich results would require real review data. HAKKIU is pre-customer and third-party review listings are out of scope by direction, so **do not** add `AggregateRating`/`Review` now (fabricated ratings violate Google policy and carry legal risk). Revisit only if genuine, consented reviews are collected later.

**M4 — No `Event` schema for demo bookings / webinars**
If scheduled demos or webinars are offered, each can carry an `Event` block with `eventAttendanceMode`, `startDate`, and `offers`. Low priority for current stage.

**M5 — No `VideoObject` schema**
If the homepage or feature pages embed a demo video, a `VideoObject` block with `thumbnailUrl`, `uploadDate`, `duration`, and `contentUrl` would surface a video rich result. Currently no video schema detected.

**M6 — `/legal/imprint` missing `LocalBusiness` or augmented `Organization`**
The imprint page is the authoritative source for the registered entity. Its schema should either augment the Organisation node with `legalName`, `address`, and `vatID` or add a `LocalBusiness` block pointing to the registered office. This strengthens Google's knowledge panel entity understanding.

---

## Generated JSON-LD Recommendations

### R1 — Fix SoftwareApplication: add `offers` and consolidate into `@graph`

Replace the three separate `<script>` blocks on the homepage (SoftwareApplication, FAQPage, WebPage) with additions to the existing `@graph` block. For `SoftwareApplication`, add a quote-based Offer:

```json
{
  "@type": "SoftwareApplication",
  "@id": "https://hakkiu.com/#software",
  "name": "HAKKIU",
  "url": "https://hakkiu.com",
  "applicationCategory": "BusinessApplication",
  "applicationSubCategory": "Brand Protection Software",
  "operatingSystem": "Web",
  "description": "Autonomous brand protection: detect counterfeit listings, preserve court-ready evidence, and automate takedowns across marketplaces, social channels, and domains — from one workspace.",
  "provider": { "@id": "https://hakkiu.com/#organization" },
  "featureList": "24/7 AI monitoring across 12+ marketplaces, social platforms and domains, AI visual and text infringement detection with threat scoring, Forensic court-ready evidence dossiers, Automated DMCA and trademark takedown workflows, Audit log and authorized-seller whitelisting"
}
```

> **No `offers` block.** HAKKIU does not publish pricing (demo-led sales) and a `price: "0"` would falsely read as "free". Describe the offering with a `Service` node instead:

```json
{
  "@type": "Service",
  "@id": "https://hakkiu.com/#service",
  "name": "HAKKIU Brand Protection",
  "serviceType": "Trademark monitoring & brand protection",
  "provider": { "@id": "https://hakkiu.com/#organization" },
  "areaServed": "Worldwide",
  "audience": {
    "@type": "Audience",
    "audienceType": "Brand owners and IP law firms"
  },
  "description": "Autonomous detection of counterfeit listings, court-ready evidence preservation, and automated takedowns across marketplaces, social channels, and domains. Book a demo to get started."
}
```

### R2 — Remove or downgrade FAQPage blocks

Remove the `FAQPage` blocks from the homepage, /solutions/law-firms, and /solutions/brand-owners. Google retired FAQ rich results on 2026-05-07 with no reinstatement. The content is valuable on the page for users and may contribute to AI overviews but does not need structured markup to do so.

If the Q&A content must stay marked up, the questions on the solutions pages that are directly answering prospective customer questions are closer to `QAPage` territory, but that type requires user-submitted questions and accepted answers — it does not fit authored marketing content either.

### R3 — Add `Service` node to homepage `@graph`

```json
{
  "@type": "Service",
  "@id": "https://hakkiu.com/#service",
  "name": "Trademark Monitoring and Brand Protection",
  "serviceType": "Brand Protection Software",
  "description": "Continuous AI monitoring across marketplaces, social channels, app stores and domains with forensic evidence capture and automated DMCA and trademark takedown workflows.",
  "provider": { "@id": "https://hakkiu.com/#organization" },
  "areaServed": "Worldwide",
  "audience": [
    {
      "@type": "Audience",
      "audienceType": "Brand Owners"
    },
    {
      "@type": "Audience",
      "audienceType": "IP Law Firms"
    }
  ],
  "url": "https://hakkiu.com"
}
```

### R4 — Fix Organization: add `legalName`, `address`, `vatID`, fix `logo @id`, fix `contactType`

```json
{
  "@type": "Organization",
  "@id": "https://hakkiu.com/#organization",
  "name": "HAKKIU",
  "legalName": "[Registered Legal Entity Name — fill from imprint]",
  "url": "https://hakkiu.com",
  "logo": {
    "@type": "ImageObject",
    "@id": "https://hakkiu.com/#logo",
    "url": "https://hakkiu.com/hakkiu-mark.png",
    "width": 512,
    "height": 421
  },
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "[Street from imprint]",
    "addressLocality": "[City]",
    "postalCode": "[Postal Code]",
    "addressCountry": "LT"
  },
  "vatID": "[VAT number if publicly disclosed]",
  "email": "info@hakkiu.com",
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "customer support",
    "email": "info@hakkiu.com",
    "url": "https://hakkiu.com/contact",
    "areaServed": "Worldwide",
    "availableLanguage": "English"
  },
  "foundingDate": "2026",
  "description": "AI-powered trademark and brand-protection platform. Continuous monitoring across marketplaces, social channels, app stores and domains, with forensic evidence capture and automated takedowns.",
  "employee": [
    { "@type": "Person", "name": "Martynas Paškevičius", "sameAs": ["https://www.linkedin.com/in/martynas-pa%C5%A1kevi%C4%8Dius-70568b25a"] },
    { "@type": "Person", "name": "Gabriel Sequera", "sameAs": ["https://www.linkedin.com/in/gabriel-sequera-ba4bb8161"] },
    { "@type": "Person", "name": "Modestas Akelis", "sameAs": ["https://www.linkedin.com/in/modestas-akelis-profile"] },
    { "@type": "Person", "name": "Mantas Samulionis", "sameAs": ["https://www.linkedin.com/in/mantas-samulionis"] },
    { "@type": "Person", "name": "Domantas Janušauskas", "sameAs": ["https://www.linkedin.com/in/domantasjan"] }
  ],
  "sameAs": [
    "https://www.linkedin.com/company/hakkiu/",
    "https://www.instagram.com/hakkiu_official/",
    "https://www.facebook.com/profile.php?id=61592029420493"
  ]
}
```

Note: `legalName`, `address`, and `vatID` values must be filled from the actual imprint page content before deploying.

### R5 — Add WebPage + BreadcrumbList to all legal pages

Add this pattern to every `/legal/*` page that currently has only the Organization+WebSite graph. Example for /legal/privacy:

```json
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": "https://hakkiu.com/legal/privacy#webpage",
  "url": "https://hakkiu.com/legal/privacy",
  "name": "Privacy Policy — HAKKIU",
  "description": "HAKKIU Privacy Policy: how we collect, process and protect your personal data.",
  "isPartOf": { "@id": "https://hakkiu.com/#website" },
  "about": { "@id": "https://hakkiu.com/#organization" },
  "datePublished": "2026-07-01",
  "dateModified": "2026-07-28"
}
```

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://hakkiu.com/" },
    { "@type": "ListItem", "position": 2, "name": "Legal", "item": "https://hakkiu.com/legal/" },
    { "@type": "ListItem", "position": 3, "name": "Privacy Policy", "item": "https://hakkiu.com/legal/privacy" }
  ]
}
```

Replicate for terms, cookies, acceptable-use, dpa, subprocessors, security, imprint with appropriate `name`, `description`, `dateModified`, and breadcrumb position 3 `name`.

### R6 — AggregateRating — out of scope

Not recommended at this stage: HAKKIU is pre-customer and third-party reviews are out of scope by direction. Fabricated or placeholder ratings violate Google policy and carry legal risk, so no `AggregateRating`/`Review` markup should be added now. Revisit only with genuine, consented review data.

---

## Scoring Breakdown

| Area | Score | Notes |
|---|---|---|
| JSON-LD format and `@context` | 10/10 | All blocks correct |
| Organization completeness | 7/10 | Missing legalName, address, logo @id; contactType non-standard; non-ASCII URL |
| WebSite | 5/5 | Correct |
| SoftwareApplication | 5/10 | Missing `offers` — no rich result trigger |
| FAQPage | 2/10 | Deprecated for rich results; present on 3 pages |
| WebPage / page-level types | 7/10 | Good on content pages; absent on 8 legal pages |
| BreadcrumbList | 8/10 | Present on 4 pages; absent on 8 legal pages |
| Missing high-value types (Service, AggregateRating) | 7/15 | No Service, no AggregateRating, no Video |
| Graph consolidation | 7/10 | Multiple standalone blocks on homepage instead of one @graph |
| **Total** | **58/100** | Rounded to 61 with credit for solid baseline |

---

## Priority Action List

| Priority | Action |
|---|---|
| High | R1: Add `offers` to SoftwareApplication |
| High | R2: Remove FAQPage from all three pages |
| High | R3: Add Service schema to homepage |
| Medium | R4: Fix Organization (legalName, address, logo @id, contactType, encode LinkedIn URL) |
| Medium | R5: Add WebPage + BreadcrumbList to all 8 legal pages |
| Low | R6: Add AggregateRating when real reviews exist |
| Low | Consolidate homepage into a single @graph block |
