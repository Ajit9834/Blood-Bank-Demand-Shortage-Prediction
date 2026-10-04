import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import db
from api.routes import auth, health, operations, prediction
from src.config import settings
from src.models.model_loader import load_models
from api.settings import database_is_configured


logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.models = load_models()
    if database_is_configured():
        db.initialize_database()
    logger.info("ML models loaded during application startup")
    yield


app = FastAPI(
    title="Blood Bank Demand & Shortage Prediction API",
    description="API for predicting blood demand and shortage risk using XGBoost.",
    version="1.0.0",
    lifespan=lifespan,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_origin_regex=r"^https://([a-z0-9-]+\.)*devtunnels\.ms$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(health.router)
app.include_router(prediction.router)
app.include_router(health.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(prediction.router, prefix="/api")
app.include_router(operations.router, prefix="/api")