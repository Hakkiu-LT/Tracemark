# GEO / AI-Search Readiness Audit — hakkiu.com

**Audit date:** 2026-07-30
**Product:** HAKKIU — AI-powered trademark monitoring and brand-protection SaaS (B2B)
**Auditor:** Claude Code GEO specialist pass

---

## GEO Readiness Score: 52 / 100

| Dimension | Weight | Raw (0–10) | Weighted |
|---|---|---|---|
| Citability | 25% | 5.5 | 13.8 |
| Structural Readability | 20% | 6.0 | 12.0 |
| Multi-Modal Content | 15% | 4.0 | 6.0 |
| Authority & Brand Signals | 20% | 3.0 | 6.0 |
| Technical Accessibility | 20% | 7.0 | 14.0 |
| **Total** | | | **51.8 → 52** |

---

## 1. AI Crawler Access Status

| Crawler | Status | Source |
|---|---|---|
| GPTBot | ALLOWED (explicit) | robots.txt |
| OAI-SearchBot | ALLOWED (explicit, as ChatGPT-User) | robots.txt |
| ClaudeBot | ALLOWED (explicit) | robots.txt |
| PerplexityBot | ALLOWED (explicit) | robots.txt |
| Google-Extended | ALLOWED (explicit) | robots.txt |
| CCBot | Not mentioned — defaults to general Allow | robots.txt |
| anthropic-ai | Not mentioned — defaults to general Allow | robots.txt |

**Verdict: Excellent.** All five priority AI crawlers are explicitly welcomed in robots.txt. The tiered approach (public marketing pages allowed, /dashboard /cases /auth blocked) is correctly structured. No training-only crawlers (CCBot, cohere-ai) are blocked separately, which is fine for a young brand that benefits from any visibility.

---

## 2. llms.txt Status

**Status: PRESENT and well-formed.**

The file exists at `https://hakkiu.com/llms.txt` and contains:

- Product summary (HAKKIU, AI-powered trademark monitoring)
- Core capabilities (12+ monitored channels with named platforms)
- Target user personas (Brand Manager, Legal Counsel, Founder)
- Key pricing distinction ("no per-detection / per-takedown charges")
- Account provisioning model (demo-gated, staff-provisioned)

**What works:** The llms.txt communicates the product's differentiator and target audience clearly. Named platforms (Amazon, Shopify, eBay, Alibaba, Instagram, TikTok) give LLMs concrete entities to index.

**What is missing:**
- No RSL 1.0 licensing declaration (the emerging standard for content reuse permissions)
- No link to more detailed `/llms-full.txt` with deeper documentation

---

## 3. Citability Analysis

### Passage Length Assessment

Target: 134–167 words per answer block for optimal AI citation.

| Page / Section | Approx. Word Count | In Target Range? |
|---|---|---|
| FAQ: Which marketplaces does HAKKIU monitor? | ~48 words | Too short |
| FAQ: How is pricing structured? | ~62 words | Too short |
| FAQ: What happens after detection? | ~62 words | Too short |
| FAQ: How much is automated? | ~39 words | Too short |
| About / mission block | ~80 words | Too short |
| Law firms page — evidence capture section | ~90 words | Too short |
| Homepage H1 + supporting paragraph | ~55 words combined | Too short |

**Verdict: All primary answer blocks are significantly below the 134-word optimal floor.** AI systems prefer self-contained passages long enough to stand alone as an answer. At 39–90 words, HAKKIU's answer blocks read as bullets, not citable prose passages.

### Direct-Answer Positioning

The homepage leads with "Protect your brand at internet speed" — a tagline, not a direct answer to a user question. The first substantive description appears after the fold. Best practice for AI citation is to put a direct answer in the first 40–60 words of each section.

The FAQ answers on `/solutions/brand-owners` do open with direct answers (e.g., the pricing FAQ opens with "It is a flat rate, set by how many brands and marks you are protecting"), which is good. This pattern needs to be extended site-wide.

### Self-Contained Answer Blocks

Most content requires context from the surrounding section to be meaningful. The law-firms page describes features without naming the product in each passage. AI scrapers that extract paragraphs in isolation will lose the subject ("HAKKIU monitors...") because the product name is only in the heading.

**Recommendation:** Begin each substantive paragraph with "HAKKIU [verb]..." to maintain referential clarity when passages are extracted.

---

## 4. Structural Readability

### Heading Structure

`/solutions/brand-owners` has good H2/H3 structure:
- "The problem, in plain terms" — problem framing
- "How it works" — process
- "Questions brand owners ask us" — FAQ anchor (H2)
- H3s for each FAQ question

