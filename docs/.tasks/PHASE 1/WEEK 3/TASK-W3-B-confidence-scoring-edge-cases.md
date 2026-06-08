# TASK-W3-B — Confidence Scoring, Evidence Ranking & Edge Cases (Engineer B)

**Assigned to:** Engineer B
**Week:** Week 3
**Priority:** 🟡 Medium-High
**Stack:** Python · FastAPI · LangGraph · Google AI Studio (Gemini) · Supabase

---

## Objective

Harden the AI decision agent to handle empty or low-quality evidence gracefully, implement an **evidence quality scoring system** that ranks evidence before passing it to Gemini, and improve `confidence_score` accuracy so the frontend can display meaningful certainty levels to users.

**Success test:**
```python
# Edge case 1: completely empty evidence
empty_evidence = Evidence(marketplaces=[], ads=[], domains=[], social=[], timestamp=datetime.now())
decision = make_decision(empty_evidence)
assert decision.recommended_action == "DISMISS"
assert decision.confidence_score < 0.3

# Edge case 2: rich evidence
rich_evidence = Evidence(marketplaces=[...15 listings...], ads=[...5 ads...], domains=[...3 domains...])
decision = make_decision(rich_evidence)
assert decision.risk_level in ["HIGH", "MEDIUM"]
assert decision.confidence_score > 0.6
assert decision.evidence_quality == "STRONG"
```

---

## Context

Week 2 delivered a working Gemini decision agent. However, it passes raw evidence directly to the model without any pre-filtering, which means Gemini receives noisy, unranked data and produces inconsistent confidence scores. Week 3 adds a **pre-processing layer** that scores and ranks evidence before the AI sees it, making decisions more deterministic and reliable.

This also fixes the Week 2 integration finding that `make_decision(empty_evidence)` caused Gemini to produce unpredictable output when no evidence was found.

---

## Step-by-Step Implementation

### Step 1 — Evidence Quality Scorer

Create `apps/api/src/tracemark_api/services/evidence_scorer.py`:

```python
from tracemark_api.services.ai import Evidence, MarketplaceEvidence
from dataclasses import dataclass

@dataclass
class EvidenceScore:
    total_score: float           # 0.0 – 1.0 overall quality score
    quality_label: str           # "STRONG" | "MODERATE" | "WEAK"
    marketplace_score: float     # Contribution from marketplace listings
    ads_score: float             # Contribution from ad evidence
    domains_score: float         # Contribution from domain monitoring
    social_score: float          # Contribution from social media
    top_findings: list[str]      # Pre-computed bullet points for Gemini prompt
    is_empty: bool               # True if zero evidence across all sources


def score_evidence(evidence: Evidence) -> EvidenceScore:
    """
    Scores incoming Evidence across 4 dimensions and returns a quality rating.
    This score is passed to the Gemini prompt to anchor the confidence estimate.

    Scoring weights:
    - Marketplace listings: 40% (most direct proof of counterfeiting)
    - Ads: 30% (impersonation via paid ads is high-value signal)
    - Domains: 20% (typosquatting is lower severity but common)
    - Social: 10% (supporting signal)
    """
    mp_count = len(evidence.marketplaces)
    ads_count = len(evidence.ads)
    domains_count = len(evidence.domains)
    social_count = len(evidence.social)
    total_count = mp_count + ads_count + domains_count + social_count

    if total_count == 0:
        return EvidenceScore(
            total_score=0.0,
            quality_label="WEAK",
            marketplace_score=0.0,
            ads_score=0.0,
            domains_score=0.0,
            social_score=0.0,
            top_findings=[],
            is_empty=True,
        )

    # Normalize each source score (cap at 1.0)
    mp_score = min(mp_count / 10, 1.0)        # 10+ listings = full score
    ads_score = min(ads_count / 5, 1.0)        # 5+ ads = full score
    domains_score = min(domains_count / 5, 1.0) # 5+ domains = full score
    social_score = min(social_count / 3, 1.0)  # 3+ social = full score

    total = (
        mp_score * 0.40 +
        ads_score * 0.30 +
        domains_score * 0.20 +
        social_score * 0.10
    )

    if total >= 0.65:
        label = "STRONG"
    elif total >= 0.30:
        label = "MODERATE"
    else:
        label = "WEAK"

    findings = _build_findings(evidence, mp_count, ads_count, domains_count, social_count)

    return EvidenceScore(
        total_score=round(total, 3),
        quality_label=label,
        marketplace_score=mp_score,
        ads_score=ads_score,
        domains_score=domains_score,
        social_score=social_score,
        top_findings=findings,
        is_empty=False,
    )


def _build_findings(
    evidence: Evidence,
    mp_count: int, ads_count: int, domains_count: int, social_count: int
) -> list[str]:
    """Generate human-readable finding bullets from raw evidence counts."""
    findings = []
    if mp_count > 0:
        sellers = list({m.seller_name for m in evidence.marketplaces if m.seller_name})[:3]
        findings.append(
            f"{mp_count} suspicious marketplace listing(s) found"
            + (f" — sellers: {', '.join(sellers)}" if sellers else "")
        )
    if ads_count > 0:
        findings.append(f"{ads_count} potentially infringing ad(s) detected on Google/Meta")
    if domains_count > 0:
        domains = [d.get("domain", "") for d in evidence.domains[:3]]
        findings.append(
            f"{domains_count} suspicious domain(s) registered: {', '.join(domains)}"
        )
    if social_count > 0:
        findings.append(f"{social_count} suspicious social media profile(s) detected")
    return findings
```

