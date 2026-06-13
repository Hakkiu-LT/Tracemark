# Prompt: API Usage Monitor & Rate-Limit Wrapper for Tracemark

## Project Context

You are working on **Tracemark**, a full-stack monorepo. The backend is a **Python / FastAPI** application located in `apps/api/src/tracemark_api/`. The frontend is a **TypeScript + React** app using TanStack Start and TanStack Router (file-based routing in `apps/web/src/routes/`).

The backend currently calls the following external APIs, all of which have free-plan daily or monthly limits:

| Internal Key | API / Service | Location in codebase | Free Limit |
|---|---|---|---|
| `google_serp` | Google SERP (manual scrape) | `services/marketplace.py` → `GoogleSERPAPI` | ~100 req/day before blocks |
| `whois` | WHOIS lookups via `python-whois` | `services/marketplace.py` → `GoogleSERPAPI.check_serp_domains()` | ~500/day |
| `google_ads` | Google Ads Transparency Center | `services/marketplace.py` → `GoogleAdsAPI` | ~100 req/day |
| `meta_ads` | Meta Ad Library API (`graph.facebook.com`) | `services/marketplace.py` → `MetaAdsAPI` | 200 req/hour (free tier) |
| `firecrawl` | Firecrawl JS scraper | `services/marketplace.py` → `FirecrawlScraper` | 400 credits/month |
| `gemini` | Google Gemini AI (`gemini-2.5-flash`) | `services/marketplace.py` → `extract_marketplace_evidence`, `extract_ads_from_content` | 1,500 req/day (free tier) |
| `amazon_scraper` | Amazon HTML scraper (custom, no API key) | `services/marketplace.py` → `AmazonScraper` | Self-imposed limit; rate-limit by IP |

The backend has an existing `FirecrawlScraper` that already tracks monthly credits in an in-memory `_credit_log` list. This should be migrated into the centralized tracker you will build.

The authenticated caller identity is available on every FastAPI request via the existing JWT dependency (look for `current_user` in existing route handlers under `apps/api/src/tracemark_api/routers/`).

---

## Task 1 — Backend: Centralized API Usage Tracker & Rate-Limit Wrapper

### 1.1 — Create `apps/api/src/tracemark_api/services/api_usage_tracker.py`

This must be a **completely standalone file** — it must not import from routes, models, or database. It is pure Python and can be imported from anywhere in the backend.

#### API Registry

Define the list of tracked APIs with their free-plan limits:

```python
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Callable, Awaitable, TypeVar, Any
import time

T = TypeVar("T")

RESET_DAILY = "midnight_utc"
RESET_MONTHLY = "monthly"

@dataclass
class ApiDefinition:
    key: str
    label: str
    free_limit: int
    reset_period: str           # "midnight_utc" or "monthly"
    category: str               # "search" | "whois" | "ads" | "ai" | "scraper"
    requires_env_var: str | None = None  # env var that must be set to use this API

API_REGISTRY: list[ApiDefinition] = [
    ApiDefinition("google_serp",     "Google SERP Scraper",              100,  RESET_DAILY,   "search"),
    ApiDefinition("whois",           "WHOIS Lookup",                     500,  RESET_DAILY,   "whois"),
    ApiDefinition("google_ads",      "Google Ads Transparency",          100,  RESET_DAILY,   "ads"),
    ApiDefinition("meta_ads",        "Meta Ad Library API",              200,  RESET_DAILY,   "ads",     "META_ADS_ACCESS_TOKEN"),
    ApiDefinition("firecrawl",       "Firecrawl JS Scraper",             400,  RESET_MONTHLY, "scraper", "FIRECRAWL_API_KEY"),
    ApiDefinition("gemini",          "Gemini AI (gemini-2.5-flash)",     1500, RESET_DAILY,   "ai",      "GEMINI_API_KEY"),
    ApiDefinition("amazon_scraper",  "Amazon HTML Scraper",              300,  RESET_DAILY,   "scraper"),
]
```

#### Usage Record

```python
@dataclass
class UsageRecord:
    api_key: str
    caller_id: str       # user email or user id from JWT; "system" if unauthenticated
    called_at: str       # ISO 8601 timestamp
    success: bool
    latency_ms: int
    endpoint: str        # which FastAPI endpoint triggered this call
    credits_used: int = 1  # for Firecrawl, pass actual credits; default 1 for others
```