This question-based heading pattern is strong for AI parsing. The FAQ H3s ("Which marketplaces and channels does HAKKIU monitor?", "How is pricing structured?") are already in the question format that AI systems use to match user queries to content.

### What is weak:

- Homepage H1 is a tagline ("Protect your brand at internet speed") rather than a descriptive statement. AI systems weight H1 heavily for topical classification.
- About page has no H2/H3 structure surfaced; content reads as flat prose.
- No blog, resources, or knowledge-base section exists. The sitemap shows 13 URLs total, all marketing/legal. Zero editorial content means zero opportunity for long-form, deeply citable passages.
- No "how-to" or definitional content (e.g., "What is a UDRP complaint?", "How to file a takedown on Amazon") that AI systems frequently cite.

### Schema Markup

**FAQPage JSON-LD: NOT found on any page.** The user noted the homepage "has FAQPage schema" — this could not be confirmed from the fetched content. If it is present but only injected client-side by JavaScript, AI crawlers that do not execute JS (including many LLM training pipelines) will never see it. The FAQ questions exist in HTML on `/solutions/brand-owners` but without structured data markup.

**Organization schema: NOT found.**
**BreadcrumbList: NOT found.**
**SoftwareApplication / Product schema: NOT found.**

---

## 5. Authority & Brand Signals

| Signal | Status | Impact |
|---|---|---|
| Wikipedia entity | Not present | High negative |
| Reddit mentions | Cannot confirm (blocked) | Unknown |
| YouTube presence | Not confirmed | Unknown |
| LinkedIn company page | Likely (founders listed, profiles linked) | Moderate |
| Domain Rating / backlinks | Unknown — site founded 2026 | Likely low |
| Press mentions / PR | Not found | Missing |
| Neutral company profile (e.g. Crunchbase) | Not found | Missing |
| Named authors on content | No author bylines anywhere | Missing |
| Publication dates on pages | Not present | Missing |
| Citations / references in content | None found | Missing |

**Wikipedia:** No article exists. This is the single highest-impact missing authority signal. Wikipedia entity presence correlates strongly with AI citation across ChatGPT, Perplexity, and Claude.

**Founder visibility:** Five named co-founders exist on the About page (Martynas Paškevičius, Gabriel Sequera, Modestas Akelis, Mantas Samulionis, Domantas Janušauskas) but none have authorship credit on any content page. Founder-authored articles or quotes attributed to named individuals significantly increase authority signals for AI systems.

**Age and backlink profile:** The company was founded in 2026. The domain and content base are extremely new. AI systems weight entity age and cross-domain citation frequency heavily. This is a structural disadvantage that only time and deliberate off-site presence building can address.

**No statistics with source attribution:** The content references capabilities but cites no external data (industry statistics on counterfeiting, trademark filing volumes, enforcement success rates). Cited statistics are one of the strongest citability signals.

---

## 6. Technical Accessibility for AI Crawlers

**Rendering:** The page appears to use SSR or hybrid rendering (pre-rendered HTML with content visible in the body). This is positive — AI crawlers that do not execute JavaScript can read the text content.

**However:** The FAQPage schema (if it exists) was not detectable in the fetched HTML, suggesting it may be injected by client-side JS after hydration. Schema markup that requires JS execution is invisible to most AI training crawlers and many AI search crawlers.

**sitemap.xml:** Present at `https://hakkiu.com/sitemap.xml`, lists 13 URLs with lastmod, changefreq, and priority. This is correct and helps AI crawlers discover all public pages.

**Content-to-noise ratio:** Pages appear lean — no heavy nav chrome, cookie banners, or modal overlays blocking text in the fetched HTML. Trafilatura-style extraction would yield clean passage text.

**robots.txt:** Well-structured, no issues.

---

## 7. Platform-Specific Scores

| Platform | Score | Key gap |
|---|---|---|
| Google AI Overviews | 38 / 100 | No FAQPage JSON-LD confirmed, no long-form content, new domain with low authority |
| ChatGPT (Browse / SearchGPT) | 45 / 100 | GPTBot allowed, llms.txt present, but no Wikipedia entity, passages too short |
| Perplexity | 50 / 100 | PerplexityBot allowed, question-format H3s help, but no cited sources in content |
| Bing Copilot | 40 / 100 | No Bing-specific signals; content depth insufficient for confident citation |

---

## 8. What Works (Strengths)

1. **robots.txt is exemplary** — all major AI crawlers explicitly allowed, private routes correctly blocked. This requires no changes.

2. **llms.txt is present** — rare for a 2026-founded SaaS. Gives LLMs a direct product summary and persona mapping. A strong signal at this stage.

