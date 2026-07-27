from dotenv import load_dotenv, find_dotenv
# Single source of truth: the repo-root .env (walks up from this module).
load_dotenv(find_dotenv())

import ipaddress
import os
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from tracemark_api.services.rate_limit import limiter

from tracemark_api.routes.health import router as health_router
from tracemark_api.routes.monitoring import router as monitoring_router
from tracemark_api.routes.check_brand import router as check_brand_router
from tracemark_api.routes.auth import router as auth_router
from tracemark_api.routes.infringements import router as infringements_router
from tracemark_api.routes.documents import router as documents_router
from tracemark_api.routes.clients import router as clients_router
from tracemark_api.routes.brands import router as brands_router
from tracemark_api.routes.internal import router as internal_router
from tracemark_api.routes.usage import router as usage_router
from tracemark_api.routes.leads import router as leads_router

_is_production = os.environ.get("ENVIRONMENT", "").lower() == "production"

_production_origins = [
    o.strip()
    for o in os.environ.get("ALLOWED_ORIGINS", "").split(",")
    if o.strip()
]

app = FastAPI(
    title="HAKKIU API",
    version="0.1.0",
    docs_url=None if _is_production else "/docs",
    redoc_url=None if _is_production else "/redoc",
    openapi_url=None if _is_production else "/openapi.json",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.include_router(health_router)
app.include_router(monitoring_router, prefix="/api/v1")
app.include_router(check_brand_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(infringements_router, prefix="/api/v1")
app.include_router(documents_router, prefix="/api/v1")
app.include_router(clients_router, prefix="/api/v1")
app.include_router(brands_router, prefix="/api/v1")
app.include_router(internal_router, prefix="/api/v1")
app.include_router(usage_router, prefix="/api/v1")
app.include_router(leads_router, prefix="/api/v1")

_allowed_origins = [
    "http://localhost:8080",
    "http://localhost:8082",
    "http://localhost:5173",
    "http://localhost:3000",
] + _production_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)


def _internal_ip_allowed(host: str) -> bool:
    """Return True if the client IP is permitted to call /internal/* routes."""
    # Loopback + Docker bridge range allowed by default; extend via env var.
    defaults = [
        ipaddress.ip_network("127.0.0.0/8"),
        ipaddress.ip_network("::1/128"),
        ipaddress.ip_network("172.16.0.0/12"),  # Docker private range
    ]
    extra: list[ipaddress.IPv4Network | ipaddress.IPv6Network] = []
    for entry in os.environ.get("INTERNAL_API_ALLOWED_IPS", "").split(","):
        entry = entry.strip()
        if entry:
            try:
                extra.append(ipaddress.ip_network(entry, strict=False))
            except ValueError:
                pass
    try:
        addr = ipaddress.ip_address(host)
        return any(addr in net for net in defaults + extra)
    except ValueError:
        return False


@app.middleware("http")
async def restrict_internal_routes(request: Request, call_next):
    if request.url.path.startswith("/api/v1/internal/"):
        client_ip = request.client.host if request.client else ""
        if not _internal_ip_allowed(client_ip):
            return JSONResponse(
                status_code=403,
                content={"detail": "Forbidden: internal routes are not publicly accessible"},
            )
    return await call_next(request)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    return response


@app.on_event("startup")
def startup_event():
    import threading
    import time
    from tracemark_api.services.storage import cleanup_old_cases

    # Auto-start the resource sampler (admin portal reads it over /internal).
    try:
        from tracemark_api.services.resource_monitor import start_monitoring
        start_monitoring()
    except Exception as ex:
        print(f"[Resource Monitor] failed to start: {ex}")

    def run_periodically():
        # Sleep for a minute to let the server start up smoothly
        time.sleep(60)
        while True:
            try:
                cleanup_old_cases()
            except Exception as ex:
                print(f"[Cleanup Scheduler] Exception during run: {ex}")
            # Sleep for 24 hours (86400 seconds)
            time.sleep(24 * 3600)

    threading.Thread(target=run_periodically, daemon=True).start()

    # Daily lightweight scraper reachability probe — records a per-platform health row
    # (source='probe') so the admin Scraper Health page has data even without customer
    # traffic. Cheap HTTP GETs only; no full scans / Firecrawl JS scrapes.
    def run_health_probe():
        from tracemark_api.services.scraper_health import run_reachability_probes
        time.sleep(90)
        while True:
            try:
                run_reachability_probes()
            except Exception as ex:
                print(f"[Scraper Health Probe] Exception during run: {ex}")
            time.sleep(24 * 3600)

    threading.Thread(target=run_health_probe, daemon=True).start()

    # Weekly digest — runs every Tuesday at 09:00 UTC.
    def run_weekly_digest():
        from tracemark_api.services.weekly_digest import send_weekly_digests
        time.sleep(120)
        while True:
            now = __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
            # Tuesday = weekday 1, 09:00 UTC
            if now.weekday() == 1 and now.hour == 9 and now.minute < 30:
                try:
                    send_weekly_digests()
                except Exception as ex:
                    print(f"[Weekly Digest] Exception: {ex}")
            time.sleep(30 * 60)  # check every 30 minutes

    threading.Thread(target=run_weekly_digest, daemon=True).start()