# TASK-W2-C — Wire Frontend to Real Endpoints & Case View

**Assigned to:** Engineer C (Domantas)
**Week:** Week 2
**Priority:** 🔴 High
**Stack:** React · TypeScript · Tailwind CSS · Lovable

---

## Objective

Replace all mock data in the frontend with real API calls to the live backend. Build a proper **Case View** that displays the full `Evidence` and `Decision` returned by the `/api/v1/monitoring/check-brand` endpoint. By end of week, a user can type a brand name, submit it, and see real AI-generated analysis results on screen.

**Success test:**
```
User types "Nike" → clicks "Check Brand"
→ POST /api/v1/monitoring/check-brand is called
→ Loading state shown while API runs (~10-20s for real Gemini calls)
→ Decision card appears: risk level badge + recommended action + case summary
→ Evidence accordion expands to show marketplace listings, ads, domains
→ Case is saved — refreshing the page retains results (from Supabase)
```

---

## Context

Week 1 delivered a brand name form that submitted to a mock endpoint and showed raw JSON. Week 2 replaces this with a polished case flow. Engineer B's `/check-brand` endpoint now returns a real `Decision` + `Evidence` object. Engineer A's scraper returns real marketplace + ads + domain data.

The frontend is built in **React with Lovable** — use existing component patterns in the codebase. Do not introduce new component libraries unless absolutely necessary. Reuse existing Tailwind classes and color tokens from the MarkGuard design system.

---

## Step-by-Step Implementation

### Step 1 — API Client Layer

Create `src/lib/api.ts` as the central API client. All backend calls go through this file — never fetch directly from components.

```typescript
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

export interface MarketplaceEvidence {
  platform: string;
  seller_name: string | null;
  listing_url: string | null;
  price: string | null;
}

export interface Evidence {
  marketplaces: MarketplaceEvidence[];
  ads: Record<string, unknown>[];
  domains: Record<string, unknown>[];
  social: unknown[];
  timestamp: string;
}

export interface Decision {
  risk_level: "HIGH" | "MEDIUM" | "LOW";
  recommended_action: "TAKEDOWN" | "MONITOR" | "DISMISS";
  case_summary: string;
  confidence_score: number;
  evidence_quality: "STRONG" | "MODERATE" | "WEAK";
  key_findings: string[];
}

export interface CheckBrandResponse {
  case_id: string;
  decision: Decision;
  evidence: Evidence;
}

export async function checkBrand(
  brandName: string,
  platforms: string[] = ["amazon", "google_ads", "domains"]
): Promise<CheckBrandResponse> {
  const res = await fetch(`${API_BASE}/monitoring/check-brand`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brand_name: brandName, platforms }),
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`API error ${res.status}: ${error}`);
  }
  return res.json();
}
```

Add `VITE_API_URL=http://localhost:8000/api/v1` to `.env.local`.

---

### Step 2 — Update Brand Form with Loading State

Update the existing brand name form component to use `checkBrand()` and manage async state:

```typescript
// src/components/BrandCheckForm.tsx
import { useState } from "react";
import { checkBrand, CheckBrandResponse } from "@/lib/api";

export function BrandCheckForm() {
  const [brandName, setBrandName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckBrandResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandName.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await checkBrand(brandName);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input
          value={brandName}
          onChange={(e) => setBrandName(e.target.value)}
          placeholder="Enter brand name (e.g. Nike)"
          disabled={loading}
        />
        <button type="submit" disabled={loading || !brandName.trim()}>
          {loading ? "Analyzing..." : "Check Brand"}
        </button>
      </form>
      {loading && <AnalysisLoader />}
      {error && <ErrorBanner message={error} />}
      {result && <CaseView data={result} />}
    </div>
  );
}
```

---

### Step 3 — Loading State Component

Gemini calls take 10–20 seconds. The user must see meaningful progress feedback, not just a spinner.

```typescript
// src/components/AnalysisLoader.tsx
import { useState, useEffect } from "react";

export function AnalysisLoader() {
  const steps = [
    "Scanning Amazon marketplace...",
    "Checking Google Ads...",
    "Running WHOIS domain lookup...",
    "Analyzing evidence with Gemini AI...",
    "Generating case summary...",
  ];
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((s) => (s < steps.length - 1 ? s + 1 : s));
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="analysis-loader">
      <div className="spinner" />
      <p className="step-text">{steps[step]}</p>
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${((step + 1) / steps.length) * 100}%` }}
        />
      </div>
    </div>
  );
}
```

---

### Step 4 — Decision Card Component

```typescript
// src/components/DecisionCard.tsx
import { Decision } from "@/lib/api";

const RISK_COLORS = {
  HIGH: "bg-red-100 text-red-800 border-red-200",
  MEDIUM: "bg-yellow-100 text-yellow-800 border-yellow-200",
  LOW: "bg-green-100 text-green-800 border-green-200",
};

const ACTION_LABELS = {
  TAKEDOWN: "🚨 File Takedown Notice",
  MONITOR: "👁 Continue Monitoring",
  DISMISS: "✓ No Action Required",
};

