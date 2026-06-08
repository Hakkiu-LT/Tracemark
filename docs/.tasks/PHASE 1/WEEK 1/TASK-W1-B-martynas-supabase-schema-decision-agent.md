# TASK-W1-B — Design Supabase Schema + Stub Decision Agent

**Assigned to:** Martynas (Engineer B)
**Week:** Week 1
**Priority:** 🔴 High
**Stack:** Supabase (PostgreSQL + RLS) · Python · FastAPI · LangGraph · Google AI Studio (Gemini)

---

## Objective

Two parallel deliverables this week:

1. **Design and deploy the Supabase database schema** — tables for `cases`, `evidence`, and `decisions`.
2. **Build and test a stub `make_decision` function** that accepts a dummy `Evidence` object and returns a structured `Decision` JSON.

**Success tests:**
```python
# Part 1 — Schema
# Tables cases, evidence, decisions exist in Supabase with correct columns

# Part 2 — Decision agent stub
decision = make_decision(dummy_evidence)
# Output: JSON decision with recommendation, confidence, reasoning, priority
```

---

## Context

The project backend is FastAPI + Python in `apps/api`. The `ai.py` service already defines the `Evidence` and `Decision` Pydantic models and a 2-node LangGraph graph (`gather_evidence` → `make_decision`). However, neither node persists anything to a database, and the decision agent is tightly coupled inside the graph with no way to call it standalone.

Your job this week is:
- Create the Supabase persistence layer so that Week 2 can store real results.
- Refactor/extract the `make_decision` logic into a clean standalone function that can be tested independently and later wired to Gabriel's `gather_evidence` output.

The two parts are independent — you can work on the schema and the decision stub in parallel.

---

## Part 1: Supabase Database Schema

### 1.1 — Install Supabase CLI and Initialize

```bash
# Install Supabase CLI
npm install -g supabase

# From the repo root
supabase init         # creates supabase/ folder
supabase login        # authenticate with your Supabase account
supabase link --project-ref <your-project-ref>
```

This creates `supabase/migrations/` where all SQL lives.

---

### 1.2 — Create Migration File

```bash
supabase migration new initial_schema
```

This creates `supabase/migrations/<timestamp>_initial_schema.sql`. Add the following SQL:

#### `cases` Table
Represents a detected infringement case for a brand.

```sql
CREATE TABLE public.cases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_name      TEXT NOT NULL,
  platforms       TEXT[] DEFAULT '{}',
  status          TEXT CHECK (status IN ('open', 'takedown_sent', 'resolved', 'marked_safe')) DEFAULT 'open',
  risk_level      TEXT CHECK (risk_level IN ('high', 'medium', 'low')),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
```

#### `evidence` Table
Stores the raw `Evidence` JSON blob returned by Gabriel's `gather_evidence` function. Uses JSONB so the nested structure (marketplaces, ads, domains, social) is preserved and queryable.

```sql
CREATE TABLE public.evidence (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id     UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  payload     JSONB NOT NULL,             -- full Evidence model as JSON
  scraped_at  TIMESTAMPTZ DEFAULT now()
);
```

#### `decisions` Table
Stores the `Decision` JSON returned by the AI decision agent.

```sql
CREATE TABLE public.decisions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  recommendation  TEXT CHECK (recommendation IN ('YES', 'NO')) NOT NULL,
  confidence      INT CHECK (confidence >= 0 AND confidence <= 100),
  reasoning       TEXT,
  case_summary    TEXT,
  priority        TEXT CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW')),
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

#### Updated_at trigger (apply to `cases`)
```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cases_updated_at
BEFORE UPDATE ON public.cases
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

### 1.3 — Row-Level Security (RLS)

Enable RLS on all three tables. For Week 1, use a permissive policy (all authenticated users can read/write) — proper per-org scoping comes in a later week.

```sql
ALTER TABLE public.cases    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;

-- Permissive Week 1 policy (tighten in Week 3)
CREATE POLICY "allow_all_authenticated" ON public.cases
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "allow_all_authenticated" ON public.evidence
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "allow_all_authenticated" ON public.decisions
  FOR ALL USING (auth.role() = 'authenticated');
```

---

### 1.4 — Push to Supabase

```bash
supabase db push
```

Verify the tables exist in the Supabase dashboard under **Table Editor**.

---

### 1.5 — Python Supabase Client

Add `supabase` to `apps/api/pyproject.toml` dependencies:

```toml
dependencies = [
  ...
  "supabase>=2.0.0",
]
```

Create `apps/api/src/tracemark_api/services/database.py`:

```python
import os
from supabase import create_client, Client

_client: Client | None = None

def get_db() -> Client:
    global _client
    if _client is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        _client = create_client(url, key)
    return _client


def insert_case(brand_name: str, platforms: list[str]) -> dict:
    db = get_db()
    result = db.table("cases").insert({
        "brand_name": brand_name,
        "platforms": platforms
    }).execute()
    return result.data[0]


def insert_evidence(case_id: str, evidence_payload: dict) -> dict:
    db = get_db()
    result = db.table("evidence").insert({
        "case_id": case_id,
        "payload": evidence_payload
    }).execute()
    return result.data[0]


def insert_decision(case_id: str, decision_payload: dict) -> dict:
    db = get_db()
    result = db.table("decisions").insert({
        "case_id": case_id,
        **decision_payload
    }).execute()
    return result.data[0]
```

Update `.env.example`:
```env
SUPABASE_URL=https://xxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
```

---

## Part 2: Stub Decision Agent

### 2.1 — Extract `make_decision` as Standalone Function

