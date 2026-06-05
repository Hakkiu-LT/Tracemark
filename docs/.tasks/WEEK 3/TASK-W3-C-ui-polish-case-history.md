# TASK-W3-C — UI Polish, Case History & Filters (Engineer C)

**Assigned to:** Engineer C (Domantas)
**Week:** Week 3
**Priority:** 🟡 Medium-High
**Stack:** React · TypeScript · Tailwind CSS · Supabase JS Client · Lovable

---

## Objective

Polish the UI to production quality: add a **Case History** page that loads all past scans from Supabase, add **filters and sorting** on the evidence accordion, and implement proper error messages and empty states throughout every view.

**Success test:**
```
1. User submits "Nike" → case saved → appears in Case History page
2. User submits "FakeBrand999XYZ" (no results) → DISMISS shown, all accordion sections
   display styled empty states (not blank panels)
3. Backend goes offline → frontend shows ErrorBanner, no white screen, no console crash
4. User clicks past case in history → full CaseView reloads from Supabase
```

---

## Context

Week 2 delivered a working end-to-end flow but with raw JSON displays and no history. Week 3 makes this feel like a real product. Engineer B's Supabase schema has `cases` joined with `decisions` — use the Supabase JS client directly from the frontend for read-only history queries. All write operations (creating cases, saving decisions) still go through the FastAPI backend.

---

## Step-by-Step Implementation

### Step 1 — Supabase JS Client Setup

Install and configure the Supabase JS client for frontend read access:

```bash
npm install @supabase/supabase-js
```

Create `src/lib/supabase.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface CaseRow {
  id: string;
  brand_name: string;
  status: string;
  created_at: string;
  decisions: DecisionRow[] | null;
}

export interface DecisionRow {
  id: string;
  risk_level: "HIGH" | "MEDIUM" | "LOW";
  recommended_action: "TAKEDOWN" | "MONITOR" | "DISMISS";
  case_summary: string;
  confidence_score: number;
  evidence_quality: string;
  key_findings: string[];
  created_at: string;
}

export async function fetchCaseHistory(): Promise<CaseRow[]> {
  const { data, error } = await supabase
    .from("cases")
    .select("*, decisions(*)")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchCaseById(caseId: string): Promise<CaseRow | null> {
  const { data, error } = await supabase
    .from("cases")
    .select("*, decisions(*), evidence(*)")
    .eq("id", caseId)
    .single();
  if (error) return null;
  return data;
}
```

Add to `.env.local`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

### Step 2 — Case History Page

Create `src/pages/CaseHistory.tsx`:

```typescript
import { useEffect, useState } from "react";
import { fetchCaseHistory, CaseRow } from "@/lib/supabase";
import { CaseHistoryTable } from "@/components/CaseHistoryTable";
import { ErrorBanner } from "@/components/ErrorBanner";
import { EmptyState } from "@/components/EmptyState";

export function CaseHistory() {
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCaseHistory()
      .then(setCases)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="history-loading">Loading case history...</div>;
  if (error) return <ErrorBanner message={`Failed to load history: ${error}`} />;
  if (cases.length === 0) return <EmptyState message="No cases yet. Submit a brand name to get started." />;

  return (
    <div className="case-history-page">
      <h1>Case History</h1>
      <p className="subtitle">{cases.length} case(s) monitored</p>
      <CaseHistoryTable cases={cases} />
    </div>
  );
}
```

Create `src/components/CaseHistoryTable.tsx`:

```typescript
import { useNavigate } from "react-router-dom";
import { CaseRow } from "@/lib/supabase";

const RISK_BADGE: Record<string, string> = {
  HIGH: "badge-red",
  MEDIUM: "badge-yellow",
  LOW: "badge-green",
};

export function CaseHistoryTable({ cases }: { cases: CaseRow[] }) {
  const navigate = useNavigate();

  return (
    <table className="case-table">
      <thead>
        <tr>
          <th>Brand</th>
          <th>Risk Level</th>
          <th>Action</th>
          <th>Confidence</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        {cases.map((c) => {
          const decision = c.decisions?.[0];
          return (
            <tr
              key={c.id}
              className="case-row"
              onClick={() => navigate(`/case/${c.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && navigate(`/case/${c.id}`)}
            >
              <td className="brand-name">{c.brand_name}</td>
              <td>
                {decision ? (
                  <span className={`badge ${RISK_BADGE[decision.risk_level]}`}>
                    {decision.risk_level}
                  </span>
                ) : (
                  <span className="badge badge-gray">Pending</span>
                )}
              </td>
              <td>{decision?.recommended_action ?? "—"}</td>
              <td>{decision ? `${Math.round(decision.confidence_score * 100)}%` : "—"}</td>
              <td>{new Date(c.created_at).toLocaleDateString()}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
```

---

### Step 3 — Case Detail Route (Load from Supabase)

Add a `/case/:id` route so clicking a history row reloads the full CaseView from Supabase:

```typescript
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { fetchCaseById, CaseRow } from "@/lib/supabase";
import { CaseView } from "@/components/CaseView";
import { ErrorBanner } from "@/components/ErrorBanner";

