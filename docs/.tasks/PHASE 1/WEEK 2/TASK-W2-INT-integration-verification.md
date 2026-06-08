# TASK-W2-INT — Week 2 Integration & End-to-End Verification

**Assigned to:** All Engineers (Led by Engineer B)
**Week:** Week 2 — End of Week Integration Session
**Priority:** 🔴 High
**Stack:** Python · FastAPI · React · Supabase · Gemini

---

## Objective

Verify the full end-to-end data flow with **real data**: brand name entered in the browser → scraper collects marketplace + ads + domain evidence → Gemini agent makes a real decision → result displayed in the UI → case persisted in Supabase.

**Definition of done for Week 2:**
```
Browser → POST /check-brand → gather_evidence (real scrape)
→ make_decision (real Gemini) → Supabase INSERT
→ Decision + Evidence rendered in React UI
```

---

## Context

Week 2 is the first week with real external API calls and real data flowing through the full stack. Integration bugs will be more complex than Week 1 — timing issues, API quota errors, schema mismatches between `Evidence`/`Decision` Pydantic models and TypeScript interfaces, and Supabase RLS blocking inserts.

Plan a 1–2 hour integration session at the end of the week. All three engineers must be present or available async to unblock each other quickly.

---

## Checklist

### 1. Backend Health

- [ ] `uvicorn` starts with no import errors
- [ ] `GET /health` returns 200
- [ ] All env vars set: `FIRECRAWL_API_KEY`, `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `GET /docs` shows all three routes: `/gather-evidence`, `/make-decision`, `/check-brand`

### 2. Engineer A — Enriched Evidence

- [ ] `POST /api/v1/monitoring/gather-evidence` with `{"brand_name": "Nike", "platforms": ["amazon", "google_ads", "domains"]}` returns 200
- [ ] Response has `marketplaces`, `ads`, `domains`, `social`, `timestamp` keys
- [ ] No Firecrawl credits used for `google_ads` or `domains` (check Firecrawl dashboard)

### 3. Engineer B — Real Gemini + Supabase Persistence

- [ ] `POST /api/v1/monitoring/check-brand {"brand_name": "Adidas"}` completes within 30 seconds
- [ ] `decision.risk_level` is one of `"HIGH"`, `"MEDIUM"`, `"LOW"` — not null
- [ ] `decision.case_summary` is a real AI-generated string (not hardcoded)
- [ ] Supabase dashboard shows new rows in `cases`, `evidence`, and `decisions` after the call
- [ ] Running the call twice creates two separate case rows (no deduplication errors)

### 4. Engineer C — UI Renders Real Data

- [ ] React dev server starts without TypeScript errors
- [ ] Submitting "Adidas" triggers a real API call (Network tab shows `/check-brand`)
- [ ] `AnalysisLoader` visible during call, disappears on result
- [ ] `DecisionCard` renders the real `risk_level` badge and `case_summary`
- [ ] `EvidenceAccordion` shows actual counts (e.g. "Marketplace Listings (3)")
- [ ] API error (e.g. Gemini quota exceeded) → `ErrorBanner` shown, no crash

### 5. Full End-to-End Test — Run Together

1. Open browser at `localhost:5173`
2. Type "Rolex" and submit
3. Watch `AnalysisLoader` cycle through steps
4. Confirm `DecisionCard` renders with real AI case summary
5. Open Supabase → `cases` table → confirm new row with `status: "complete"`
6. Open Supabase → `decisions` table → confirm `risk_level` and `case_summary` populated
7. Submit "Gucci" — confirm a new separate case is created

---

## Integration Bugs to Watch For

| Issue | Likely Cause | Fix |
|-------|-------------|-----|
| CORS error on `/check-brand` | New endpoint not in FastAPI `CORSMiddleware` | Add `localhost:5173` to allowed origins |
| `evidence.ads` is `null` not `[]` | Meta token missing → Python returns `None` | Ensure all `Evidence` fields default to `[]` |
| TypeScript error on `Decision` | Python model updated but TS interface not synced | Update `src/lib/api.ts` to match `ai.py` Pydantic fields |
| Supabase INSERT fails 403 | Using `ANON_KEY` instead of `SERVICE_ROLE_KEY` | Confirm backend uses `SUPABASE_SERVICE_ROLE_KEY` |
| Gemini 429 rate limit | Free tier quota hit | Switch both nodes to `gemini-1.5-flash` temporarily |
| Request timeout in browser | Gemini call > 30s | Increase fetch timeout or note for Week 3 streaming task |

---

## Output of This Session

- [ ] Full flow works with at least 2 different brand names tested
- [ ] Supabase shows persisted cases for all test runs
- [ ] All discovered interface contracts documented in `INTEGRATION-NOTES-W2.md` at repo root
- [ ] Any Gemini quota issues noted with agreed workarounds for Week 3
