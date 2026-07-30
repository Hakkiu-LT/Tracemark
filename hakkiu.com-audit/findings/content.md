# HAKKIU Content Quality & E-E-A-T Audit
**Scope:** hakkiu.com / /about / /solutions/law-firms / /solutions/brand-owners
**Date:** 2026-07-30
**Auditor:** Content Quality skill (Google September 2025 QRG model)
**Source:** Source files (TanStack Start SPA — content extracted directly from route/component TSX)

---

## Overall Content Quality Score: 58 / 100

The site has strong structural SEO hygiene (schema, canonical, robots.txt, llms.txt) and a
clearly differentiated product story. Its primary content weaknesses are a very thin word count
on every page versus category minimums, total absence of third-party authority signals (no
customer quotes, case studies, press coverage, or named credentials), and legal identity
information that is explicitly incomplete — a critical Trustworthiness gap for a B2B SaaS
selling to IP lawyers.

---

## E-E-A-T Breakdown

### Experience — 28 / 100 (weight: 20%)

**What exists:**
- A 5-person named team with real LinkedIn profiles and real headshot photos on /about.
- The founding year (2026) is stated — the product is genuinely new.
- The brand-exposure calculator provides interactive, use-case-specific content that implies
  hands-on product thinking.
- FAQ answers on the homepage and solution pages contain technical specificity (perceptual image
  hashing, SHA-256 timestamps, UDRP complaints, edit-distance fuzzy matching) that signals
  builders who have done this.

**What is missing:**
- No worked examples showing enforcement outcomes (these can use your own product/demo data — no customer required).
- No "built by practitioners" narrative — the team section lists names and LinkedIn links but
  no roles, professional backgrounds, or domain credentials (IP law, enforcement operations,
  marketplace compliance).
- No blog, changelog, or content archive showing the product operating over time.
- No screenshots or recordings of the actual product in use (the "product window" in the
  hero is a decorative mock, not real UI).

**Finding [SEVERITY: HIGH]:** Few first-hand experience signals. Since HAKKIU is pre-customer,
lean on signals you can produce yourself: a worked example using your own product/demo data
("how HAKKIU detected and removed a spoofed listing, step by step"), founder-authored "how we
built X" posts, and named team credentials (IP law, enforcement ops). Customer case studies
come later — only with a consenting client. Do not fabricate testimonials or outcomes.

---

### Expertise — 44 / 100 (weight: 25%)

**What exists:**
- Technical accuracy throughout: the detection pipeline is described correctly (tiered funnel:
  keyword/typosquat → perceptual hash → vision-language model). No invented claims.
- Responsible epistemic stance: the site correctly labels the exposure calculator output as
  "directional, not a measurement of actual losses."
- FAQ answers are substantively correct on DMCA mechanics, UDRP process, SHA-256 evidence
  preservation, and marketplace-specific reporting paths (Amazon VeRO, eBay VeRO programme).
- Use of `<details>`/`<summary>` for the FAQ (rather than a JS accordion) is a deliberate,
  expert SEO decision documented in source comments — keeping collapsed answers in server HTML
  for crawler and LLM passage extraction.
- The llms.txt file is well-structured and accurate, demonstrating AI-era SEO awareness.

**What is missing:**
- No named author attribution anywhere. No team member is associated with a specific piece of
  content. Google's QRG specifically looks for author pages and credentials on YMYL-adjacent
  content (legal processes, evidence standards).
- Team members have no titles or domain credentials listed — impossible to assess whether the
  team has IP enforcement, legal tech, or marketplace compliance expertise from the public page.
- No external expertise signals: no industry body memberships (e.g. INTA — International
  Trademark Association), no conference presentations, no published research or white papers.

**Finding [SEVERITY: HIGH]:** Add job titles and 1-2 sentence role descriptions to team
members on /about. Even "formerly at X marketplace platform" or "IP litigation background"
dramatically changes the Expertise signal for a prospect evaluating legal-workflow software.

**Finding [SEVERITY: MEDIUM]:** Create at least one piece of genuinely expert content — a
guide to UDRP complaints, a breakdown of how Amazon Brand Registry enforcement works, or an
explainer on what makes evidence court-admissible. Keep it educational (no competitor
comparisons). This category of content earns links, demonstrates expertise, and gives AI
systems citable facts to surface.

---

### Authoritativeness — 22 / 100 (weight: 25%)

