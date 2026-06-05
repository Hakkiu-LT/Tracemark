# TASK-W2-B — Supabase Schema + Real Gemini Decision Agent (Engineer B)

**Assigned to:** Engineer B
**Week:** Week 2
**Priority:** 🔴 High
**Stack:** Python · FastAPI · Supabase · LangGraph · Google AI Studio (Gemini 1.5 Pro)

---

## Objective

Replace the Week 1 stub decision agent with a **real Gemini-powered LangGraph agent** that analyzes incoming `Evidence` and produces a structured `Decision` with a case summary, risk level, and recommended action. Simultaneously, persist the results to Supabase so cases survive across sessions.

**Success test:**
```python
evidence = Evidence(...)  # Real data from Engineer A's gather_evidence
decision = make_decision(evidence)
# Output: Decision JSON with:
#   risk_level: "HIGH" | "MEDIUM" | "LOW"
#   recommended_action: "TAKEDOWN" | "MONITOR" | "DISMISS"
#   case_summary: string (AI-generated)
#   confidence_score: float 0.0–1.0
# Side effect: case + decision rows inserted into Supabase
```

---

## Context

Week 1 delivered the Supabase schema (tables: `cases`, `evidence`, `decisions`) and a stub `make_decision` that returned hardcoded JSON. Week 2 replaces the stub with real Gemini calls via `langchain-google-genai`, wired into a LangGraph graph. The existing `ai.py` already has a working 2-node LangGraph graph — this task extends it into a production-ready agent that also persists its output.

**Important:** The document references "Claude API" for the decision agent — for this project we are using **Google AI Studio / Gemini** (`gemini-1.5-pro` for decisions, `gemini-1.5-flash` for evidence analysis). Do not integrate Anthropic/Claude.

---

## Step-by-Step Implementation

### Step 1 — Finalize Supabase Schema

Ensure all three tables exist with the correct schema. Run this SQL in the Supabase SQL editor if not already done:

```sql
-- Cases table: one row per brand monitoring request
CREATE TABLE IF NOT EXISTS cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending | analyzing | complete | dismissed
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    organization_id UUID  -- for multi-tenant (Week 3+)
);

-- Evidence table: raw evidence blob per case
CREATE TABLE IF NOT EXISTS evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    marketplaces JSONB DEFAULT '[]',
    ads JSONB DEFAULT '[]',
    domains JSONB DEFAULT '[]',
    social JSONB DEFAULT '[]',
    raw_scrape_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Decisions table: AI agent output per case
CREATE TABLE IF NOT EXISTS decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    risk_level TEXT NOT NULL,           -- HIGH | MEDIUM | LOW
    recommended_action TEXT NOT NULL,   -- TAKEDOWN | MONITOR | DISMISS
    case_summary TEXT NOT NULL,
    confidence_score FLOAT NOT NULL DEFAULT 0.0,
    evidence_quality TEXT,              -- STRONG | MODERATE | WEAK
    key_findings JSONB DEFAULT '[]',    -- array of finding strings
    gemini_model TEXT DEFAULT 'gemini-1.5-pro',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_cases_brand ON cases(brand_name);
CREATE INDEX IF NOT EXISTS idx_decisions_risk ON decisions(risk_level);
CREATE INDEX IF NOT EXISTS idx_evidence_case ON evidence(case_id);
```

---

### Step 2 — Supabase Python Client

Create `apps/api/src/tracemark_api/services/database.py`:

