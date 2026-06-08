# Phase 2 — Week 1: Detection Engine Foundation

> **Goal:** Build the core keyword/image matching pipeline that flags trademark violations, with each engineer working on a parallel, independently testable module.

---

## Engineer A — Keyword & Listing Matcher

**Focus:** Write the script that compares scraped marketplace/web data against stored trademarks and flags suspicious matches.

### Tasks
- [ ] Define a `TrademarksRepository` interface in `packages/detection` that reads brand names, keywords, and logo hashes from Supabase (`trademarks` table, built in Phase 1).
- [ ] Implement `keywordMatcher(listing: Listing, trademark: Trademark): MatchResult` — exact match + Levenshtein distance (threshold ≤ 2) for fuzzy brand-name detection.
- [ ] Implement `hashMatcher(imageUrl: string, trademark: Trademark): MatchResult` — perceptual hash (pHash) comparison against stored logo hashes (use `sharp` + `imghash`).
- [ ] Write unit tests covering: exact match, fuzzy match, no-match, image hash collision.
- [ ] Output: `MatchResult` type `{ score: number; riskLevel: 'HIGH' | 'MEDIUM' | 'LOW'; matchType: 'keyword' | 'image' | 'both'; evidence: string[] }`.

### Test Command
```bash
bun test packages/detection/src/matchers.test.ts
```

### Deliverable
`packages/detection/src/matchers.ts` + unit tests passing locally.

---

## Engineer B — Risk Scoring & Flag Persistence

**Focus:** Assign risk levels to match results and persist flagged infringements to Supabase.

### Tasks
- [ ] Design and run Supabase migration: `infringements` table with fields `id`, `trademark_id`, `source_url`, `platform`, `risk_level`, `match_score`, `status` (`flagged | reviewed | dismissed`), `flagged_at`.
- [ ] Implement `riskScorer(matches: MatchResult[]): RiskLevel` — composite scoring logic: `HIGH` if score > 0.85 or image match confirmed; `MEDIUM` if 0.6–0.85; `LOW` below.
- [ ] Implement `persistInfringement(flagged: FlaggedListing): Promise<Infringement>` — upsert to Supabase, deduplicate by `source_url + trademark_id`.
- [ ] Write integration tests against a local Supabase instance (use `supabase start`).
- [ ] Output: verified infringement rows visible in Supabase dashboard.

### Test Command
```bash
bun test packages/detection/src/persistence.test.ts
```

### Deliverable
`supabase/migrations/YYYYMMDD_infringements.sql` + `packages/detection/src/persistence.ts`.

---

## Engineer C — Detection API Endpoint & Alert Feed UI

**Focus:** Expose detection results via API and display them as the live "Infringement Alert Feed" on the dashboard.

### Tasks
- [ ] Create `GET /api/infringements` endpoint — query Supabase `infringements` table, support filters: `?trademark_id=`, `?risk_level=`, `?platform=`, `?status=`.
- [ ] Stub response format matching the final schema (use mock data from Phase 1 fixtures while A/B are not connected yet).
- [ ] Build `<InfringementAlertFeed />` React component in `src/components/dashboard/` — renders a scrollable feed with risk badge (red/yellow/green), platform icon, thumbnail placeholder, and timestamp.
- [ ] Wire `useInfringements()` hook to call `GET /api/infringements` with polling every 30s.
- [ ] Output: Feed visible on Dashboard Overview page with mock data state changes on click.

### Test Command
```bash
bun run dev  # visual check + Storybook story
```

### Deliverable
`src/components/dashboard/InfringementAlertFeed.tsx` + `apps/api/routes/infringements.ts`.

---

## Integration Point (End of Week 1)
- **None required yet** — Engineer C uses mock fixtures.
- Shared contract: all three engineers align on `MatchResult` and `Infringement` TypeScript types in `packages/detection/src/types.ts` before end of day 1.

---

## Definition of Done
- [ ] `keywordMatcher` + `hashMatcher` unit tests pass with ≥ 90% coverage.
- [ ] `infringements` migration applied to local Supabase.
- [ ] Alert Feed renders on `/dashboard` with mock data.
- [ ] All three engineers have reviewed and agreed on shared types.
