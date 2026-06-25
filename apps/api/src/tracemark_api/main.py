from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from tracemark_api.routes.health import router as health_router
from tracemark_api.routes.monitoring import router as monitoring_router
from tracemark_api.routes.check_brand import router as check_brand_router
from tracemark_api.routes.usage import router as usage_router
from tracemark_api.routes.auth import router as auth_router
from tracemark_api.routes.infringements import router as infringements_router
from tracemark_api.routes.documents import router as documents_router

app = FastAPI(title="Tracemark API", version="0.1.0")

app.include_router(health_router)
app.include_router(monitoring_router, prefix="/api/v1")
app.include_router(check_brand_router, prefix="/api/v1")
app.include_router(usage_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(infringements_router, prefix="/api/v1")
app.include_router(documents_router, prefix="/api/v1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://localhost:8082",
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)