```python
from supabase import create_client, Client
import os
from tracemark_api.services.ai import Evidence, Decision

def get_supabase() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


def create_case(brand_name: str) -> str:
    """Insert a new case row and return its UUID."""
    sb = get_supabase()
    result = sb.table("cases").insert({"brand_name": brand_name, "status": "pending"}).execute()
    return result.data[0]["id"]


def save_evidence(case_id: str, evidence: Evidence) -> str:
    """Persist an Evidence object to the evidence table. Returns evidence row UUID."""
    sb = get_supabase()
    result = sb.table("evidence").insert({
        "case_id": case_id,
        "marketplaces": [m.dict() for m in evidence.marketplaces],
        "ads": evidence.ads,
        "domains": evidence.domains,
        "social": evidence.social,
    }).execute()
    return result.data[0]["id"]


def save_decision(case_id: str, decision: Decision) -> str:
    """Persist a Decision object to the decisions table. Returns decision row UUID."""
    sb = get_supabase()
    result = sb.table("decisions").insert({
        "case_id": case_id,
        "risk_level": decision.risk_level,
        "recommended_action": decision.recommended_action,
        "case_summary": decision.case_summary,
        "confidence_score": decision.confidence_score,
        "evidence_quality": decision.evidence_quality,
        "key_findings": decision.key_findings,
    }).execute()
    # Update case status to complete
    sb.table("cases").update({"status": "complete"}).eq("id", case_id).execute()
    return result.data[0]["id"]


def get_case_with_decision(case_id: str) -> dict:
    """Fetch a full case record joined with its decision."""
    sb = get_supabase()
    case = sb.table("cases").select("*, decisions(*)").eq("id", case_id).single().execute()
    return case.data
```

---

### Step 3 — Expand Pydantic Models

Update the `Decision` model in `apps/api/src/tracemark_api/services/ai.py` to include all fields the Gemini agent will return:

```python
from pydantic import BaseModel, Field
from typing import Literal

class Decision(BaseModel):
    risk_level: Literal["HIGH", "MEDIUM", "LOW"]
    recommended_action: Literal["TAKEDOWN", "MONITOR", "DISMISS"]
    case_summary: str = Field(description="2-3 sentence AI-generated summary of findings")
    confidence_score: float = Field(ge=0.0, le=1.0, description="Agent confidence in this decision")
    evidence_quality: Literal["STRONG", "MODERATE", "WEAK"] = "MODERATE"
    key_findings: list[str] = Field(default_factory=list, description="Bullet list of key evidence points")
```

---

### Step 4 — Real Gemini Decision Agent (LangGraph)

Replace the stub in `ai.py` with a real 2-node LangGraph graph using `gemini-1.5-pro`:

```python
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, END
from typing import TypedDict
import os

class AgentState(TypedDict):
    evidence: Evidence
    decision: Decision | None
    error: str | None


def _analyze_evidence_node(state: AgentState) -> AgentState:
    """
    Node 1: Uses gemini-1.5-flash to pre-analyze raw evidence
    and produce a structured summary before the decision node.
    """
    evidence = state["evidence"]
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        state["error"] = "GEMINI_API_KEY not set"
        return state

    model = ChatGoogleGenerativeAI(
        model="gemini-1.5-flash",
        temperature=0.0,
        google_api_key=api_key,
    )
    prompt = f"""
Analyze the following brand protection evidence and summarize the findings.
Focus on: number of suspicious listings, type of ads detected, suspicious domains found.

Evidence:
- Marketplace listings: {len(evidence.marketplaces)} found
- Listings detail: {[m.dict() for m in evidence.marketplaces[:5]]}
- Ads detected: {evidence.ads[:5]}
- Suspicious domains: {evidence.domains[:10]}

Return a concise factual summary (3-5 sentences) of what was found.
"""
    response = model.invoke(prompt)
    state["analysis_summary"] = response.content
    return state


def _make_decision_node(state: AgentState) -> AgentState:
    """
    Node 2: Uses gemini-1.5-pro to produce the final structured Decision
    based on the evidence and the analysis summary from Node 1.
    """
    evidence = state["evidence"]
    summary = state.get("analysis_summary", "")
    api_key = os.environ.get("GEMINI_API_KEY")

    model = ChatGoogleGenerativeAI(
        model="gemini-1.5-pro",
        temperature=0.0,
        google_api_key=api_key,
    )

    prompt = f"""
You are a brand protection legal analyst. Based on the evidence summary below, 
make a structured enforcement decision.

Evidence Summary: {summary}

Raw counts:
- Suspicious marketplace listings: {len(evidence.marketplaces)}
- Suspicious ads: {len(evidence.ads)}
- Suspicious domains: {len(evidence.domains)}

Return a JSON object with exactly these fields:
- risk_level: "HIGH" | "MEDIUM" | "LOW"
- recommended_action: "TAKEDOWN" | "MONITOR" | "DISMISS"
- case_summary: string (2-3 sentences explaining the decision)
- confidence_score: float between 0.0 and 1.0
- evidence_quality: "STRONG" | "MODERATE" | "WEAK"
- key_findings: array of strings (max 5 bullet points)

Decision criteria:
- HIGH + TAKEDOWN: 5+ suspicious listings OR counterfeit evidence found
- MEDIUM + MONITOR: 1-4 suspicious listings OR suspicious ads/domains
- LOW + DISMISS: No real evidence found
"""
    structured_model = model.with_structured_output(Decision)
    try:
        decision = structured_model.invoke(prompt)
        state["decision"] = decision
    except Exception as e:
        state["error"] = str(e)
        state["decision"] = Decision(
            risk_level="LOW",
            recommended_action="DISMISS",
            case_summary="Agent error — could not complete analysis.",
            confidence_score=0.0,
            evidence_quality="WEAK",
            key_findings=[],
        )
    return state


def build_decision_graph():
    """Build and compile the LangGraph decision agent."""
    graph = StateGraph(AgentState)
    graph.add_node("analyze_evidence", _analyze_evidence_node)
    graph.add_node("make_decision", _make_decision_node)
    graph.set_entry_point("analyze_evidence")
    graph.add_edge("analyze_evidence", "make_decision")
    graph.add_edge("make_decision", END)
    return graph.compile()


# Public function — called by Engineer C's endpoint and by Engineer B's own tests
def make_decision(evidence: Evidence) -> Decision:
    """
    Main entrypoint for the decision agent.
    Runs the LangGraph pipeline and returns a Decision object.
    """
    graph = build_decision_graph()
    final_state = graph.invoke({"evidence": evidence, "decision": None, "error": None})
    return final_state["decision"]
```