**What exists:**
- LinkedIn company page and social profiles linked from footer.
- Canonical tags and structured data (Organization, SoftwareApplication, FAQPage, WebPage
  schemas) are correctly implemented and internally consistent.
- The /about page links to the legal/security, legal/privacy, and legal/dpa pages — building
  an internal authority network around the company.
- llms.txt with preferred citation text positions HAKKIU clearly for AI answer engines.

**What is missing:**
- No third-party citations, press coverage, analyst mentions, or external links pointing to
  HAKKIU. The site is an island.
- No partner badges or industry membership marks (e.g. INTA) — rules-safe once obtained.
- A neutral company profile (e.g. Crunchbase — facts only, not a review/comparison listing).
- The Organization schema has no `sameAs` array linking to verified external profiles
  (LinkedIn company page, Crunchbase, etc.).
- Founded 2026 = a very new company. Authoritativeness takes time to build, but the site does
  nothing to accelerate it even modestly (e.g., INTA membership badge, an EU trademark
  registry partner statement, a guest post on an IP law blog).

**Finding [SEVERITY: HIGH]:** Add `sameAs` to the Organization JSON-LD pointing to the
LinkedIn company page, Crunchbase profile, and any relevant registry entries. This gives AI
crawlers and knowledge-graph systems a way to cross-reference the entity.

**Finding [SEVERITY: HIGH]:** Pursue one external authority signal before the next content
update: a mention in an IP/legal-tech newsletter, a guest article on an INTA-adjacent blog,
or a product listing on a legal-tech directory. Cold-start SaaS sites with zero inbound links
are systematically disadvantaged for any competitive keyword.

---

### Trustworthiness — 41 / 100 (weight: 30%)

**What exists:**
- GDPR compliance stated explicitly on /about with links to Privacy Policy, DPA, and a
  named supervisory authority (VDAI, Lithuania).
- Role-based contact emails (info@, privacy@, legal@, security@, support@) are listed.
- EEA infrastructure hosting stated on /about.
- Legal pages exist: Privacy, Terms, DPA, Sub-processors, Acceptable Use, Cookie Policy,
  Security page — a full GDPR-era legal stack.
- Cookie consent implementation (GA4 + Consent Mode v2) noted in memory.
- Security contact (security@hakkiu.com) listed — covers responsible disclosure.

**What is missing — CRITICAL:**
- The /legal/imprint page explicitly states: "Full company registration details (registered
  legal entity, registration number and registered office) will be published here once
  finalized." This is a live, public page on a SaaS product selling to IP lawyers. The Imprint
  is a legal requirement under the EU E-Commerce Directive (2000/31/EC). Publishing an empty
  Imprint is worse for trust than having none — it signals the company either does not yet
  legally exist in its registered form, or is failing to comply with disclosure law.
- No physical address anywhere (city "Kaunas, Lithuania" in footer — but no street address).
- No phone number.
- No security certifications (ISO 27001, SOC 2, or even a self-attested security policy beyond
  the legal/security page).
- No uptime / SLA commitment visible to prospects.
- No named DPO or privacy contact beyond an email alias.

**Finding [SEVERITY: CRITICAL]:** Complete the legal entity registration and publish the
Imprint with: registered legal name, company registration number, registered office address,
and VAT number. Until this is done, any EU prospect who checks the Imprint (and IP lawyers
will) will see an incomplete disclosure — a disqualifying trust signal for a product handling
evidence in potential litigation.

**Finding [SEVERITY: HIGH]:** Add a physical address to the footer. "Kaunas, Lithuania" is a
city, not a verifiable address. Even a registered office address (which can be a legal/virtual
office) resolves this.

---

## Word Count Assessment

