
# Improvement Algorithm — Tracemark Detection & Collection Engine

> **Context**: This document describes how to evolve the current Tracemark scraping and collection pipeline (Firecrawl + LLM text analysis) into a competitive, multi-signal detection engine capable of outperforming enterprise-grade brand-protection platforms. It is grounded in the existing monorepo architecture (`apps/api/` FastAPI backend, `src/` TanStack Start frontend) and the planned Supabase persistence layer.

---

## 1. Current State Assessment

Based on the existing architecture (`monorepo-structure.md`, `.lovable/plan.md`):

| Component | Current Approach | Limitation |
|---|---|---|
| `scraper.py` | Firecrawl → Markdown conversion | Sequential or naive parallel; no deduplication |
| `ai.py` | Single LLM call on raw markdown | No structured signal extraction; high token cost |
| Image matching | pHash / dHash only | Fails on cropped, recolored, or partially overlaid logos |
| Seller identity | Not implemented | Cannot link the same bad actor across platforms |
| Case building | Not implemented | Each alert is isolated; no evidence bundle |
| Decision logic | LLM free-form response | Non-deterministic; no confidence score; not auditable |
| Enforcement | Manual | No takedown packet generation tied to evidence |

---

## 2. Target Architecture

The improved pipeline follows an eight-stage flow. Each stage has a clear input, transformation, and output contract so individual components can be replaced or upgraded independently.

```
COLLECT → NORMALIZE → ENRICH → RETRIEVE CANDIDATES
    → SCORE → CLUSTER → TRIAGE/ENFORCE → LEARN
```

Each stage maps to one or more Python modules inside `apps/api/src/tracemark_api/services/`.

---

## 3. Stage-by-Stage Design

### Stage 1 — Collect

**Goal**: Gather raw artifacts from all target surfaces without redundancy.

Replace single Firecrawl calls with an async, multi-source collector that treats each scrape job as a unit of work dispatched to a queue (e.g., Redis + ARQ, or Celery). Each job returns a structured `RawArtifact` object, not raw markdown.

```python
# services/collector.py
@dataclass
class RawArtifact:
    source_url: str
    platform: str               # "amazon" | "shopify" | "domain" | "social" | "web"
    fetched_at: datetime
    html: str | None
    screenshot_b64: str | None  # Full-page screenshot via Playwright
    ip_resolved: str | None
    status_code: int
    headers: dict
```

**Key improvements over current state**:
- Run collectors in parallel using `asyncio.gather` with per-platform rate limiting.
- Integrate Playwright (headless Chromium) alongside Firecrawl to capture screenshots with exact timestamps and IP for evidence — satisfying the Phase 2 requirement in the project spec.
- Deduplicate by URL + content hash before passing to Stage 2. Store all artifacts immutably; never overwrite a previously captured screenshot.
- Collect from: Google Search API / SerpAPI, Amazon Product Advertising API or scraper, eBay Finding API, Shopify storefront URLs, WHOIS / domain registries, social platform search endpoints.

---

### Stage 2 — Normalize

**Goal**: Convert heterogeneous raw artifacts into a canonical `ListingRecord` schema regardless of source platform.

```python
# services/normalizer.py
@dataclass
class ListingRecord:
    id: str                     # UUID
    artifact_id: str            # FK to RawArtifact
    platform: str
    title: str
    description: str
    price: float | None
    currency: str | None
    seller_name: str
    seller_url: str
    seller_country: str | None
    images: list[str]           # URLs or b64 refs
    product_category: str | None
    detected_at: datetime
    brand_id: str               # Which protected mark triggered this scan
```

Normalization includes:
- Unicode normalization and transliteration (handles Chinese, Arabic, Cyrillic storefronts).
- Leet-speak and homoglyph expansion for brand name matching (`Adid@s`, `Аdidas`, `Ad1das`).
- Price anomaly flagging: if listing price < 40% of MAP, tag as `price_anomaly=True`.
- Platform-specific field mapping (Amazon ASIN, eBay itemId, Shopify product handle).

---

### Stage 3 — Enrich

**Goal**: Attach external intelligence to each `ListingRecord` before scoring.

```python
# services/enricher.py
@dataclass
class EnrichedRecord(ListingRecord):
    domain_age_days: int | None
    whois_registrar: str | None
    whois_registrant_email: str | None
    hosting_asn: str | None
    hosting_country: str | None
    seller_review_count: int | None
    seller_rating: float | None
    seller_account_age_days: int | None
    seller_prior_violations: int        # From internal DB
    related_listing_ids: list[str]      # Pre-linked by seller ID or domain
```

