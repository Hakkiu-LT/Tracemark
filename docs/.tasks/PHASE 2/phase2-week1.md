# Phase 2 — Week 1: Detection Engine Foundation

> **Goal:** Build the core keyword/image matching pipeline that flags trademark violations, with each engineer working on a parallel, independently testable module.

---

## Engineer A — Keyword & Listing Matcher (Python Backend)

**Focus:** Write the service that compares scraped marketplace/web data against stored trademarks and flags suspicious matches.

### Tasks
- [ ] Define a Python interface in `tracemark_api/services/detection.py` that reads brand names, keywords, and logo hashes from Supabase (`trademarks` table).
- [ ] Implement `keyword_matcher(listing_text: str, brand_name: str) -> MatchResult` — exact match + Levenshtein distance (threshold ≤ 2) for fuzzy brand-name detection (use a Python library like `Levenshtein` or `difflib`).
- [ ] Implement `hash_matcher(image_url: str, trademark_logo_hash: str) -> MatchResult` — perceptual hash (pHash) comparison against stored logo hashes (use Python's `ImageHash` + `Pillow` libraries).
- [ ] Write pytest unit tests in `apps/api/tests/test_matchers.py` covering: exact match, fuzzy match, no-match, image hash collision.
- [ ] Output: `MatchResult` dict or Pydantic model: `{"score": float, "risk_level": "HIGH" | "MEDIUM" | "LOW", "match_type": "keyword" | "image" | "both", "evidence": list[str]}`.

### Test Command
```bash
pytest tests/test_matchers.py
```

### Deliverable
`apps/api/src/tracemark_api/services/detection.py` + unit tests passing locally.

---

## Engineer B — Risk Scoring & Flag Persistence (Python Backend)

**Focus:** Assign risk levels to match results and persist flagged infringements to Supabase.

### Tasks
- [ ] Design and run Supabase migration: `infringements` table with fields `id`, `trademark_id`, `source_url`, `platform`, `risk_level`, `match_score`, `status` (`flagged | reviewed | dismissed`), `flagged_at`.
- [ ] Implement `risk_scorer(matches: list[dict]) -> str` — composite scoring logic: `HIGH` if score > 0.85 or image match confirmed; `MEDIUM` if 0.6–0.85; `LOW` below.
- [ ] Implement `persist_infringement(flagged: dict) -> dict` — upsert to Supabase using the python `supabase` SDK, deduplicating by `source_url + trademark_id`.
- [ ] Write integration tests in `apps/api/tests/test_persistence.py` against a local Supabase instance.
- [ ] Output: verified infringement rows visible in Supabase dashboard.

### Test Command
```bash
pytest tests/test_persistence.py
```

### Deliverable
`supabase/migrations/YYYYMMDD_infringements.sql` + `apps/api/src/tracemark_api/services/persistence.py`.

---

## Engineer C — Detection API Endpoint & Alert Feed UI (FastAPI & React)

**Focus:** Expose detection results via API and display them as the live "Infringement Alert Feed" on the dashboard.

### Tasks
- [ ] Create `GET /api/v1/infringements` endpoint in `apps/api/src/tracemark_api/routes/infringements.py` — query Supabase `infringements` table, support filters: `?trademark_id=`, `?risk_level=`, `?platform=`, `?status=`.
- [ ] Stub response format matching the final schema (use mock data from fixtures while backend logic is being connected).
- [ ] Build `<InfringementAlertFeed />` React component in `src/components/dashboard/` — renders a scrollable feed with risk badge (red/yellow/green), platform icon, thumbnail placeholder, and timestamp.
- [ ] Wire TanStack React Query `useQuery` hook to call `GET /api/v1/infringements` with polling every 30s.
- [ ] Output: Feed visible on Dashboard Overview page with mock data state changes on click.

### Test Command
```bash
npm run dev  # visual check + test polling
```

### Deliverable
`src/components/dashboard/InfringementAlertFeed.tsx` + `apps/api/src/tracemark_api/routes/infringements.py`.

---

## Integration Point (End of Week 1)
- **None required yet** — Engineer C uses mock fixtures.
- Shared contract: all three engineers align on `MatchResult` and `Infringement` data schemas in Python and TypeScript interfaces before end of day 1.

---

## Definition of Done
- [ ] `keyword_matcher` + `hash_matcher` unit tests pass with ≥ 90% coverage.
- [ ] `infringements` migration applied to local Supabase.
- [ ] Alert Feed renders on `/dashboard` with mock data.
- [ ] All three engineers have reviewed and agreed on shared data schemas.
