from fastapi import FastAPI

from tracemark_api.routes.health import router as health_router
from tracemark_api.routes.monitoring import router as monitoring_router

app = FastAPI(title="Tracemark API", version="0.1.0")

app.include_router(health_router)
app.include_router(monitoring_router, prefix="/api/v1")