Enrichment sources:
- WHOIS lookup (python-whois or ipwhois) for domain age, registrant email, registrar.
- IP geolocation (ip-api.com or MaxMind GeoLite2) for hosting country and ASN.
- Platform seller profile scrape for account age, rating, review count, policy violation history.
- Internal Supabase lookup for prior takedown history on this seller or domain.

---

### Stage 4 — Retrieve Candidates (Visual + Text)

**Goal**: Efficiently find listings that are visually or semantically similar to protected assets, even after image editing.

#### 4a — Multi-layer Image Matching

Replace single pHash with a three-layer cascade (cheapest first):

| Layer | Method | Catches | Cost |
|---|---|---|---|
| L1 | pHash / dHash (Hamming ≤ 10) | Exact duplicates, minor compression | ~1 ms/pair |
| L2 | Local feature matching (ORB/SIFT on keypoints) | Cropped, rotated, overlaid logos | ~20 ms/pair |
| L3 | CLIP image embeddings (cosine similarity > 0.82) | Redrawn, recolored, style-transferred marks | ~80 ms/pair (GPU) |

Only records that fail L1 and L2 proceed to L3, keeping GPU costs low. Store CLIP embeddings in `pgvector` (Supabase supports this natively) for ANN retrieval at scale.

```python
# services/vision.py
def compute_image_signals(listing_img_url: str, protected_assets: list[Asset]) -> ImageSignals:
    phash_matches = l1_phash_scan(listing_img_url, protected_assets)
    if phash_matches:
        return ImageSignals(method="phash", score=1.0, matched_asset_id=phash_matches[0])
    
    orb_matches = l2_orb_scan(listing_img_url, protected_assets)
    if orb_matches:
        return ImageSignals(method="orb", score=orb_matches.confidence, ...)
    
    clip_score, matched = l3_clip_scan(listing_img_url, protected_assets)
    return ImageSignals(method="clip", score=clip_score, matched_asset_id=matched)
```

#### 4b — Text and NLP Matching

Replace keyword-only search with:
- Brand name fuzzy matching using `rapidfuzz` (Levenshtein + Jaro-Winkler, threshold 85).
- Token-set ratio for multi-word brand names embedded in longer product titles.
- Sentence embeddings (`sentence-transformers`, `all-MiniLM-L6-v2`) stored in `pgvector` for semantic recall.
- Multilingual normalization via `langdetect` + `deep-translator` to handle non-English listings.

---

### Stage 5 — Score

**Goal**: Combine all signals into a single deterministic `RiskScore` with traceable feature weights.

Use a weighted additive model (not a black-box LLM) for the base score, then optionally call the LLM only for the narrative explanation:

```python
# services/scorer.py
WEIGHTS = {
    "image_l1_match":          0.35,
    "image_l2_match":          0.28,
    "image_l3_clip":           0.22,   # weighted by clip cosine score
    "brand_name_exact":        0.30,
    "brand_name_fuzzy":        0.18,
    "price_anomaly":           0.12,
    "seller_prior_violations": 0.10,
    "domain_age_lt_90d":       0.08,
    "seller_account_age_lt_30d": 0.07,
    "hosting_country_risk":    0.05,
    "keyword_stuffing":        0.04,
}

@dataclass
class RiskScore:
    total: float                # 0.0 – 1.0
    level: str                  # "high" | "medium" | "low"
    feature_contributions: dict # Feature → contribution value (for explainability)
    recommended_action: str     # "auto_takedown" | "analyst_review" | "legal_escalation" | "safe"
    confidence: float
```

**Decision thresholds** (configurable per brand):

| Score Range | Level | Action |
|---|---|---|
| 0.85 – 1.00 | High | Auto-takedown (if platform supports API enforcement) |
| 0.60 – 0.84 | Medium | Analyst review queue |
| 0.40 – 0.59 | Low | Watch list + recheck in 48h |
| 0.00 – 0.39 | Safe | Archive, feed to negative training set |

---

### Stage 6 — Cluster (Entity Resolution / Offender Graph)

**Goal**: Link multiple listings, domains, and storefronts operated by the same bad actor into one unified `OffenderCase`.

This is the single most differentiating capability. Instead of handling isolated alerts, detect campaigns.

