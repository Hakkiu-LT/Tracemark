from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from tracemark_api.routes.health import router as health_router
from tracemark_api.routes.monitoring import router as monitoring_router
from tracemark_api.routes.check_brand import router as check_brand_router

app = FastAPI(title="Tracemark API", version="0.1.0")

app.include_router(health_router)
app.include_router(monitoring_router, prefix="/api/v1")
app.include_router(check_brand_router, prefix="/api/v1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)