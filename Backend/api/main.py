import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import health, operations, prediction
from src.config import settings
from src.models.model_loader import load_models
from src.services.model_performance_service import evaluate_models


logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.models = load_models()
    app.state.model_performance = evaluate_models()
    logger.info("ML models loaded during application startup")
    logger.info("Model performance metrics evaluated during application startup")
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
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(health.router)
app.include_router(prediction.router)
app.include_router(health.router, prefix="/api")
app.include_router(prediction.router, prefix="/api")
app.include_router(operations.router, prefix="/api")