#### Summary Types

```python
@dataclass
class ApiUsageSummary:
    api_key: str
    label: str
    category: str
    free_limit: int
    reset_period: str
    used_today: int           # for monthly APIs (firecrawl): used this month
    remaining: int
    percent_used: float       # 0.0 to 100.0
    is_blocked: bool
    last_called_at: str | None
    requires_env_var: str | None
    env_var_present: bool     # True if the required env var is set

@dataclass
class DeveloperUsageSummary:
    caller_id: str
    total_calls_today: int
    by_api: dict[str, int]    # api_key → call count

@dataclass
class HourlyBucket:
    hour: str   # "HH:00" format, UTC
    count: int
```

#### `ApiUsageTracker` class

Implement a class with the following interface:

```python
class ApiUsageTracker:
    def __init__(self):
        self._records: list[UsageRecord] = []
        # TODO: replace in-memory list with a real DB/KV store (e.g., Redis or PostgreSQL)
        # When doing so, replace _records with async DB queries in each method below.

    def record(self, entry: UsageRecord) -> None:
        """Append a usage record."""

    def _get_window_records(self, api_key: str) -> list[UsageRecord]:
        """
        Returns records in the current reset window for api_key.
        For RESET_DAILY: records since UTC midnight today.
        For RESET_MONTHLY: records since the 1st of the current UTC month.
        """

    def get_used_count(self, api_key: str) -> int:
        """Total calls (or credits for firecrawl) in the current window."""

    def is_blocked(self, api_key: str) -> bool:
        """True if used_count >= free_limit for this api_key."""

    def get_usage_summary(self) -> list[ApiUsageSummary]:
        """Returns one ApiUsageSummary per entry in API_REGISTRY."""

    def get_by_developer(self) -> list[DeveloperUsageSummary]:
        """Groups today's records by caller_id."""

    def get_hourly_breakdown(self, api_key: str | None = None) -> list[HourlyBucket]:
        """
        Returns the last 24 hours broken into 1-hour UTC buckets.
        If api_key is None, aggregates all APIs.
        """

    def reset_all(self) -> None:
        """Clears all records. For testing/manual reset only."""

# Singleton — import this from other modules
tracker = ApiUsageTracker()
```

**Important for Firecrawl**: The existing `_credit_log` in `services/marketplace.py` tracks credits used. Migrate it so that `FirecrawlScraper.scrape_with_fallback()` calls `tracker.record(UsageRecord(api_key="firecrawl", credits_used=10, ...))` instead of appending to `_credit_log`. The `get_used_count("firecrawl")` method must **sum `credits_used`** (not count records) to compare against the 400-credit monthly budget.

#### Rate-Limit Error

```python
class ApiLimitError(Exception):
    def __init__(self, api_key: str, label: str, limit: int, reset_period: str):
        super().__init__(
            f"Daily free limit reached for {label} ({limit} calls/{reset_period}). "
            f"Blocking further calls until the next reset window."
        )
        self.api_key = api_key
        self.label = label
        self.limit = limit
        self.reset_period = reset_period
```

#### `call_with_tracking` wrapper

```python
import asyncio

def call_with_tracking(
    api_key: str,
    caller_id: str,
    endpoint: str,
    fn: Callable[[], T],
    credits_used: int = 1,
) -> T:
    """
    Synchronous wrapper. Steps:
    1. Check tracker.is_blocked(api_key) → raise ApiLimitError if blocked.
    2. Record start time.
    3. Call fn() inside try/except.
    4. Record result via tracker.record(...) regardless of success/failure.
    5. Re-raise original exception if fn() failed.
    """

async def async_call_with_tracking(
    api_key: str,
    caller_id: str,
    endpoint: str,
    fn: Callable[[], Awaitable[T]],
    credits_used: int = 1,
) -> T:
    """Async variant of call_with_tracking for use with async FastAPI routes."""
```

---

### 1.2 — Wire `call_with_tracking` into `services/marketplace.py`

Import `tracker`, `call_with_tracking`, and `ApiLimitError` from `api_usage_tracker`.

Wrap every external API call site as follows. Pass `caller_id` from the function argument (propagated from the FastAPI route). Add `caller_id: str = "system"` as an argument to any function that calls an external API.

