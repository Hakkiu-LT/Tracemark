# TASK-W1-C — Build Frontend Form + Skeleton API

**Assigned to:** Domantas (Engineer C)
**Week:** Week 1
**Priority:** 🔴 High
**Stack:** React (Lovable) · TypeScript · FastAPI · Python · Mock Data

---

## Objective

Two parallel deliverables this week:

1. **Build a `/api/check-brand` FastAPI endpoint** that returns mock evidence and decision data — no real scraping yet.
2. **Build the frontend UI form** in React where a user can input a brand name and submit it to the API.

**Integration point this week: None.** Engineer C's frontend calls mock data only. Gabriel's scraper and Martynas's decision agent are not connected yet — that happens in Week 2.

**Success test:**
- User types a brand name in the form and clicks Submit
- The form POSTs to `/api/check-brand`
- The UI displays the returned mock evidence/decision JSON in a readable format

---

## Context

The project frontend is a React + TypeScript app at `src/` (root of the repo), built using **Lovable**. The backend is FastAPI in `apps/api`. The existing backend already has a `/api/v1/monitoring/analyze` endpoint (single-URL analysis) and the basic routing structure. This week you add a **new, simpler endpoint** `/api/check-brand` specifically designed as the frontend entry point that will be wired to real logic in Week 2.

Do not modify Gabriel's or Martynas's files. Work only in `src/` (frontend) and `apps/api/src/tracemark_api/routes/` (new route file).

---

## Part 1: Skeleton FastAPI Endpoint

### 1.1 — Create `check_brand.py` Route

Create `apps/api/src/tracemark_api/routes/check_brand.py`:

```python
from fastapi import APIRouter
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(prefix="/api", tags=["check-brand"])


class CheckBrandRequest(BaseModel):
    brand_name: str
    platforms: list[str] = ["amazon"]


class MockListing(BaseModel):
    platform: str
    seller_name: str
    listing_url: str
    price: str | None = None


class MockEvidence(BaseModel):
    marketplaces: list[MockListing]
    total_found: int
    scraped_at: str


class MockDecision(BaseModel):
    recommendation: str
    confidence: int
    priority: str
    reasoning: str
    case_summary: str


class CheckBrandResponse(BaseModel):
    brand_name: str
    evidence: MockEvidence
    decision: MockDecision
    is_mock: bool = True


@router.post("/check-brand", response_model=CheckBrandResponse)
def check_brand(payload: CheckBrandRequest) -> CheckBrandResponse:
    """
    Week 1 stub endpoint. Returns mock data.
    In Week 2 this will call gather_evidence() + make_decision() for real.
    """
    brand = payload.brand_name

    mock_evidence = MockEvidence(
        marketplaces=[
            MockListing(
                platform="amazon",
                seller_name=f"UnauthorizedSeller_{brand.upper()}_01",
                listing_url=f"https://www.amazon.com/dp/MOCK{brand[:3].upper()}01",
                price="$18.99"
            ),
            MockListing(
                platform="amazon",
                seller_name=f"CheapFakes_{brand.replace(' ', '')}",
                listing_url=f"https://www.amazon.com/dp/MOCK{brand[:3].upper()}02",
                price="$12.50"
            ),
        ],
        total_found=2,
        scraped_at=datetime.now().isoformat()
    )

    mock_decision = MockDecision(
        recommendation="YES",
        confidence=87,
        priority="HIGH",
        reasoning=(
            f"Two unauthorized listings for '{brand}' were found on Amazon. "
            "Both sellers have no brand authorization record and pricing is "
            "significantly below MSRP, indicating likely counterfeit product."
        ),
        case_summary=(
            f"Potential trademark infringement detected for brand '{brand}' "
            "on Amazon marketplace. 2 suspicious listings found. "
            "Recommend initiating takedown."
        )
    )

    return CheckBrandResponse(
        brand_name=brand,
        evidence=mock_evidence,
        decision=mock_decision,
        is_mock=True
    )
```

