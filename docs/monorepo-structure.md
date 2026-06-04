# Recommended Monorepo Structure

This repository contains the Tracemark web application (frontend) and the Python backend service.

```text
/
  apps/
    api/                    # Python Backend
      src/
        tracemark_api/
          routes/           # API Routers & Controllers
            health.py       # API Health checks
            monitoring.py   # IP Monitoring logic & tasks
          services/         # Core business logic / integrations
            ai.py           # OpenAI/LLM-based infringement analysis
            scraper.py      # Web page scraping with Firecrawl
          main.py           # FastAPI entrypoint
      Dockerfile            # Container setup for API
      pyproject.toml        # Backend dependencies & python config
  src/                      # Frontend App (TanStack Start + React)
    components/             # Shared UI components
    hooks/                  # React custom hooks
    lib/                    # Utils, network clients, state configs
    routes/                 # File-based routing (pages)
      __root.tsx            # Root layout & navbar/sidebar setup
      dashboard.tsx         # Main overview dashboard
      monitoring.tsx        # Brand/IP monitored list
      monitoring.new.tsx    # Create brand monitoring task form
      cases.tsx             # Case listing & detail routes
      landing.tsx           # Product landing page
    router.tsx              # Router instantiation
    start.ts                # TanStack Start client bundle entry
    server.ts               # SSR / Server-side setup
    styles.css              # Main tailwind styling imports
    Dockerfile              # Container setup for Web/SSR
  docs/                     # System documentation & guides
```

## Service Details & Setup

### 1. Frontend (`src/`)
* **Technology:** TanStack Start (React 19, Vite, Tailwind CSS, TypeScript).
* **Local Port:** `http://localhost:3000` (SSR endpoint).
* **Key Files:**
  * `src/routes/`: Employs file-based routing. Routes like `cases.$caseId.tsx` define dynamic parameter-matching views.
  * `src/server.ts` & `src/start.ts`: Manage SSR hydration and server entry points.
* **Development Command:**
  ```bash
  npm run dev
  # or
  bun run dev
  ```

### 2. Backend (`apps/api/`)
* **Technology:** FastAPI, Uvicorn, Python 3.11+, Pydantic.
* **Local Port:** `http://localhost:8000`
* **Key Files:**
  * `tracemark_api/services/scraper.py`: Utilizes Firecrawl to scrape web pages and output structured markdown.
  * `tracemark_api/services/ai.py`: Wraps LLM calls to analyze scraped data for trademark/IP infringements.
  * `tracemark_api/routes/monitoring.py`: Powers backend monitors, storing results, and checking brand risk profiles.
* **Development Command:**
  ```bash
  cd apps/api
  .venv\Scripts\activate
  python -m uvicorn tracemark_api.main:app --reload --app-dir src
  ```

---

## Architecture Flow

Below is the conceptual flow of how the frontend and backend talk to each other:

1. **Frontend Interactions:** The user inputs a brand name in the React frontend (e.g., in `src/routes/monitoring.new.tsx`).
2. **API Requests:** The frontend issues an HTTP request to the backend API (`/api/...`).
3. **Scraping (Firecrawl):** The FastAPI app (`scraper.py`) queries search engines and marketplaces, fetching raw pages and converting them to Markdown.
4. **AI Assessment (OpenAI):** The markdown content is passed to `ai.py` where the LLM evaluates the text for unauthorized use of trademarks or copyrighted branding.
5. **Results Database:** Results and findings are cataloged and returned to the React frontend to display on the dashboard or monitoring tables.

---

## MVP Scope (Minimum Viable Product)

The core target of the MVP is to allow users to check a brand name for potential intellectual property infringements.

1. **Brand Check Endpoint:**
   - A skeleton API endpoint at `/api/check-brand` on the backend returning mock analysis data.
   - Future integration: Scrape search engines/marketplaces using Firecrawl and run AI-based risk evaluation.

2. **Frontend Search Form:**
   - A brand search input form on the frontend.
   - Submits the query to the `/api/check-brand` backend endpoint.
   - Renders the analysis results (monitored status, risk levels, and identified URLs) to the user.