```python
# GoogleSERPAPI.search() — wrap the requests.get call
def search(self, brand_name: str, max_pages: int = 3, caller_id: str = "system") -> list[str]:
    def _do_request(url):
        return call_with_tracking(
            "google_serp", caller_id, "/check-brand",
            lambda: requests.get(url, headers=HEADERS, timeout=10)
        )
    # replace every `requests.get(url, ...)` call inside the loop with `_do_request(url)`

# GoogleSERPAPI.check_serp_domains() — wrap each whois.whois() call
def check_serp_domains(self, brand_name: str, caller_id: str = "system") -> list[dict]:
    def _whois(domain):
        return call_with_tracking(
            "whois", caller_id, "/check-brand",
            lambda: whois.whois(domain)
        )

# GoogleAdsAPI.search() — wrap the requests.get call
# MetaAdsAPI.search() — wrap the requests.get call  
# AmazonScraper.search() — wrap each requests.get(url, ...) call
# FirecrawlScraper.scrape_with_fallback() — wrap scrape_page(url), pass credits_used=10
# extract_marketplace_evidence() — wrap model.invoke(prompt) with api_key="gemini"
# extract_ads_from_content() — wrap model.invoke(prompt) with api_key="gemini"
```

For functions that already check `is_blocked` logic internally (like `FirecrawlScraper` checking `MONTHLY_CREDIT_BUDGET`), **remove the manual budget check** and rely entirely on `call_with_tracking` raising `ApiLimitError` instead.

Propagate `caller_id` from `gather_evidence()` and `check_ads_hijacking()` all the way down to each scraper/API call. The FastAPI route calling `gather_evidence()` should pass `current_user.email` or `current_user.id` as `caller_id`.

Handle `ApiLimitError` at the `gather_evidence()` level: catch it, log it, and continue processing other APIs rather than failing the entire scan. Return partial results with a note about which APIs were blocked.

---

### 1.3 — Expose a GET endpoint in the FastAPI router

Create or add to an existing router file (e.g., `apps/api/src/tracemark_api/routers/monitoring.py`):

```python
from fastapi import APIRouter, Depends
from tracemark_api.services.api_usage_tracker import tracker, ApiUsageSummary, DeveloperUsageSummary
from tracemark_api.dependencies import get_current_user  # existing auth dependency
from pydantic import BaseModel
from datetime import datetime, timezone

router = APIRouter(prefix="/api/v1", tags=["monitoring"])

class UsageStatsResponse(BaseModel):
    summary: list[dict]        # serialized list[ApiUsageSummary]
    by_developer: list[dict]   # serialized list[DeveloperUsageSummary]
    hourly: list[dict]         # last 24h hourly buckets, all APIs combined
    generated_at: str

@router.get("/usage-stats")
def get_usage_stats(current_user=Depends(get_current_user)) -> UsageStatsResponse:
    """Returns real-time API usage statistics. Requires authentication."""
    return UsageStatsResponse(
        summary=[vars(s) for s in tracker.get_usage_summary()],
        by_developer=[vars(d) for d in tracker.get_by_developer()],
        hourly=[vars(b) for b in tracker.get_hourly_breakdown()],
        generated_at=datetime.now(timezone.utc).isoformat(),
    )
```

Register this router in `apps/api/src/tracemark_api/main.py` alongside the existing routers.

---

## Task 2 — Frontend: API Usage Monitor Page

### 2.1 — Create the route

Create `apps/web/src/routes/api-usage.tsx` as a TanStack Router file-based route. This route renders at `/api-usage` and uses the same authenticated shell (sidebar + header) as all other inner pages.