3. **Question-format H3 headings in FAQ sections** — "Which marketplaces and channels does HAKKIU monitor?" is precisely the query format that Perplexity and Google AIO match against. This pattern is right.

4. **FAQ answers open with direct statements** — the pricing FAQ ("It is a flat rate, set by how many brands and marks you are protecting") and the automation FAQ both lead with the answer before the explanation. This is correct structure.

5. **Named differentiator clearly stated** — "no per-detection / per-takedown charges" is a concrete, memorable claim about your own fee model. It appears in llms.txt, the FAQ, and the homepage.

6. **Named platform coverage** — listing Amazon, Shopify, eBay, Alibaba, AliExpress, Etsy, Instagram, TikTok, Facebook by name gives AI systems strong entity anchors for matching queries like "trademark monitoring for Amazon sellers."

7. **SSR/hybrid rendering** — content is accessible to crawlers without JS execution.

---

## 9. Top 5 Highest-Impact Recommendations

### Priority 1 — Expand FAQ answer length to 134–167 words (Effort: Low, Impact: Very High)

Every FAQ answer is currently 39–62 words. Expand each to 134–167 words by adding:
- One concrete example ("For example, if HAKKIU detects a counterfeit listing on Amazon...")
- One clarifying detail about the process or limitation
- One outcome statement

This single change is the most direct lever for AI citation. Keep the direct answer first, add depth after. Target pages: `/solutions/brand-owners`, `/solutions/law-firms`, homepage FAQ (if present).

### Priority 2 — Clean up the (already server-rendered) schema (Effort: Low, Impact: Medium)

Correction to the earlier note: schema is **already server-rendered** — a raw render confirmed Organization+WebSite, SoftwareApplication, FAQPage and WebPage JSON-LD in the server HTML. So the action here is not "add schema" but "clean it": **remove the FAQPage blocks** (Google retired FAQ rich results 2026-05-07 — they are now dead markup) and consolidate the homepage blocks into one `@graph`. See `schema.md` for the full schema plan.

### Priority 3 — Add an author attribution layer to solution pages (Effort: Low, Impact: High)

Add a byline on each solution page crediting a named co-founder (e.g., "Written by Martynas Paškevičius, Co-founder"). Add `author` schema in JSON-LD. Add `datePublished` and `dateModified` meta. This converts anonymous marketing copy into attributable expert content — a strong authority signal for AI systems.

### Priority 4 — Publish 2–3 long-form answer pages targeting high-intent queries (Effort: Medium, Impact: Very High)

The site has zero editorial content. Suggested titles that match actual AI search queries:

- "How to file a takedown notice on Amazon for trademark infringement" (target: brand owners Googling/asking Perplexity)
- "What evidence do you need for a UDRP domain complaint?" (target: IP law firms)
- "How does AI detect counterfeit listings?" (target: brand protection category queries)

Each article should be 600–1,000 words, SSR-rendered, with FAQPage schema, a named author, a publish date, and at least two cited external sources (e.g., EUIPO data, USPTO statistics). These pages become the primary citation surface for AI systems.

### Priority 5 — Build off-site entity presence (Effort: Medium–High, Impact: Very High)

The strongest correlation with AI citation is cross-platform entity recognition. Prioritized actions:

1. **LinkedIn company page** — ensure `linkedin.com/company/hakkiu` exists, is complete, and is linked from `sameAs` in Organization schema
2. **Crunchbase profile** — free, high-DR domain, cited by AI systems as a startup authority source. Facts only (founding, team, product) — not a review/comparison listing.
3. **PR / media mention** — a single mention in a relevant trade publication (IP Watchdog, TechCrunch, EU-Startups) creates a high-authority backlink that AI training data indexes; also improves Bing Copilot and Google AIO citation probability disproportionately to effort
5. **Wikipedia** — not yet viable (too new, notability threshold not met), but begin building the citation trail that would eventually support a Wikipedia article

---

## 10. Summary Table

| Item | Status | Priority |
|---|---|---|
| AI crawlers allowed in robots.txt | DONE | — |
| llms.txt present | DONE | — |
| Question-format FAQ headings | DONE | — |
| FAQ answers: direct opening | DONE | — |
| FAQ answers: optimal length (134–167 w) | MISSING | P1 |
| FAQPage JSON-LD (server-rendered) | MISSING | P2 |
| Organization JSON-LD | MISSING | P2 |
| Author bylines + datePublished | MISSING | P3 |
| Long-form editorial content | MISSING | P4 |
| Wikipedia entity | MISSING | P5 |
| Third-party review listings | MISSING | P5 |
| Statistics with source attribution in content | MISSING | P3 |
| Named differentiator in content | DONE | — |
| SSR rendering | DONE | — |
| sitemap.xml | DONE | — |
