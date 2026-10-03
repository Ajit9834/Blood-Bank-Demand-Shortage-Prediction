import logging

from fastapi import APIRouter
from fastapi import HTTPException, Request

from api.schemas.prediction import PredictionRequest, PredictionResponse
from src.services.prediction_service import predict_blood_demand_and_shortage


router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/predict", response_model=PredictionResponse)
@router.post("/predict/demand", response_model=PredictionResponse)
@router.post("/predict/shortage", response_model=PredictionResponse)
def predict(payload: PredictionRequest, request: Request):
    try:
        models = getattr(request.app.state, "models", None)
        result = predict_blood_demand_and_shortage(payload.model_dump(), models=models)
    except Exception as error:
        logger.exception("Prediction failed")
        raise HTTPException(status_code=503, detail="Prediction service is unavailable") from error

    return result