---

### 1.2 — Register the Route in `main.py`

Update `apps/api/src/tracemark_api/main.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from tracemark_api.routes.health import router as health_router
from tracemark_api.routes.monitoring import router as monitoring_router
from tracemark_api.routes.check_brand import router as check_brand_router  # ADD THIS

app = FastAPI(title="Tracemark API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://your-lovable-app.lovable.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(monitoring_router, prefix="/api/v1")
app.include_router(check_brand_router)  # mounts at /api/check-brand
```

---

### 1.3 — Verify the Endpoint Locally

```bash
cd apps/api
uvicorn tracemark_api.main:app --reload --port 8000
```

Test it:
```bash
curl -X POST http://localhost:8000/api/check-brand \
  -H "Content-Type: application/json" \
  -d '{"brand_name": "Nike", "platforms": ["amazon"]}'
```

Expected response shape:
```json
{
  "brand_name": "Nike",
  "evidence": {
    "marketplaces": [...],
    "total_found": 2,
    "scraped_at": "2026-06-04T..."
  },
  "decision": {
    "recommendation": "YES",
    "confidence": 87,
    "priority": "HIGH",
    "reasoning": "...",
    "case_summary": "..."
  },
  "is_mock": true
}
```

Check Swagger docs at `http://localhost:8000/docs` — `/api/check-brand` should appear with full schema.

---

## Part 2: React Frontend Form

### 2.1 — Create the API Client Hook

Create `src/hooks/useCheckBrand.ts`:

```typescript
import { useState } from "react";

export interface MockListing {
  platform: string;
  seller_name: string;
  listing_url: string;
  price?: string;
}

export interface CheckBrandResult {
  brand_name: string;
  evidence: {
    marketplaces: MockListing[];
    total_found: number;
    scraped_at: string;
  };
  decision: {
    recommendation: "YES" | "NO";
    confidence: number;
    priority: "HIGH" | "MEDIUM" | "LOW";
    reasoning: string;
    case_summary: string;
  };
  is_mock: boolean;
}

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export function useCheckBrand() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckBrandResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function checkBrand(brandName: string, platforms = ["amazon"]) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/check-brand`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_name: brandName, platforms }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data: CheckBrandResult = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return { checkBrand, loading, result, error };
}
```

---

### 2.2 — Create the `BrandCheckForm` Component

Create `src/components/BrandCheckForm.tsx`:

```tsx
import { useState } from "react";
import { useCheckBrand, CheckBrandResult } from "@/hooks/useCheckBrand";

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: "bg-red-50 text-red-800 border-red-200",
  MEDIUM: "bg-yellow-50 text-yellow-800 border-yellow-200",
  LOW: "bg-green-50 text-green-800 border-green-200",
};

