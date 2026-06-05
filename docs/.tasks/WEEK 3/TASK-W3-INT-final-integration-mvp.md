# TASK-W3-INT — Week 3 Final Integration & MVP Sign-Off

**Assigned to:** All Engineers (Led by Engineer A)
**Week:** Week 3 — Final Integration Session
**Priority:** 🔴 High
**Stack:** Full Stack — Python · FastAPI · React · Supabase · Gemini · Firecrawl

---

## Objective

Final end-to-end verification of the complete MVP. Every happy path, edge case, and error path must work together. This session doubles as the **MVP demo rehearsal** for the Orbio World pitch.

**Definition of MVP done:**
```
A user can enter any brand name → the system scrapes Amazon + Ads + Domains →
Gemini produces a risk decision → results are displayed in a polished UI →
the case is persisted in Supabase → the user can review all past cases in History
```

---

## Context

This is the highest-stakes integration session of the project. All three engineers' Week 3 work comes together here. Unlike W1-INT and W2-INT which used partial flows, this session tests the **complete production path** including retry logic (Engineer A), evidence scoring (Engineer B), and case history (Engineer C).

Plan a **2-hour block** for this session. The first hour is systematic test execution. The second hour is polish and bug fixes.

---

## Pre-Session Checklist

**Engineer A**
- [ ] `pytest apps/api/tests/test_scraper_brands.py` passes with 0 failures
- [ ] Retry logic tested manually: disconnect internet mid-scrape → no crash
- [ ] `SocialMediaScraper` returns a list (no exception) when called

**Engineer B**
- [ ] `pytest apps/api/tests/test_decision_agent.py` passes with 0 failures
- [ ] Empty evidence short-circuit confirmed: Gemini is not called
- [ ] Supabase `decisions` table has `evidence_score` column

**Engineer C**
- [ ] `tsc --noEmit` passes with 0 TypeScript errors
- [ ] Case History page loads and shows real rows from Supabase
- [ ] `ErrorBanner` renders for timeout / offline / quota cases

---

## Test Suite — Run in Order

### Test 1: Happy Path — High Risk Brand

**Brand:** `"Rolex"` | **Platforms:** `["amazon", "google_ads", "domains"]`

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open `localhost:5173`, submit "Rolex" | `AnalysisLoader` appears immediately |
| 2 | Wait up to 30s | `DecisionCard` renders |
| 3 | Check `risk_level` | `HIGH` or `MEDIUM` |
| 4 | Check `case_summary` | AI-written paragraph, not template text |
| 5 | Check confidence bar | Animates to correct percentage |
| 6 | Open Marketplace accordion | Shows listings or styled empty state |
| 7 | Open Supabase dashboard | New rows in `cases`, `evidence`, `decisions` |
| 8 | Check `decisions.evidence_score` | Non-zero float present |

### Test 2: Empty Evidence — No Results Brand

**Brand:** `"ZXQ_FakeBrand_99999"`

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Submit brand | `AnalysisLoader` appears |
| 2 | Wait for completion | `DecisionCard` renders with `DISMISS` |
| 3 | Check accordion sections | All 3 show styled `EmptyState` components |
| 4 | Check confidence | > 50% |
| 5 | Verify Gemini not called | Confirm in server logs |
| 6 | Open Supabase | Case row exists with `status: "complete"` |

### Test 3: Backend Offline

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Stop `uvicorn` | Backend offline |
| 2 | Submit any brand | `ErrorBanner` appears gracefully |
| 3 | No crash | UI remains usable |
| 4 | Restart backend | Normal flow resumes |

### Test 4: Case History & Navigation

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Submit 3 different brands | 3 separate cases created |
| 2 | Navigate to `/history` | All 3 cases visible newest first |
| 3 | Click oldest case | Navigates to `/case/:id` |
| 4 | Full CaseView loads | Decision + Evidence from Supabase |
| 5 | Click "Re-scan" | New API call, new case row |

### Test 5: Evidence Filters

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Submit a brand with listings | Listings visible |
| 2 | Click "No Reviews" | Only no-review listings shown |
| 3 | Click "Under $20" | Only cheap listings shown |
| 4 | Click "All" | Full list restored |
| 5 | Check domains | Sorted newest first |

### Test 6: Retry Logic Under Load

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Submit 3 brands back-to-back | All complete without crash |
| 2 | Check logs | Retry attempts logged when needed |
| 3 | Check Supabase | 3 separate complete cases |
| 4 | Check Firecrawl dashboard | Credit usage < 50 total |

### Test 7: Full pytest Suite

Run:
```bash
cd apps/api
pytest tests/ -v --tb=short
```

Expected result:
- [ ] scraper tests pass
- [ ] decision agent tests pass
- [ ] 0 failures overall

### Test 8: Invalid Gemini Key

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Set `GEMINI_API_KEY=invalid_key_xyz` | — |
| 2 | Restart backend | Server starts |
| 3 | Submit "Nike" | Fallback `Decision` returned, no 500 |
| 4 | Frontend displays fallback | No crash |
| 5 | Restore real key | Normal flow resumes |

---

## Integration Bugs to Watch For

| Issue | Likely Cause | Fix |
|-------|-------------|-----|
| `evidence.brand_name` undefined in Re-scan | Brand name not passed into `CaseView` | Pass brand name separately in props |
| History page shows `null` decisions | Missing RLS anon policy | Add `SELECT` policy for anon role |
| `evidence_score` missing in Supabase | W3-B migration not applied | Run `ALTER TABLE decisions ADD COLUMN ...` |
| TypeScript mismatch on `social` | Interface missing `social` field | Add `social: unknown[]` |
| Gemini 429 | Free tier quota | Switch to `gemini-1.5-flash` temporarily |
| History page blank after refresh | Supabase env vars missing | Confirm `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` |

---

## MVP Sign-Off Checklist

**Functionality**
- [ ] All 8 tests above pass
- [ ] `pytest tests/` passes with 0 failures
- [ ] Supabase has at least 5 real case rows from testing session

**Quality**
- [ ] No `console.error` in browser DevTools during normal flows
- [ ] No unhandled Python exceptions in server logs
- [ ] `tsc --noEmit` passes with 0 TypeScript errors
- [ ] Firecrawl credit usage ≤ 50 credits for the test session

**Performance**
- [ ] Case History page loads in < 2 seconds
- [ ] `POST /check-brand` responds within 35 seconds
- [ ] Frontend does not freeze during analysis

**Documentation**
- [ ] `MVP-DEMO-NOTES.md` created at repo root with:
  - What is real vs mocked
  - Known limitations
  - Confirmed working sources
  - Local demo run instructions