After creating the file, regenerate the route tree (run `bun run dev` or the project's TanStack Router codegen command) so `routeTree.gen.ts` is updated automatically. **Never manually edit `routeTree.gen.ts`.**

### 2.2 — Add the route to the sidebar

In `apps/web/src/components/app-sidebar.tsx`, add to the navigation items array:

```ts
import { Activity } from "lucide-react";

// Add after "Cases" and before "Settings":
{ title: "API Usage", url: "/api-usage", icon: Activity },
```

Make this item visible for both `brand_owner` and `law_firm` personas.

### 2.3 — Data fetching

Fetch from the new `GET /api/v1/usage-stats` endpoint using `@tanstack/react-query`:

```ts
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

const { data, isLoading, error } = useQuery({
  queryKey: ["api-usage-stats"],
  queryFn: () => apiFetch<UsageStatsResponse>("/usage-stats", { method: "GET" }),
  refetchInterval: 30_000,   // auto-refresh every 30 seconds
  staleTime: 20_000,
});
```

**Do not use mock data.** If `isLoading` is true, render skeleton cards (see below). If `error` is non-null, render an inline error state with a retry button and the error message.

### 2.4 — TypeScript types (mirror the backend response)

```ts
// Place in apps/web/src/lib/types/api-usage.ts

export interface ApiUsageSummary {
  api_key: string;
  label: string;
  category: "search" | "whois" | "ads" | "ai" | "scraper";
  free_limit: number;
  reset_period: "midnight_utc" | "monthly";
  used_today: number;
  remaining: number;
  percent_used: number;
  is_blocked: boolean;
  last_called_at: string | null;
  requires_env_var: string | null;
  env_var_present: boolean;
}

export interface DeveloperUsageSummary {
  caller_id: string;
  total_calls_today: number;
  by_api: Record<string, number>;
}

export interface HourlyBucket {
  hour: string;
  count: number;
}

export interface UsageStatsResponse {
  summary: ApiUsageSummary[];
  by_developer: DeveloperUsageSummary[];
  hourly: HourlyBucket[];
  generated_at: string;
}
```

### 2.5 — Page layout

Build the page using existing shadcn/ui components (`Card`, `CardHeader`, `CardContent`, `Badge`, `Progress`, `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`, `Skeleton`, `Alert`). Do **not** add new UI library dependencies.

---

#### Section 1 — KPI Header Row (4 cards)

| Card | Value | Color |
|---|---|---|
| Total API calls today | Sum of `used_today` across all entries | Neutral |
| APIs monitored | Count of entries in `summary` | Neutral |
| APIs at >80% capacity | Count where `percent_used > 80 && !is_blocked` | Amber / warning |
| APIs blocked | Count where `is_blocked === true` | Red / destructive |

Show a shimmer `<Skeleton>` placeholder matching the card shape while `isLoading`.

---

#### Section 2 — API Status Grid

Render one row per entry in `summary`. The grid should be a `<Table>` on desktop and collapse to stacked cards on mobile (use a `hidden md:table` / `md:hidden` pattern).

Each row/card must show:

- **API name** (`label`) + a `<Badge>` for `category` (color-coded: search=blue, whois=purple, ads=orange, ai=teal/primary, scraper=gray)
- **Reset period** label: "Resets daily" or "Resets monthly"
- **Progress bar** (`<Progress value={percent_used}>`): color the track using a CSS class — green if `< 50`, amber if `50–80`, red if `> 80` (apply via `className` conditional)
- **`used_today` / `free_limit`** in `tabular-nums` font
- **Remaining** calls/credits left (`remaining`)
- **Status badge**: `Active` (green), `Warning` (amber, >80%), `BLOCKED` (red, destructive) — use shadcn `<Badge variant="...">` variants
- **Last called**: relative time string — write a `formatRelativeTime(iso: string | null): string` helper that returns "Never", "just now", "2 min ago", "1 hr ago", "3 days ago" etc.
- **Env var indicator**: if `requires_env_var` is non-null and `env_var_present` is false, show a small warning icon (⚠) with a tooltip: "Requires `{requires_env_var}` — not set"

---

#### Section 3 — Usage by Developer (Table)

Render a `<Table>` with columns:

```
Caller ID | Total Calls Today | google_serp | whois | google_ads | meta_ads | firecrawl | gemini | amazon_scraper
```

Derive column headers dynamically from `summary.map(s => s.api_key)` so the table automatically adapts if the API registry changes.

Each cell that contains a numeric value must use `font-variant-numeric: tabular-nums` (apply `className="tabular-nums"` on the `<TableCell>`).

Show "No activity today" empty state if `by_developer` is empty.

---

#### Section 4 — 24h Activity Chart

Render a bar chart using **`recharts`** (which is either already in the project or can be added). The chart displays `hourly` data from the API response — one bar per hour over the last 24 hours (UTC), showing total calls.

```tsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

<ResponsiveContainer width="100%" height={200}>
  <BarChart data={data.hourly}>
    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
    <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
    <YAxis tick={{ fontSize: 11 }} />
    <Tooltip />
    <Bar dataKey="count" fill="var(--color-primary)" radius={[3, 3, 0, 0]} />
  </BarChart>
</ResponsiveContainer>
```

If `recharts` is not installed, replace with a CSS flexbox sparkline:

```tsx
// Plain CSS bar chart fallback — no dependencies
<div className="flex items-end gap-0.5 h-24">
  {data.hourly.map((b) => (
    <div
      key={b.hour}
      className="flex-1 bg-primary/70 rounded-t transition-all"
      style={{ height: `${Math.max(4, (b.count / maxCount) * 96)}px` }}
      title={`${b.hour}: ${b.count} calls`}
    />
  ))}
</div>
```

---

#### Section 5 — Blocked API Alert Banner

If any `summary` entry has `is_blocked === true`, render a dismissible `<Alert variant="destructive">` at the top of the page (above the KPI row):

```
⛔ {count} API(s) have hit their free plan limit and are currently blocked:
{blockedApis.map(a => a.label).join(", ")}.
Calls to these APIs will be rejected until the next reset window.
```

---

### 2.6 — Skeleton loading state

While `isLoading` is true, render:
- 4 `<Skeleton className="h-24 w-full rounded-lg" />` cards in the KPI row
- A `<Skeleton className="h-64 w-full rounded-lg" />` for the API status grid
- A `<Skeleton className="h-32 w-full rounded-lg" />` for the chart

---

### 2.7 — Error state

If the query returns an error, render:

```tsx
<Alert variant="destructive">
  <AlertTitle>Failed to load usage stats</AlertTitle>
  <AlertDescription>
    {error.message}
    <Button variant="outline" size="sm" className="ml-4" onClick={() => refetch()}>
      Retry
    </Button>
  </AlertDescription>
</Alert>
```

---

## Task 3 — Pass `caller_id` from FastAPI routes

In every FastAPI route handler that calls `gather_evidence()`, `check_ads_hijacking()`, or any function that calls external APIs, extract the authenticated user's identity and pass it as `caller_id`:

```python
# Example in an existing route handler
from tracemark_api.dependencies import get_current_user

@router.post("/check-brand")
async def check_brand(
    request: CheckBrandRequest,
    current_user = Depends(get_current_user),
):
    caller_id = getattr(current_user, "email", None) or getattr(current_user, "id", "system")
    evidence = gather_evidence(
        brand_name=request.brand_name,
        platforms=request.platforms,
        caller_id=caller_id,
    )
    ...
```

If `current_user` is not available on a given route (unauthenticated background task), use `"system"` as the `caller_id`.

---

## Constraints & Notes

- **No mock/dummy data in the frontend.** The page only shows real data returned by `GET /api/v1/usage-stats`. Use skeleton loading states while data is fetching; never substitute fake numbers.
- **`api_usage_tracker.py` is standalone.** It must not import from `models`, `routers`, `database`, or `config`. It relies only on Python stdlib (`datetime`, `dataclasses`, `typing`) and is importable from any part of the backend.
- **`FirecrawlScraper` migration.** The existing `_credit_log` list in `marketplace.py` must be removed and replaced with `tracker.record(...)` calls. The `MONTHLY_CREDIT_BUDGET` check inside `scrape_with_fallback` must be removed; `call_with_tracking` raising `ApiLimitError` replaces it.
- **The in-memory store resets on server restart.** Add a `# TODO: replace with Redis/PostgreSQL for persistence` comment in `ApiUsageTracker.__init__`. This is acceptable for Phase 1.
- **`routeTree.gen.ts` is auto-generated.** Never edit it manually. Regenerate it after adding `/api-usage`.
- **Category badge colors** must use CSS variables from the existing Tailwind config (e.g., `bg-blue-500/10 text-blue-700`), not hardcoded hex values.
- **The page is fully responsive.** The API status table collapses to stacked cards on screens narrower than `md` (768px). The KPI row stacks to 2×2 on mobile.
- **`ApiLimitError` must be handled gracefully.** It must never propagate as an unhandled 500 error to the frontend. Catch it at the service orchestration level (`gather_evidence`) and return partial results with a `blocked_apis` list in the response so the frontend can surface a warning.