| Page | Estimated Rendered Words | Minimum (this skill's floor) | Status |
|---|---|---|---|
| Homepage (/) | ~900 words* | 500 | PASS |
| /about | ~480 words | 500 | FAIL (thin by ~20 words — borderline) |
| /solutions/law-firms | ~820 words | 800 | PASS (barely) |
| /solutions/brand-owners | ~680 words | 800 | FAIL (~120 words short) |

*Homepage word count includes all FAQ answers (which are in server HTML via `<details>` —
this is correct for crawler/LLM visibility). Excluding FAQ, the homepage body is approximately
400 words — thin.

**Finding [SEVERITY: MEDIUM] — /about word count:** The page passes the 500-word floor only
marginally if you count every UI element. In practice, the main editorial content (mission,
what we do, who we build for, how it works sections) is approximately 350 words. Adding team
member titles and 1-sentence role descriptions (per the Expertise recommendation above) will
organically expand this while adding more valuable content.

**Finding [SEVERITY: MEDIUM] — /solutions/brand-owners word count:** Approximately 120 words
short of the 800-word floor for a service page. The "channel by channel" section and FAQ
bring it close, but the page would benefit from a "what protection looks like in practice"
paragraph with a concrete scenario (e.g., a brand discovering a lookalike on AliExpress and
what happens step by step in the platform). This also doubles as an Experience signal.

**Important caveat:** Word count is not a direct Google ranking factor. The issue here is not
the number — it's that thin pages have thin topical coverage, which is the underlying problem.
The recommendations above address topical gaps, not word padding.

---

## Readability Assessment

**Positive signals:**
- Sentence length is consistently short to medium. No paragraph exceeds 4-5 sentences.
- Active voice throughout ("HAKKIU monitors," "AI scans," "you review").
- Plain-language section headers on /solutions pages work well (e.g., "The gap in the usual
  workflow," "What 'legal-review-ready' actually means").
- The FAQ answers balance technical precision with accessibility — the SHA-256 explanation on
  the homepage FAQ is a strong example.
- Consistent use of second-person ("you," "your") creates direct address appropriate for B2B.

**Issues:**
- Section labels (displayed as tiny uppercase monospaced eyebrow text) are visually prominent
  in the design but semantically function as H2s. The actual H2 content in sections like "Our
  mission," "What we do," "Who we build for" are generic. They would be more scannable and
  SEO-useful if they carried keyword-bearing phrases (e.g., "What HAKKIU monitors" instead
  of "What we do").
- No use of numbered lists or tables on any page. Tabular content (e.g., "manual monitoring
  vs. automated monitoring" as a process, not a vendor comparison) is both more readable and
  more AI-citation-friendly.
- The /about page reads more like a brochure than an informative page. Prospects arriving
  from search on [HAKKIU brand protection] or [hakkiu.com about] cannot determine team
  backgrounds or company expertise from what is currently there.

---

## Keyword Targeting Assessment

**Homepage:**
- Primary: "trademark monitoring software" (in H1-adjacent hero and meta title) — good.
- Secondary: "brand protection software" — present in title tag, description meta, and FAQ.
- "counterfeit listings" — present in hero subtitle and throughout FAQ.
- Natural density: not stuffed. No unnatural repetition.
- Gap: no targeting of "brand monitoring software" or "brand protection SaaS" which are
  high-volume adjacents. The coverage section's H3 ("Which marketplaces and channels does
  HAKKIU monitor?") is a solid direct-answer anchor for this query.

**Finding [SEVERITY: LOW]:** The homepage targets "trademark monitoring" strongly but
"brand protection software" only in secondary positions. Consider whether your conversion-
intent buyer searches "trademark monitoring" or "brand protection" — the latter tends to have
broader commercial intent and may deserve a more prominent H1 placement.

**/about:**
- Currently not keyword-targeted in any meaningful way. The meta title is "About HAKKIU —
  EU Brand Protection for IP Teams" — the "EU Brand Protection" portion is a targeting
  attempt for EU-specific queries, but the page body does not support this with substantive
  content about EU/GDPR-specific enforcement features.

**Finding [SEVERITY: MEDIUM]:** Either make /about genuinely informative for the keyword
"EU brand protection" (by expanding the Where We Are section into a substantive explanation
of why EU data residency and GDPR compliance matters for enforcement cases that may involve
EU courts), or deprioritize /about for keyword targeting and focus it entirely on E-E-A-T
trust-building (team, mission, contact).

**/solutions/law-firms:**
- Title tag: "Trademark Monitoring Software for IP Law Firms" — strong, keyword-bearing.
- H1: "Brand protection built for IP law firms" — good.
- Long-tail FAQ targets: "Can one firm manage several clients" — realistic query type.
- Gap: "IP law firm brand protection software" and "trademark enforcement software" are not
  explicitly present in body copy as distinct phrases.

**/solutions/brand-owners:**
- Title tag: "Brand Protection Software for Brand Owners" — clear, if somewhat generic.
- H1: "Stop counterfeits and brand abuse online" — benefit-led, good for conversion, weaker
  for keyword targeting.
- The phrase "brand protection software" appears only in the title tag and meta description,
  not in the body copy where crawlers weight it more heavily.

**Finding [SEVERITY: MEDIUM]:** On /solutions/brand-owners, add the phrase "brand protection
software" naturally to the first paragraph of the Problem section, and add "counterfeit
detection" to the workflow section headings or descriptions. These are the primary commercial
intent queries for this page.

---

## AI Citation Readiness Assessment

**Score: 71 / 100**

This is the strongest dimension of the site's content quality. Several deliberate decisions
directly improve AI citation readiness:

**Positive:**
- FAQ answers use `<details>`/`<summary>` (native HTML), ensuring collapsed answer text is in
  the server-rendered DOM. AI crawlers (ClaudeBot, GPTBot, PerplexityBot) read the full answers
  without needing JavaScript execution. This is documented explicitly in source comments as
  intentional.
- robots.txt explicitly permits GPTBot, ChatGPT-User, OAI-SearchBot, ClaudeBot,
  PerplexityBot, and Google-Extended on all public pages. No accidental AI crawler blocks.
- llms.txt is present, well-structured, and includes a "Preferred citation" block — above-
  average AI-era SEO preparation.
- FAQPage JSON-LD on both the homepage and solution pages, built from the same data arrays
  as visible FAQ content (single source of truth — schema and visible text cannot drift).
- SoftwareApplication JSON-LD with a featureList covering core capabilities — quotable by AI
  answer engines.
- WebPage JSON-LD includes datePublished/dateModified — explicit freshness signal for AI
  systems that weight recency.
- Clear hierarchical content structure (H1 → section H2 → card H3) aids passage extraction.
- Specific, falsifiable facts that AI systems can cite: "12+ channels," "SHA-256 hash,"
  "UTC timestamp," "~40 marketplace/platform registry," "UDRP complaint," "VeRO programme."

**Gaps:**
- No `sameAs` on Organization schema — AI knowledge graphs cannot cross-reference the entity.
- No article-type content with a named author. AI citation systems prefer attributable sources.
- The exposure calculator is interactive (React state) — its output is not static HTML and
  therefore cannot be cited by crawlers. The surrounding explanatory text is, but the actual
  estimate numbers are not. This is acceptable since the calculator is explicitly labelled as
  "illustrative" — but a static worked example (e.g., "a brand spending €25k/month on ads
  faces an estimated €7k–€18k monthly counterfeit exposure") in the surrounding copy would
  give AI systems a quotable fact.
- No `HowTo` schema for the 3-step workflow (Connect → Detect → Enforce). This is a natural
  fit and would improve voice/AI query handling for "how does HAKKIU work" type queries.

**Finding [SEVERITY: LOW]:** Add `HowTo` JSON-LD to the homepage workflow section (steps:
Connect your brand → Detect and verify → Enforce and resolve), mirroring the existing step
card content.

**Finding [SEVERITY: LOW]:** Add a static worked example sentence adjacent to the exposure
calculator, giving AI crawlers a concrete, citable number in static HTML.

---

## Structured Data Review

| Schema Type | Present | Valid | Notes |
|---|---|---|---|
| Organization | Yes | Partial | Missing `sameAs`, `address`, `legalName`. |
| SoftwareApplication | Yes | Good | featureList present, no `offers` (correct for demo-only pricing). |
| FAQPage | Yes (homepage + 2 solution pages) | Dead markup | Valid JSON-LD, but Google retired FAQ rich results 2026-05-07 — remove it (keep visible FAQ text). |
| WebPage / AboutPage | Yes | Good | datePublished/dateModified populated. |
| BreadcrumbList | Yes (/about, /solutions/*) | Good | Correct 2-level structure. |
| HowTo | No | — | Missing; recommended for workflow section. |
| Person | No | — | No schema for team members on /about. |

**Finding [SEVERITY: MEDIUM]:** Add `Person` schema for each TEAM member on /about, linking
to their LinkedIn URL as `sameAs`. This is the primary way to build machine-readable
expertise signals for the team.

**Finding [SEVERITY: MEDIUM]:** Complete the Organization schema: add `address` (even if only
city/country until the full address is confirmed), `legalName`, and `sameAs` pointing to the
LinkedIn company page (https://www.linkedin.com/company/hakkiu/) and any relevant external
profiles.

---

## AI-Generated Content Assessment (Sept 2025 QRG)

The content does **not** show the typical markers of low-quality AI generation:

- Sentences are specific rather than generic ("a SHA-256 hash of the captured content stamped
  with a UTC time" vs. "advanced encryption technology").
- Pricing section is honest about what is not disclosed (quote-based, no tiers) rather than
  vague.
- The legal/law-firm FAQ answer about evidence usability ("That is what it is built for...
  something that holds up at a marketplace portal, in a UDRP complaint, or in front of a
  court, rather than a screenshot someone could have edited") contains domain-specific nuance.
- No repetitive boilerplate structure across pages — each page has a distinct Problem section
  with page-specific framing.
- The exposure calculator disclaimer ("Illustrative, not a measurement of actual losses")
  shows epistemic responsibility.

**Assessment:** Content quality is consistent with human authorship and genuine product
knowledge. The quality gap is not in the writing style — it is in the absence of
third-party verification and transparent company identity. Those are structural gaps, not
content generation quality issues.

---

## Prioritized Findings Summary

| # | Finding | Severity | Page(s) | Fix |
|---|---|---|---|---|
| 1 | Legal entity details missing from Imprint | CRITICAL | /legal/imprint | Register the company and publish legal name, registration code, registered office, VAT number. |
| 2 | Few first-hand experience signals (pre-customer) | HIGH | All | Add a worked example using your own product/demo data + founder-authored expert content. Customer case studies later, only with a consenting client — never fabricate. |
| 3 | Team has no titles or credentials | HIGH | /about | Add job titles and 1-2 sentence professional backgrounds for each team member. |
| 4 | Zero inbound external links | HIGH | All | Pursue 1 external authority signal: INTA directory, legal-tech newsletter feature, or guest post. |
| 5 | Organization schema missing `sameAs`, `address`, `legalName` | HIGH | Homepage (schema) | Add `sameAs` (LinkedIn URL), city/country address, and legal name to Organization JSON-LD. |
| 6 | No physical address (beyond city name in footer) | HIGH | Footer / Imprint | Add registered office street address once legal entity is finalized. |
| 7 | /solutions/brand-owners ~120 words below 800-word floor | MEDIUM | /solutions/brand-owners | Add a concrete scenario paragraph in the Problem section and expand 1 FAQ answer. |
| 8 | /about borderline on word count; team section content-sparse | MEDIUM | /about | Add team titles + backgrounds; expand "Where we are" with EU enforcement nuance. |
| 9 | `Person` schema missing for team members | MEDIUM | /about | Add `Person` JSON-LD per team member with `sameAs` LinkedIn URLs. |
| 10 | Section H2s are generic ("What we do," "Our mission") | MEDIUM | /about | Rewrite to keyword-bearing phrases ("What HAKKIU monitors," "Why EU brand protection teams choose HAKKIU"). |
| 11 | "brand protection software" not in body copy of solution pages | MEDIUM | /solutions/brand-owners | Add phrase naturally to first Problem paragraph. |
| 12 | No `HowTo` schema for workflow section | LOW | Homepage | Add `HowTo` JSON-LD mirroring the 3-step workflow cards. |
| 13 | No static worked example adjacent to exposure calculator | LOW | Homepage | Add 1 sentence with a concrete number in static HTML for AI crawlers. |
| 14 | Homepage FAQ-excluded body copy is thin (~400 words) | LOW | Homepage (/) | Add a 1-paragraph "What makes HAKKIU different" section between Features and Calculator. |

---

## What Works Well (Do Not Change)

- The `<details>`/`<summary>` FAQ implementation is correct and intentional — do not replace
  with a JS accordion. The FAQ answers are substantive and keyword-rich.
- The robots.txt is well-configured for AI crawlers.
- llms.txt is a meaningful above-average AI-era SEO asset.
- The detection pipeline description (tiered funnel: keyword → perceptual hash → VLM) is
  technically accurate and differentiating — keep it in FAQ answers and consider surfacing
  it higher on the homepage.
- Schema implementation is otherwise technically sound — WebPage dateModified, FAQPage on
  solution pages, and BreadcrumbList are all correctly structured.
- The exposure calculator provides engagement depth and interaction signals without making
  specific revenue claims — a legally and epistemically responsible design choice.
- The solution pages have distinct Problem sections with page-specific framing (law firm
  patchwork workflow vs. brand owner fire-drill discovery) — good audience segmentation.
- Pricing transparency policy ("never charged per detection or per takedown") is a specific,
  differentiating claim that appears consistently across all pages and the llms.txt. This is
  a strong positioning anchor; maintain it.