---

### Step 2 — Empty Evidence Short-Circuit

Update the `_make_decision_node` in `ai.py` to short-circuit immediately for empty evidence, avoiding an unnecessary Gemini API call:

```python
from tracemark_api.services.evidence_scorer import score_evidence, EvidenceScore

def _make_decision_node(state: AgentState) -> AgentState:
    evidence = state["evidence"]
    score: EvidenceScore = score_evidence(evidence)

    # Short-circuit: if no evidence at all, dismiss without calling Gemini
    if score.is_empty:
        state["decision"] = Decision(
            risk_level="LOW",
            recommended_action="DISMISS",
            case_summary=(
                "No suspicious activity detected. No marketplace listings, "
                "ads, domains, or social media profiles were found for this brand."
            ),
            confidence_score=0.95,  # High confidence in "nothing found"
            evidence_quality="WEAK",
            key_findings=["Zero evidence items collected across all monitored sources"],
        )
        return state

    # ... rest of the Gemini call, now with score context injected into the prompt
```

---

### Step 3 — Inject Evidence Score into Gemini Prompt

Update the decision prompt to include the pre-computed score so Gemini's confidence anchoring is consistent:

```python
prompt = f"""
You are a brand protection legal analyst. Based on the structured evidence below, 
make an enforcement decision.

PRE-COMPUTED EVIDENCE QUALITY SCORE: {score.total_score:.2f}/1.0 ({score.quality_label})
- Marketplace listings score: {score.marketplace_score:.2f}
- Ads score: {score.ads_score:.2f}
- Domain surveillance score: {score.domains_score:.2f}
- Social media score: {score.social_score:.2f}

KEY FINDINGS (pre-extracted):
{chr(10).join(f'• {f}' for f in score.top_findings)}

RAW COUNTS:
- Marketplace listings: {len(evidence.marketplaces)}
- Suspicious ads: {len(evidence.ads)}
- Suspicious domains: {len(evidence.domains)}
- Social media profiles: {len(evidence.social)}

SAMPLE LISTINGS (up to 5):
{[m.dict() for m in evidence.marketplaces[:5]]}

DECISION GUIDELINES:
- Use the pre-computed evidence score to anchor your confidence_score (e.g. score 0.7 → confidence ~0.7-0.8)
- HIGH + TAKEDOWN: evidence_score >= 0.65 OR 5+ marketplace listings
- MEDIUM + MONITOR: evidence_score 0.30-0.64 OR 1-4 listings OR suspicious domains only
- LOW + DISMISS: evidence_score < 0.30 AND no marketplace listings

Return structured JSON with: risk_level, recommended_action, case_summary, confidence_score, evidence_quality, key_findings.
"""
```

---

### Step 4 — Persist Evidence Score to Supabase

Update the `decisions` table to store the evidence score alongside the decision:

```sql
-- Run in Supabase SQL Editor
ALTER TABLE decisions
    ADD COLUMN IF NOT EXISTS evidence_score FLOAT DEFAULT 0.0,
    ADD COLUMN IF NOT EXISTS marketplace_score FLOAT DEFAULT 0.0,
    ADD COLUMN IF NOT EXISTS ads_score FLOAT DEFAULT 0.0,
    ADD COLUMN IF NOT EXISTS domains_score FLOAT DEFAULT 0.0;
```

Update `database.py` `save_decision()` to include score fields:

```python
def save_decision(case_id: str, decision: Decision, score: EvidenceScore = None) -> str:
    payload = {
        "case_id": case_id,
        "risk_level": decision.risk_level,
        "recommended_action": decision.recommended_action,
        "case_summary": decision.case_summary,
        "confidence_score": decision.confidence_score,
        "evidence_quality": decision.evidence_quality,
        "key_findings": decision.key_findings,
    }
    if score:
        payload.update({
            "evidence_score": score.total_score,
            "marketplace_score": score.marketplace_score,
            "ads_score": score.ads_score,
            "domains_score": score.domains_score,
        })
    sb = get_supabase()
    result = sb.table("decisions").insert(payload).execute()
    sb.table("cases").update({"status": "complete"}).eq("id", case_id).execute()
    return result.data[0]["id"]
```