```python
# services/entity_graph.py
# Nodes: Seller, Domain, Email, Phone, Image (reused asset), Address, PaymentHint
# Edges: SharedEmail, SharedImage, SharedDomain, SharedPhone, LinkedAccount

def build_offender_graph(enriched_records: list[EnrichedRecord]) -> nx.Graph:
    G = nx.Graph()
    for rec in enriched_records:
        G.add_node(rec.seller_url, type="seller", ...)
        if rec.whois_registrant_email:
            G.add_node(rec.whois_registrant_email, type="email")
            G.add_edge(rec.seller_url, rec.whois_registrant_email, rel="whois_email")
        # Link by reused listing images
        for img_hash in rec.image_phashes:
            G.add_edge(rec.seller_url, img_hash, rel="shared_image")
    return G

def extract_offender_cases(G: nx.Graph) -> list[OffenderCase]:
    # Connected components = one offender campaign
    for component in nx.connected_components(G):
        yield OffenderCase(nodes=component, listing_count=..., platforms=..., risk_score=...)
```

Two sellers sharing a reused image asset, the same registrant email, or the same fulfillment address are merged into a single `OffenderCase` with a cumulative risk score, making enforcement more impactful per filing.

---

### Stage 7 — Triage and Enforce

**Goal**: Build a prosecutor-grade evidence packet and route each case to the right action without ambiguity.

#### 7a — Case Schema

Every case that reaches enforcement should contain:

```python
@dataclass
class EvidenceCase:
    case_id: str
    brand_id: str
    offender: OffenderCase
    
    # Evidence artifacts
    screenshots: list[Screenshot]      # URL, timestamp, IP, user-agent, b64 image
    listing_records: list[EnrichedRecord]
    image_match_report: ImageSignals
    text_match_report: TextSignals
    
    # Intelligence
    risk_score: RiskScore
    ai_narrative: str                  # LLM-generated infringement analysis
    feature_contributions: dict        # Explainability trail
    
    # Trademark reference
    trademark_reg_number: str
    trademark_classes: list[str]
    protected_assets: list[Asset]      # Logo files, official domain, authorized sellers
    
    # History
    prior_takedowns: list[TakedownRecord]
    recurrence_count: int
    
    # Decision
    recommended_action: str
    confidence: float
    reviewer_id: str | None
    reviewed_at: datetime | None
    final_action: str | None
```

#### 7b — Agent Decision (LLM with Structured Output)

The LLM is used **after** deterministic scoring, not before. Its job is to:
1. Review the assembled `EvidenceCase` as a structured prompt.
2. Verify the recommendation matches the evidence.
3. Produce a `TakedownRationale` (JSON) explaining the legal basis, matched elements, and suggested notice type.
4. Flag any anomaly that should block auto-enforcement (authorized reseller, parody use, geographical exception).

```python
# services/agent.py
SYSTEM_PROMPT = """
You are a trademark enforcement agent. You receive a structured evidence case.
Your job is NOT to decide alone — deterministic scoring has already ranked this case.
Your job is to:
1. Verify the evidence supports the risk level.
2. Identify any exception that should prevent enforcement (authorized seller, parody, first sale doctrine).
3. Write a one-paragraph legal rationale for the takedown notice.
4. Return structured JSON only.
"""

def agent_review(case: EvidenceCase) -> AgentVerdict:
    # Build a structured case summary (not raw HTML — summarized fields only)
    # Call LLM with structured output (OpenAI function calling / Pydantic response model)
    # Return AgentVerdict: confirmed_action, exceptions_found, rationale, notice_type
```

**Guardrails**:
- Agent can only **confirm, downgrade, or block** — it cannot upgrade a Low case to auto-takedown.
- All agent decisions are append-only logged with the full prompt snapshot for auditability.
- Confidence below 0.65 always routes to human review regardless of agent verdict.

#### 7c — Auto-Generated Evidence Bundle

When action is `auto_takedown` or `analyst_review`, generate the evidence packet:
- PDF notice (DMCA / Cease & Desist / platform-specific form) pre-filled with case metadata using `reportlab` or `weasyprint`.
- Screenshot package with metadata watermark (timestamp, URL, IP, detection method).
- Trademark certificate reference and matched asset comparison image.
- Offender graph summary (linked accounts and platforms).

This maps directly to the Document Generator view already planned in the frontend (`/cases/$caseId/takedown`).

---

### Stage 8 — Learn (Feedback Loop)

**Goal**: Every analyst action improves the system.

```python
# services/feedback.py
def record_analyst_action(
    case_id: str,
    analyst_id: str,
    original_recommendation: str,
    final_action: str,          # "confirmed" | "overridden_safe" | "escalated"
    override_reason: str | None
):
    # 1. Write to feedback log (Supabase)
    # 2. If overridden_safe: add to negative training set
    # 3. If confirmed: add to positive training set
    # 4. Recompute weight calibration after N new samples
    # 5. Update brand-specific thresholds if pattern detected
```

