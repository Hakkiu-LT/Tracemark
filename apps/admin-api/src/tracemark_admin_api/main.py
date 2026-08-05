from dotenv import find_dotenv, load_dotenv

# Single source of truth: the repo-root .env (walks up from this module).
load_dotenv(find_dotenv())

import os

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from tracemark_admin_api.routes.audit import router as audit_router
from tracemark_admin_api.routes.auth import router as auth_router
from tracemark_admin_api.routes.brands_admin import router as brands_router
from tracemark_admin_api.routes.cases import router as cases_router
from tracemark_admin_api.routes.customers import router as customers_router
from tracemark_admin_api.routes.infringements_admin import (
    router as infringements_router,
)
from tracemark_admin_api.routes.leads import router as leads_router
from tracemark_admin_api.routes.meta import router as meta_router
from tracemark_admin_api.routes.notification_log import (
    router as notification_log_router,
)
from tracemark_admin_api.routes.organizations import router as organizations_router
from tracemark_admin_api.routes.resources import router as resources_router
from tracemark_admin_api.routes.scraper_health import router as scraper_health_router
from tracemark_admin_api.routes.search import router as search_router
from tracemark_admin_api.routes.staff import router as staff_router
from tracemark_admin_api.routes.stats import router as stats_router
from tracemark_admin_api.routes.takedowns_admin import router as takedowns_router

_is_production = os.environ.get("ENVIRONMENT", "").lower() == "production"

# The admin portal has exactly ONE legitimate origin. Extra origins can be added via
# ADMIN_ALLOWED_ORIGINS (comma-separated) for staging.
_extra_origins = [o.strip() for o in os.environ.get("ADMIN_ALLOWED_ORIGINS", "").split(",") if o.strip()]

app = FastAPI(
    title="HAKKIU Admin API",
    version="0.1.0",
    docs_url=None if _is_production else "/docs",
    redoc_url=None if _is_production else "/redoc",
    openapi_url=None if _is_production else "/openapi.json",
)

# Global rate limiter (keyed by client IP — needs uvicorn --proxy-headers behind
# Caddy). Registered on app.state so slowapi's 429 handler resolves it; the public
# password-reset route uses its own module-local limiter (see routes/auth.py).
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(staff_router, prefix="/api/v1")
app.include_router(customers_router, prefix="/api/v1")
app.include_router(organizations_router, prefix="/api/v1")
app.include_router(brands_router, prefix="/api/v1")
app.include_router(resources_router, prefix="/api/v1")
app.include_router(meta_router, prefix="/api/v1")
app.include_router(audit_router, prefix="/api/v1")
app.include_router(search_router, prefix="/api/v1")
app.include_router(cases_router, prefix="/api/v1")
app.include_router(infringements_router, prefix="/api/v1")
app.include_router(takedowns_router, prefix="/api/v1")
app.include_router(stats_router, prefix="/api/v1")
app.include_router(scraper_health_router, prefix="/api/v1")
app.include_router(leads_router, prefix="/api/v1")
app.include_router(notification_log_router, prefix="/api/v1")

_allowed_origins = [
    "http://localhost:8082",  # admin app local dev
    "https://admin.hakkiu.com",  # canonical production admin domain
] + _extra_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)


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
def _check_required_env() -> None:
    if not os.environ.get("INTERNAL_API_SECRET"):
        raise RuntimeError(
            "INTERNAL_API_SECRET is not set. "
            "This secret is required for admin-api ↔ main-api communication. "
            "Set it in the repo-root .env before starting."
        )


@app.get("/health")
def health():
    return {"status": "ok", "service": "tracemark-admin-api"}
