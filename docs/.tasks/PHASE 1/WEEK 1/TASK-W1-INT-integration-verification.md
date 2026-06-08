# TASK-W1-INT — Week 1 Integration & Verification

**Assigned to:** All Engineers (Led by Engineer C)
**Week:** Week 1 — End of Week Integration Session
**Priority:** 🔴 High
**Stack:** Python · FastAPI · React · Supabase · Mock Data

---

## Objective

Verify that all three Week 1 deliverables connect correctly end-to-end using mock data. Engineer C's frontend form should successfully call the `/api/v1/monitoring/gather-evidence` endpoint, which returns a valid `Evidence` JSON (real or mock), and the UI should display the result. Engineer B's Supabase schema should be reachable and the stub `make_decision` should return a valid `Decision` object.

**Definition of done for Week 1:**
```
Browser form → POST /api/v1/monitoring/gather-evidence → Evidence JSON → displayed in UI
Browser form → POST /api/v1/monitoring/make-decision (stub) → Decision JSON → displayed in UI
Supabase: cases, evidence, decisions tables exist and accept INSERT
```

---

## Context

This is not a feature task — it is a **glue and verification session**. All three engineers join a shared call or async review and run each other's code. The goal is to catch integration bugs before Week 2 increases dependencies.

At the end of Week 1, Engineer C is still using mock data from Engineer A's fallback mode and Engineer B's stub agent. This is expected. The integration test confirms the **interfaces are correct** so Week 2 wiring goes smoothly.

---

## Checklist

### 1. Backend API is Running

- [ ] `uvicorn tracemark_api.main:app --reload` starts without errors on `localhost:8000`
- [ ] `GET /health` returns `{"status": "ok"}`
- [ ] `GET /docs` (Swagger UI) loads and shows all routes including `/api/v1/monitoring/gather-evidence`

### 2. Engineer A — Scraper Verification

- [ ] Run with no API keys set — mock `Evidence` JSON is returned, no crash
- [ ] Run with `FIRECRAWL_API_KEY` set — real Amazon markdown is returned
- [ ] `POST /api/v1/monitoring/gather-evidence` with body `{"brand_name": "Nike", "platforms": ["amazon"]}` returns HTTP 200 with valid `Evidence` JSON
- [ ] The `Evidence` object has keys: `marketplaces`, `ads`, `domains`, `social`, `timestamp`

### 3. Engineer B — Supabase + Stub Agent Verification

- [ ] Supabase project URL and service role key are in `.env`
- [ ] Tables `cases`, `evidence`, `decisions` exist in the Supabase dashboard
- [ ] `POST /api/v1/monitoring/make-decision` with a dummy `Evidence` body returns a valid `Decision` JSON
- [ ] A test INSERT into the `cases` table succeeds (run the seed script or manual SQL)
- [ ] RLS policies are active — confirm in Supabase dashboard under Auth → Policies

### 4. Engineer C — Frontend Verification

- [ ] React dev server starts without errors (`npm run dev`)
- [ ] The brand name input form renders correctly at `localhost:5173`
- [ ] Submitting "Nike" calls `POST /api/v1/monitoring/gather-evidence` (check Network tab)
- [ ] The raw `Evidence` JSON response is displayed in the UI (even if unstyled)
- [ ] CORS is not blocking the frontend call — if it is, add `localhost:5173` to FastAPI CORS origins

### 5. Full End-to-End Flow

Run this sequence manually together:
1. Open browser at `localhost:5173`
2. Type "Nike" in the brand form and submit
3. Confirm the API call appears in Network tab with 200 response
4. Confirm mock evidence data renders in the UI
5. Open Supabase dashboard — confirm no schema errors

---

## Integration Bugs to Watch For

| Issue | Likely Cause | Fix |
|-------|-------------|-----|
| CORS error in browser | FastAPI missing CORS middleware | Add `CORSMiddleware` with `localhost:5173` |
| `Evidence` field mismatch | Engineer C using stale model shape | Re-align with `ai.py` Pydantic models |
| Supabase connection refused | Missing or wrong env vars | Check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env` |
| 422 Unprocessable Entity | Request body shape mismatch | Check `GatherEvidenceRequest` schema |
| Mock data not returning | `FIRECRAWL_API_KEY` partially set | Ensure both keys absent triggers mock path |

---

## Output of This Session

- [ ] Document any interface changes needed (field renames, type mismatches) in a shared note
- [ ] All three engineers confirm their Week 1 acceptance criteria pass
- [ ] Create a `INTEGRATION-NOTES-W1.md` in the repo root with any agreed interface contracts for Week 2