The current `make_decision` node in `ai.py` only works inside the LangGraph state machine. Extract it into a callable function in a new file `apps/api/src/tracemark_api/services/decision.py`:

```python
from __future__ import annotations
import os
from tracemark_api.services.ai import Evidence, Decision
from langchain_google_genai import ChatGoogleGenerativeAI


def make_decision(evidence: Evidence) -> Decision:
    """
    Given an Evidence object, call Gemini to produce a structured Decision.
    Falls back to mock if GEMINI_API_KEY is not set.
    """
    api_key = os.environ.get("GEMINI_API_KEY")

    if not api_key:
        # Stub / mock fallback for Week 1 parallel development
        has_listings = len(evidence.marketplaces) > 0
        return Decision(
            recommendation="YES" if has_listings else "NO",
            confidence=85 if has_listings else 10,
            reasoning=(
                f"Mock decision. Found {len(evidence.marketplaces)} marketplace listing(s). "
                "Real Gemini analysis will run when GEMINI_API_KEY is set."
            ),
            case_summary=(
                f"Detected potential infringement on: "
                f"{', '.join(set(m.platform for m in evidence.marketplaces)) or 'none'}."
            ),
            priority="HIGH" if has_listings else "LOW"
        )

    model = ChatGoogleGenerativeAI(
        model="gemini-1.5-pro",
        temperature=0.0,
        google_api_key=api_key
    ).with_structured_output(Decision)

    prompt = f"""
You are a senior brand safety lawyer. Review the following evidence of potential trademark
infringement and make a decision on whether to pursue a takedown action.

Evidence:
- Marketplace listings: {len(evidence.marketplaces)} found
- Ads: {len(evidence.ads)} found
- Suspicious domains: {len(evidence.domains)} found
- Social media violations: {len(evidence.social)} found

Details:
{evidence.model_dump_json(indent=2)}

Return your structured decision with: recommendation (YES/NO), confidence (0-100),
detailed reasoning, a concise case summary, and priority (HIGH/MEDIUM/LOW).
"""

    return model.invoke(prompt)
```

---

### 2.2 — Test the Stub Locally

Create a quick test script `apps/api/tests/test_decision_stub.py`:

```python
from tracemark_api.services.ai import Evidence, MarketplaceEvidence
from tracemark_api.services.decision import make_decision
from datetime import datetime

def test_make_decision_with_dummy_evidence():
    dummy_evidence = Evidence(
        marketplaces=[
            MarketplaceEvidence(
                platform="amazon",
                seller_name="FakeBrandCo",
                listing_url="https://amazon.com/dp/FAKE123",
                price="$14.99"
            )
        ],
        ads=[],
        domains=[],
        social=[],
        timestamp=datetime.now()
    )

    decision = make_decision(dummy_evidence)

    assert decision.recommendation in ("YES", "NO")
    assert 0 <= decision.confidence <= 100
    assert decision.priority in ("HIGH", "MEDIUM", "LOW")
    assert len(decision.reasoning) > 0
    print(decision.model_dump_json(indent=2))

if __name__ == "__main__":
    test_make_decision_with_dummy_evidence()
    print("✅ Decision stub test passed")
```

Run with:
```bash
cd apps/api
python -m pytest tests/test_decision_stub.py -v
# or directly:
python tests/test_decision_stub.py
```

---

### 2.3 — Expose via FastAPI Endpoint

Add a stub endpoint to `monitoring.py` so Domantas (Engineer C) can call it with mock data from the frontend:

```python
# In apps/api/src/tracemark_api/routes/monitoring.py
from tracemark_api.services.decision import make_decision
from tracemark_api.services.ai import Evidence

@router.post("/make-decision")
def make_decision_endpoint(evidence: Evidence):
    decision = make_decision(evidence)
    return decision
```

This becomes `POST /api/v1/monitoring/make-decision`.

---

## File Summary

| File | Action |
|------|--------|
| `supabase/migrations/<ts>_initial_schema.sql` | **Create** — full schema SQL |
| `apps/api/src/tracemark_api/services/database.py` | **Create** — Supabase client + CRUD helpers |
| `apps/api/src/tracemark_api/services/decision.py` | **Create** — standalone `make_decision` function |
| `apps/api/src/tracemark_api/routes/monitoring.py` | **Update** — add `/make-decision` endpoint |
| `apps/api/pyproject.toml` | **Update** — add `supabase>=2.0.0` dependency |
| `.env.example` | **Update** — add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `apps/api/tests/test_decision_stub.py` | **Create** — stub test |

---

## Acceptance Criteria

- [ ] `cases`, `evidence`, `decisions` tables exist in Supabase with correct columns and FK constraints
- [ ] RLS is enabled on all three tables
- [ ] `supabase db push` runs without errors
- [ ] `make_decision(dummy_evidence)` returns a valid `Decision` object (mock mode, no API key needed)
- [ ] When `GEMINI_API_KEY` is set, Gemini 1.5 Pro returns a real structured decision
- [ ] `POST /api/v1/monitoring/make-decision` returns 200 with `Decision` JSON
- [ ] `database.py` `insert_case()`, `insert_evidence()`, `insert_decision()` work against live Supabase

---

## Environment Variables Required

```env
SUPABASE_URL=https://xxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...  # Service role key (NOT anon key)
GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxxxx    # Google AI Studio key (optional for stub)
```

---

## Notes for Integration (Week 2)

In Week 2, the full pipeline will be: `gather_evidence()` (Gabriel) → `make_decision()` (your function) → persist to Supabase (your `database.py`). Keep the `make_decision(evidence: Evidence) -> Decision` signature stable. The Supabase insert helpers will be called by the integration layer, not by the decision function itself.