export function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const [caseData, setCaseData] = useState<CaseRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchCaseById(id)
      .then(setCaseData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div>Loading case...</div>;
  if (error || !caseData) return <ErrorBanner message="Case not found or failed to load." />;

  const evidence = (caseData as any).evidence?.[0];
  const decision = caseData.decisions?.[0];
  if (!evidence || !decision) return <ErrorBanner message="Case data incomplete." />;

  return <CaseView data={{ case_id: caseData.id, decision, evidence }} />;
}
```

---

### Step 4 — Evidence Accordion Filters

Update `EvidenceAccordion.tsx` to add filter controls on the Marketplace Listings section:

```typescript
const [marketplaceFilter, setMarketplaceFilter] = useState<"all" | "no-reviews" | "low-price">("all");

const filteredListings = evidence.marketplaces.filter((m) => {
  if (marketplaceFilter === "no-reviews") return !(m as any).reviews || (m as any).reviews === "0";
  if (marketplaceFilter === "low-price") {
    const price = parseFloat((m.price ?? "").replace(/[^0-9.]/g, ""));
    return !isNaN(price) && price < 20;
  }
  return true;
});
```

For the Domains section, sort newest registration first:

```typescript
const sortedDomains = [...evidence.domains].sort((a: any, b: any) =>
  new Date(b.created_date).getTime() - new Date(a.created_date).getTime()
);
```

---

### Step 5 — Empty State Component

Create `src/components/EmptyState.tsx`:

```typescript
interface EmptyStateProps {
  icon?: string;
  message: string;
  subtext?: string;
}

export function EmptyState({ icon = "🔍", message, subtext }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <p className="empty-message">{message}</p>
      {subtext && <p className="empty-subtext">{subtext}</p>}
    </div>
  );
}
```

---

### Step 6 — Error Banner Component

Create `src/components/ErrorBanner.tsx`:

```typescript
interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

const FRIENDLY_ERRORS: Record<string, string> = {
  "Failed to fetch": "Could not reach the server. Check your connection and try again.",
  "504": "The analysis timed out. Gemini AI can take up to 30 seconds — please retry.",
  "429": "AI analysis is temporarily unavailable due to quota limits. Raw evidence is shown.",
  "Network Error": "You appear to be offline. Please check your internet connection.",
};

export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  const friendly = Object.entries(FRIENDLY_ERRORS).find(([key]) => message.includes(key))?.[1] ?? message;

  return (
    <div className="error-banner" role="alert">
      <span className="error-icon">⚠️</span>
      <p>{friendly}</p>
      {onRetry && <button className="retry-btn" onClick={onRetry}>Try Again</button>}
    </div>
  );
}
```

---

### Step 7 — Confidence Score Progress Bar

Replace the plain text `confidence_score` in `DecisionCard` with an animated fill bar:

```typescript
<div className="confidence-bar-container">
  <span className="confidence-label">
    Confidence: {Math.round(decision.confidence_score * 100)}%
  </span>
  <div className="confidence-bar-track">
    <div
      className="confidence-bar-fill"
      style={{ "--target-width": `${decision.confidence_score * 100}%` } as React.CSSProperties}
    />
  </div>
</div>
```

```css
.confidence-bar-fill {
  height: 6px;
  border-radius: 3px;
  background: var(--color-primary);
  width: 0%;
  animation: fillBar 0.8s ease-out 0.3s forwards;
}

@keyframes fillBar {
  to { width: var(--target-width); }
}
```

---

### Step 8 — Re-scan Button

Add a "Re-scan" button to `CaseView` that re-submits the brand name and creates a new case row.

---

## File Summary

| File | Action |
|------|--------|
| `src/lib/supabase.ts` | **Create** — Supabase JS client + query functions |
| `src/pages/CaseHistory.tsx` | **Create** — Case History page |
| `src/pages/CaseDetail.tsx` | **Create** — Individual case detail from Supabase |
| `src/components/CaseHistoryTable.tsx` | **Create** — Sortable case table |
| `src/components/EmptyState.tsx` | **Create** — Reusable empty state |
| `src/components/ErrorBanner.tsx` | **Create** — Friendly error messages |
| `src/components/EvidenceAccordion.tsx` | **Update** — Add filters + sort + empty states |
| `src/components/DecisionCard.tsx` | **Update** — Animated confidence bar |
| `src/components/CaseView.tsx` | **Update** — Add Re-scan button |
| `src/App.tsx` | **Update** — Add `/history` and `/case/:id` routes |
| `.env.local` | **Update** — Add Supabase URL + anon key |

---

## Acceptance Criteria

- [ ] Case History page loads in under 2 seconds and shows all past cases ordered by date
- [ ] Clicking a history row navigates to `/case/:id` and reloads full Decision + Evidence from Supabase
- [ ] All 3 accordion sections show styled `EmptyState` components when count is 0
- [ ] `ErrorBanner` shows friendly messages for timeout, offline, and quota errors
- [ ] Confidence score animates from 0% to the correct value on render
- [ ] Marketplace filter buttons correctly filter the listings list
- [ ] Domain results are sorted newest registration first
- [ ] Re-scan button re-runs the analysis for the same brand and creates a new case row
