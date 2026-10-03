import joblib
import logging
from dataclasses import dataclass
from functools import lru_cache

from src.config import settings


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ModelBundle:
    demand_model: object
    shortage_model: object
    label_encoder: object


@lru_cache(maxsize=1)
def load_models() -> ModelBundle:
    models = ModelBundle(
        demand_model=joblib.load(settings.demand_model_path),
        shortage_model=joblib.load(settings.shortage_model_path),
        label_encoder=joblib.load(settings.label_encoder_path),
    )
    logger.info("Loaded demand, shortage, and label-encoder artifacts")
    return models



if __name__ == "__main__":
    models = load_models()

    logger.info("Models loaded successfully")
    logger.info("Demand model: %s", type(models.demand_model).__name__)
    logger.info("Shortage model: %s", type(models.shortage_model).__name__)
    logger.info("Shortage classes: %s", list(models.label_encoder.classes_))