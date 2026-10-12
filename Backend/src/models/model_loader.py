"""
Model loader — loads the best demand and shortage pipelines at startup.

The "best" model is determined by the training scripts, which persist
the winner to the canonical paths (demand_xgb_model.pkl /
shortage_xgb_model.pkl).  The loader also exposes per-algorithm
pipelines so the evaluation service can run predictions without
re-training.
"""

import joblib
import logging
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from src.config import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class ModelBundle:
    """The best-performing pipelines used for live predictions."""
    demand_model: object
    shortage_model: object
    label_encoder: object


@dataclass(frozen=True)
class AllModelsBundle:
    """All trained per-algorithm pipelines for evaluation/comparison."""
    # Demand regressors
    demand_linear_regression: object
    demand_random_forest: object
    demand_xgboost: object

    # Shortage classifiers
    shortage_logistic_regression: object
    shortage_random_forest: object
    shortage_xgboost: object

    # Shared label encoder
    label_encoder: object


# ---------------------------------------------------------------------------
# Loaders
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def load_models() -> ModelBundle:
    """Load the best demand and shortage pipelines for inference."""
    bundle = ModelBundle(
        demand_model=joblib.load(settings.demand_model_path),
        shortage_model=joblib.load(settings.shortage_model_path),
        label_encoder=joblib.load(settings.label_encoder_path),
    )
    logger.info("Loaded best demand model   : %s", settings.demand_model_path)
    logger.info("Loaded best shortage model : %s", settings.shortage_model_path)
    return bundle


def _try_load(path: Path, label: str):
    """Load a model file; return None with a warning if missing."""
    try:
        model = joblib.load(path)
        logger.debug("Loaded %s from %s", label, path)
        return model
    except FileNotFoundError:
        logger.warning("Model file not found for %s at %s — run training first", label, path)
        return None


@lru_cache(maxsize=1)
def load_all_models() -> AllModelsBundle:
    """Load every per-algorithm pipeline for evaluation comparison."""
    bundle = AllModelsBundle(
        demand_linear_regression=_try_load(
            settings.demand_linear_regression_model_path, "Demand / Linear Regression"
        ),
        demand_random_forest=_try_load(
            settings.demand_random_forest_model_path, "Demand / Random Forest"
        ),
        demand_xgboost=_try_load(
            settings.demand_xgboost_model_path, "Demand / XGBoost"
        ),
        shortage_logistic_regression=_try_load(
            settings.shortage_logistic_regression_model_path, "Shortage / Logistic Regression"
        ),
        shortage_random_forest=_try_load(
            settings.shortage_random_forest_model_path, "Shortage / Random Forest"
        ),
        shortage_xgboost=_try_load(
            settings.shortage_xgboost_model_path, "Shortage / XGBoost"
        ),
        label_encoder=joblib.load(settings.label_encoder_path),
    )
    logger.info("Loaded all per-algorithm model artifacts")
    return bundle


# ---------------------------------------------------------------------------
# Quick sanity-check entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    models = load_models()
    logger.info("Best demand model type   : %s", type(models.demand_model).__name__)
    logger.info("Best shortage model type : %s", type(models.shortage_model).__name__)
    logger.info("Shortage classes         : %s", list(models.label_encoder.classes_))

    all_models = load_all_models()
    logger.info("All demand models loaded : LR=%s  RF=%s  XGB=%s",
                type(all_models.demand_linear_regression).__name__,
                type(all_models.demand_random_forest).__name__,
                type(all_models.demand_xgboost).__name__)