export function DecisionCard({ decision }: { decision: Decision }) {
  return (
    <div className="decision-card">
      <div className={`risk-badge ${RISK_COLORS[decision.risk_level]}`}>
        {decision.risk_level} RISK
      </div>
      <h2>{ACTION_LABELS[decision.recommended_action]}</h2>
      <p className="case-summary">{decision.case_summary}</p>
      <div className="confidence">
        Confidence: {Math.round(decision.confidence_score * 100)}% · Evidence: {decision.evidence_quality}
      </div>
      {decision.key_findings.length > 0 && (
        <ul className="key-findings">
          {decision.key_findings.map((f, i) => <li key={i}>{f}</li>)}
        </ul>
      )}
    </div>
  );
}
```

---

### Step 5 — Evidence Accordion Component

```typescript
// src/components/EvidenceAccordion.tsx
import { Evidence } from "@/lib/api";
import { useState } from "react";

export function EvidenceAccordion({ evidence }: { evidence: Evidence }) {
  const [open, setOpen] = useState<string | null>("marketplaces");

  const sections = [
    {
      key: "marketplaces",
      label: `Marketplace Listings (${evidence.marketplaces.length})`,
      content: evidence.marketplaces.length === 0
        ? <p className="empty">No suspicious listings found.</p>
        : evidence.marketplaces.map((m, i) => (
            <div key={i} className="evidence-item">
              <span className="platform-badge">{m.platform}</span>
              <span>{m.seller_name ?? "Unknown seller"}</span>
              <span>{m.price ?? "—"}</span>
              {m.listing_url && (
                <a href={m.listing_url} target="_blank" rel="noopener noreferrer">View</a>
              )}
            </div>
          )),
    },
    {
      key: "ads",
      label: `Ads Detected (${evidence.ads.length})`,
      content: evidence.ads.length === 0
        ? <p className="empty">No suspicious ads found.</p>
        : <pre className="raw-json">{JSON.stringify(evidence.ads, null, 2)}</pre>,
    },
    {
      key: "domains",
      label: `Suspicious Domains (${evidence.domains.length})`,
      content: evidence.domains.length === 0
        ? <p className="empty">No suspicious domains found.</p>
        : evidence.domains.map((d: any, i: number) => (
            <div key={i} className="evidence-item">
              <span className="domain">{d.domain}</span>
              <span>{d.registrant}</span>
              <span>Registered: {d.created_date}</span>
            </div>
          )),
    },
  ];

  return (
    <div className="evidence-accordion">
      {sections.map((section) => (
        <div key={section.key} className="accordion-section">
          <button
            className="accordion-header"
            onClick={() => setOpen(open === section.key ? null : section.key)}
          >
            {section.label}
            <span>{open === section.key ? "▲" : "▼"}</span>
          </button>
          {open === section.key && (
            <div className="accordion-body">{section.content}</div>
          )}
        </div>
      ))}
    </div>
  );
}
```

---

### Step 6 — Case View Assembly

```typescript
// src/components/CaseView.tsx
import { CheckBrandResponse } from "@/lib/api";
import { DecisionCard } from "./DecisionCard";
import { EvidenceAccordion } from "./EvidenceAccordion";

export function CaseView({ data }: { data: CheckBrandResponse }) {
  return (
    <div className="case-view">
      <div className="case-header">
        <span className="case-id">Case #{data.case_id.slice(0, 8)}</span>
        <span className="timestamp">
          {new Date(data.evidence.timestamp).toLocaleString()}
        </span>
      </div>
      <DecisionCard decision={data.decision} />
      <EvidenceAccordion evidence={data.evidence} />
    </div>
  );
}
```

---

## File Summary

| File | Action |
|------|--------|
| `src/lib/api.ts` | **Create** — centralized API client with TypeScript types |
| `src/components/BrandCheckForm.tsx` | **Update** — real API calls, async state, error handling |
| `src/components/AnalysisLoader.tsx` | **Create** — multi-step loading indicator |
| `src/components/DecisionCard.tsx` | **Create** — AI decision display with risk badges |
| `src/components/EvidenceAccordion.tsx` | **Create** — collapsible evidence sections |
| `src/components/CaseView.tsx` | **Create** — assembles all components |
| `.env.local` | **Update** — add `VITE_API_URL` |

---

## Acceptance Criteria

- [ ] Submitting "Nike" calls the real `/api/v1/monitoring/check-brand` endpoint (verify in Network tab)
- [ ] `AnalysisLoader` visible during the 10–20s API call, disappears on completion
- [ ] `DecisionCard` renders `risk_level`, `recommended_action`, `case_summary`, `confidence_score`, and `key_findings`
- [ ] `EvidenceAccordion` renders all three sections with real counts
- [ ] Error state shown cleanly if API call fails — no white screen
- [ ] No `any` types on `Decision` or `Evidence` interfaces
- [ ] Form can be submitted again after a result is shown (state resets correctly)
- [ ] CORS does not block frontend calls (coordinate with Engineer B if needed)