---

### Step 5 — Wire Decision + Persistence into FastAPI

Update `monitoring.py` to add a full `/check-brand` endpoint that runs both gather_evidence (A) and make_decision (B) and persists to Supabase:

```python
from tracemark_api.services.marketplace import gather_evidence
from tracemark_api.services.ai import make_decision
from tracemark_api.services.database import create_case, save_evidence, save_decision

class CheckBrandRequest(BaseModel):
    brand_name: str
    platforms: list[str] = ["amazon", "google_ads", "domains"]

@router.post("/check-brand")
def check_brand(payload: CheckBrandRequest):
    """
    Full pipeline: scrape evidence → AI decision → persist to Supabase.
    Returns case_id + decision JSON.
    """
    case_id = create_case(payload.brand_name)
    evidence = gather_evidence(payload.brand_name, payload.platforms)
    save_evidence(case_id, evidence)
    decision = make_decision(evidence)
    save_decision(case_id, decision)
    return {"case_id": case_id, "decision": decision.dict(), "evidence": evidence.dict()}
```

---

## File Summary

| File | Action |
|------|--------|
| `apps/api/src/tracemark_api/services/ai.py` | **Update** — expand `Decision` model, replace stub with real LangGraph agent |
| `apps/api/src/tracemark_api/services/database.py` | **Create** — Supabase persistence functions |
| `apps/api/src/tracemark_api/routes/monitoring.py` | **Update** — add `/check-brand` full pipeline endpoint |
| Supabase SQL Editor | **Run** — schema SQL from Step 1 |
| `.env.example` | **Update** — confirm `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` |

---

## Acceptance Criteria

- [ ] `make_decision(dummy_evidence)` returns a valid `Decision` object with all 6 fields populated
- [ ] Gemini API is called with real evidence data — not hardcoded/stub responses
- [ ] Decision is persisted to Supabase `decisions` table after every call
- [ ] Evidence is persisted to Supabase `evidence` table after every `gather_evidence` call
- [ ] `POST /api/v1/monitoring/check-brand` runs the full pipeline end-to-end and returns 200
- [ ] If `GEMINI_API_KEY` is missing, the agent returns a graceful fallback `Decision` (not a crash)
- [ ] Engineer C can call `/check-brand` and get a response without needing direct Supabase access