---

### Step 5 — Edge Case Test Suite

Create `apps/api/tests/test_decision_agent.py`:

```python
import pytest
from datetime import datetime
from tracemark_api.services.ai import Evidence, Decision, make_decision, MarketplaceEvidence
from tracemark_api.services.evidence_scorer import score_evidence

def make_listing(seller="FakeSeller", platform="amazon", price="$9.99"):
    return MarketplaceEvidence(seller_name=seller, platform=platform,
                               listing_url="https://amazon.com/dp/TEST", price=price)

class TestEvidenceScorer:
    def test_empty_evidence_scores_zero(self):
        evidence = Evidence(marketplaces=[], ads=[], domains=[], social=[], timestamp=datetime.now())
        score = score_evidence(evidence)
        assert score.total_score == 0.0
        assert score.is_empty is True
        assert score.quality_label == "WEAK"

    def test_rich_evidence_scores_high(self):
        listings = [make_listing(f"Seller{i}") for i in range(12)]
        evidence = Evidence(marketplaces=listings, ads=[{}]*5, domains=[{}]*3, social=[], timestamp=datetime.now())
        score = score_evidence(evidence)
        assert score.total_score >= 0.65
        assert score.quality_label == "STRONG"

    def test_findings_populated(self):
        evidence = Evidence(marketplaces=[make_listing()], ads=[], domains=[], social=[], timestamp=datetime.now())
        score = score_evidence(evidence)
        assert len(score.top_findings) >= 1
        assert "marketplace" in score.top_findings[0].lower()


class TestDecisionAgent:
    def test_empty_evidence_returns_dismiss(self):
        evidence = Evidence(marketplaces=[], ads=[], domains=[], social=[], timestamp=datetime.now())
        decision = make_decision(evidence)
        assert decision.recommended_action == "DISMISS"
        assert decision.confidence_score > 0.5  # Should be confident in "nothing found"

    def test_decision_has_all_fields(self):
        evidence = Evidence(marketplaces=[make_listing()], ads=[], domains=[], social=[], timestamp=datetime.now())
        decision = make_decision(evidence)
        assert decision.risk_level in ["HIGH", "MEDIUM", "LOW"]
        assert decision.recommended_action in ["TAKEDOWN", "MONITOR", "DISMISS"]
        assert isinstance(decision.case_summary, str) and len(decision.case_summary) > 10
        assert 0.0 <= decision.confidence_score <= 1.0
        assert decision.evidence_quality in ["STRONG", "MODERATE", "WEAK"]
        assert isinstance(decision.key_findings, list)

    def test_empty_evidence_skips_gemini_call(self, mocker):
        """Empty evidence must short-circuit without calling the Gemini API."""
        mock_invoke = mocker.patch("langchain_google_genai.ChatGoogleGenerativeAI.invoke")
        evidence = Evidence(marketplaces=[], ads=[], domains=[], social=[], timestamp=datetime.now())
        make_decision(evidence)
        mock_invoke.assert_not_called()
```

Run with: `pytest apps/api/tests/test_decision_agent.py -v`

---

## File Summary

| File | Action |
|------|--------|
| `apps/api/src/tracemark_api/services/evidence_scorer.py` | **Create** — evidence quality scoring system |
| `apps/api/src/tracemark_api/services/ai.py` | **Update** — inject scorer into decision node, add empty evidence short-circuit |
| `apps/api/src/tracemark_api/services/database.py` | **Update** — persist evidence scores |
| `apps/api/tests/test_decision_agent.py` | **Create** — edge case test suite |
| Supabase SQL Editor | **Run** — `ALTER TABLE decisions` migration |

---

## Acceptance Criteria

- [ ] `make_decision(empty_evidence)` returns `DISMISS` with `confidence_score > 0.5` — no Gemini API call made
- [ ] `score_evidence()` returns `"STRONG"` for evidence with 10+ listings + 5+ ads
- [ ] `score_evidence()` returns `"WEAK"` for zero-item evidence
- [ ] Gemini prompt includes pre-computed score values (verify by checking prompt string in test)
- [ ] `decisions` table in Supabase includes `evidence_score`, `marketplace_score`, `ads_score`, `domains_score` columns
- [ ] All tests in `test_decision_agent.py` pass with `pytest`
- [ ] `make_decision` never raises an unhandled exception regardless of evidence content
