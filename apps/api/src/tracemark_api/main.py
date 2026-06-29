from dotenv import load_dotenv
load_dotenv()

import os
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from tracemark_api.routes.health import router as health_router
from tracemark_api.routes.monitoring import router as monitoring_router
from tracemark_api.routes.check_brand import router as check_brand_router
from tracemark_api.routes.usage import router as usage_router
from tracemark_api.routes.auth import router as auth_router
from tracemark_api.routes.infringements import router as infringements_router
from tracemark_api.routes.documents import router as documents_router

_is_production = os.environ.get("ENVIRONMENT", "").lower() == "production"

_production_origins = [
    o.strip()
    for o in os.environ.get("ALLOWED_ORIGINS", "").split(",")
    if o.strip()
]

app = FastAPI(
    title="Tracemark API",
    version="0.1.0",
    docs_url=None if _is_production else "/docs",
    redoc_url=None if _is_production else "/redoc",
    openapi_url=None if _is_production else "/openapi.json",
)

app.include_router(health_router)
app.include_router(monitoring_router, prefix="/api/v1")
app.include_router(check_brand_router, prefix="/api/v1")
app.include_router(usage_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(infringements_router, prefix="/api/v1")
app.include_router(documents_router, prefix="/api/v1")

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