Active learning queue: send to analyst review records with the **highest uncertainty** (score near threshold) and the **most novel** patterns (low cosine similarity to prior reviewed cases). This mirrors best practices from human-in-the-loop active learning research that shows uncertainty + diversity sampling outperforms random review queues.

---

## 4. Backend Module Map

```
apps/api/src/tracemark_api/
  services/
    collector.py          # Stage 1: async multi-source scraping + screenshots
    normalizer.py         # Stage 2: canonical ListingRecord schema
    enricher.py           # Stage 3: WHOIS, IP, seller history
    vision.py             # Stage 4a: pHash → ORB → CLIP cascade
    nlp.py                # Stage 4b: fuzzy text + sentence embeddings
    scorer.py             # Stage 5: weighted additive risk score
    entity_graph.py       # Stage 6: offender graph and clustering
    agent.py              # Stage 7b: LLM verification with guardrails
    evidence_builder.py   # Stage 7c: PDF + screenshot bundle generation
    feedback.py           # Stage 8: analyst action logging + retraining
  routes/
    monitoring.py         # Trigger scans, view monitored marks
    cases.py              # Case CRUD, evidence retrieval
    enforce.py            # Takedown submission, webhook dispatch
    feedback.py           # Analyst action endpoints
```

---

## 5. Database Schema (Supabase / pgvector)

Add these tables to the Supabase migration:

```sql
-- Core detection tables
CREATE TABLE listing_records (...);
CREATE TABLE evidence_cases (...);
CREATE TABLE offender_nodes (id uuid, type text, value text, ...);
CREATE TABLE offender_edges (source_id uuid, target_id uuid, relation text, ...);

-- Vector storage for ANN retrieval
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE listing_records ADD COLUMN image_embedding vector(512);
ALTER TABLE listing_records ADD COLUMN text_embedding vector(384);

-- Feedback and audit
CREATE TABLE analyst_actions (...);
CREATE TABLE agent_verdicts (...);           -- append-only, never updated
CREATE TABLE training_samples (...);
```

---

## 6. Recommended Tech Stack Additions

| Need | Library | Rationale |
|---|---|---|
| Async job queue | `arq` (Redis-based) or `celery` | Parallel scrape workers with retry logic |
| Headless screenshots | `playwright` (Python) | Full-page capture with IP resolution |
| Image embeddings | `open-clip-torch` | Open-source CLIP; runs on CPU for dev |
| Vector search | Supabase `pgvector` | Already in stack; avoid separate Pinecone cost |
| Fuzzy text matching | `rapidfuzz` | 10–50× faster than `fuzzywuzzy` |
| Sentence embeddings | `sentence-transformers` | `all-MiniLM-L6-v2` is fast and accurate |
| Graph analytics | `networkx` | Offender clustering; no extra infra |
| PDF generation | `weasyprint` | HTML → PDF for notice documents |
| Structured LLM output | OpenAI function calling + Pydantic | Already using OpenAI; enforces JSON schema |

---

## 7. Priority Roadmap

| Phase | Deliverable | Impact |
|---|---|---|
| **P0** | Multi-layer image matching (L1→L2→L3) + pgvector storage | Immediately reduces false negatives from edited logos |
| **P0** | Structured `ListingRecord` normalizer + enricher | Foundation for all downstream stages |
| **P1** | Weighted additive risk scorer with explainability | Replaces free-form LLM decision; makes scores auditable |
| **P1** | Playwright screenshot collector with metadata watermark | Provides court-admissible evidence artifacts |
| **P2** | Entity/offender graph clustering | Detects campaigns instead of isolated listings |
| **P2** | Structured agent review with guardrails | Adds LLM reasoning safely on top of deterministic score |
| **P3** | Evidence bundle PDF generator | Enables one-click enforceable cases |
| **P3** | Analyst feedback loop + active learning queue | Closes the improvement cycle; compounds precision over time |

---

## 8. Key Design Principles

1. **Deterministic first, LLM second.** Scoring and filtering happen through auditable rules. The LLM only adds narrative and verification — it cannot override hard rules.
2. **Evidence is immutable.** Screenshots, timestamps, and raw artifacts are written once and never updated. All enforcement decisions reference a snapshot.
3. **Cases over alerts.** Cluster before you count. One offender running 40 storefronts is one case, not 40 alerts.
4. **Brand-specific thresholds.** A luxury watch brand and a software tool have different authorized-seller patterns and risk tolerances. Per-brand configuration of score weights and action thresholds is first-class.
5. **Every analyst action trains the system.** No review is wasted. Overrides feed the negative set; confirmations feed the positive set. The model gets better with use.