function ResultCard({ result }: { result: CheckBrandResult }) {
  const { evidence, decision } = result;
  const priorityClass = PRIORITY_COLORS[decision.priority] ?? PRIORITY_COLORS.LOW;

  return (
    <div className="mt-6 space-y-4">
      <div className={`rounded-lg border p-4 ${priorityClass}`}>
        <div className="flex items-center justify-between">
          <span className="font-semibold text-lg">
            {decision.recommendation === "YES" ? "⚠️ Takedown Recommended" : "✅ No Action Needed"}
          </span>
          <span className="text-sm font-medium">
            Confidence: {decision.confidence}% · Priority: {decision.priority}
          </span>
        </div>
        <p className="mt-2 text-sm">{decision.case_summary}</p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="font-semibold text-gray-800 mb-3">
          Marketplace Listings Found ({evidence.total_found})
        </h3>
        {evidence.marketplaces.length === 0 ? (
          <p className="text-gray-500 text-sm">No suspicious listings found.</p>
        ) : (
          <ul className="space-y-2">
            {evidence.marketplaces.map((listing, i) => (
              <li key={i} className="flex items-start justify-between text-sm border-b border-gray-100 pb-2 last:border-0">
                <div>
                  <span className="font-medium text-gray-800">{listing.seller_name}</span>
                  <span className="ml-2 text-gray-400 capitalize">[{listing.platform}]</span>
                  <br />
                  <a href={listing.listing_url} target="_blank" rel="noopener noreferrer"
                     className="text-blue-600 hover:underline text-xs">
                    {listing.listing_url}
                  </a>
                </div>
                {listing.price && (
                  <span className="text-gray-700 font-medium ml-4">{listing.price}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="font-semibold text-gray-800 mb-2">AI Reasoning</h3>
        <p className="text-sm text-gray-600">{decision.reasoning}</p>
      </div>

      {result.is_mock && (
        <p className="text-xs text-gray-400 text-center">
          Mock data — real scraping will be enabled in Week 2
        </p>
      )}
    </div>
  );
}

export function BrandCheckForm() {
  const [brandName, setBrandName] = useState("");
  const { checkBrand, loading, result, error } = useCheckBrand();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (brandName.trim()) checkBrand(brandName.trim());
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">MarkGuard</h1>
      <p className="text-gray-500 text-sm mb-6">
        Check for unauthorized listings and trademark infringement
      </p>
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="text"
          value={brandName}
          onChange={(e) => setBrandName(e.target.value)}
          placeholder="Enter brand name (e.g. Nike, Apple, Orbio)"
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
          required
        />
        <button type="submit" disabled={loading || !brandName.trim()}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white
                     hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {loading ? "Checking…" : "Check Brand"}
        </button>
      </form>

      {loading && (
        <div className="mt-6 space-y-3 animate-pulse">
          <div className="h-16 bg-gray-100 rounded-lg" />
          <div className="h-24 bg-gray-100 rounded-lg" />
          <div className="h-16 bg-gray-100 rounded-lg" />
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Error: {error}. Make sure the backend is running at http://localhost:8000.
        </div>
      )}

      {result && !loading && <ResultCard result={result} />}
    </div>
  );
}
```

---

### 2.3 — Add to App Router

In `src/App.tsx` or `src/pages/Index.tsx`:

```tsx
import { BrandCheckForm } from "@/components/BrandCheckForm";

function App() {
  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <BrandCheckForm />
    </main>
  );
}

export default App;
```

---

### 2.4 — Environment Variable

Add `.env.local` at the repo root (frontend):
```
VITE_API_URL=http://localhost:8000
```

---

## File Summary

| File | Action |
|------|--------|
| `apps/api/src/tracemark_api/routes/check_brand.py` | **Create** — skeleton endpoint with mock data |
| `apps/api/src/tracemark_api/main.py` | **Update** — register router + CORS middleware |
| `src/hooks/useCheckBrand.ts` | **Create** — React API hook |
| `src/components/BrandCheckForm.tsx` | **Create** — form + results component |
| `src/App.tsx` or `src/pages/Index.tsx` | **Update** — render the form |
| `.env.local` | **Create** — `VITE_API_URL` |

---

## Acceptance Criteria

- [ ] `POST /api/check-brand` returns 200 with mock `CheckBrandResponse`
- [ ] Endpoint is documented in Swagger at `/docs`
- [ ] React form renders without errors
- [ ] Submitting a brand name calls the API and displays results
- [ ] Loading skeleton shows while awaiting the API
- [ ] Error state displays if the API is unreachable
- [ ] `is_mock: true` indicator visible in the UI
- [ ] CORS configured so `localhost:5173` can reach `localhost:8000`

---

## Notes for Integration (Week 2)

In Week 2 the `/api/check-brand` backend implementation will be replaced with real calls to `gather_evidence()` (Gabriel) and `make_decision()` (Martynas). The **frontend hook and component do not need to change** — only `check_brand.py` gets updated. Keep `CheckBrandResponse` shape stable.
