"""
Model performance service.

Reads pre-computed evaluation metrics from the JSON files written by the
training scripts.  Falls back to live evaluation (using the saved
per-algorithm pipelines) if the JSON files are not yet present, so the
API stays functional even before the first training run.
"""

import json
import logging
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix as sk_confusion_matrix,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
)

from api.schemas.operations import (
    ClassificationModelMetric,
    DemandModelMetric,
    ModelComparisonResponse,
)
from src.config import settings
from src.data.preprocessing import (
    DEMAND_FEATURES,
    SHORTAGE_FEATURES,
    create_time_split,
)
from src.models.model_loader import load_all_models

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Metric helpers
# ---------------------------------------------------------------------------

def _regression_metrics(y_true: pd.Series, y_pred: np.ndarray) -> tuple[float, float, float]:
    mae = round(float(mean_absolute_error(y_true, y_pred)), 4)
    rmse = round(float(np.sqrt(mean_squared_error(y_true, y_pred))), 4)
    r2 = round(float(r2_score(y_true, y_pred)), 4)
    return mae, rmse, r2


def _classification_metrics(y_true, y_pred) -> tuple[float, float, float, float]:
    accuracy = round(float(accuracy_score(y_true, y_pred)), 4)
    precision = round(float(precision_score(y_true, y_pred, average="weighted", zero_division=0)), 4)
    recall = round(float(recall_score(y_true, y_pred, average="weighted", zero_division=0)), 4)
    f1 = round(float(f1_score(y_true, y_pred, average="weighted", zero_division=0)), 4)
    return accuracy, precision, recall, f1


# ---------------------------------------------------------------------------
# Load from persisted JSON (fast path)
# ---------------------------------------------------------------------------

def _load_demand_metrics_from_json() -> tuple[list[DemandModelMetric], str] | None:
    path = Path(settings.demand_metrics_path)
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text())
        metrics = [
            DemandModelMetric(
                model=m["model"],
                mae=m["mae"],
                rmse=m["rmse"],
                r2=m["r2"],
            )
            for m in data["models"]
        ]
        return metrics, data.get("best_model", "")
    except Exception as exc:
        logger.warning("Could not parse demand metrics JSON: %s", exc)
        return None


def _load_shortage_metrics_from_json() -> tuple[list[ClassificationModelMetric], str] | None:
    path = Path(settings.shortage_metrics_path)
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text())
        metrics = [
            ClassificationModelMetric(
                model=m["model"],
                accuracy=m["accuracy"],
                precision=m["precision"],
                recall=m["recall"],
                f1=m["f1"],
                confusion_matrix=m.get("confusion_matrix"),
            )
            for m in data["models"]
        ]
        return metrics, data.get("best_model", "")
    except Exception as exc:
        logger.warning("Could not parse shortage metrics JSON: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Live fallback evaluation (slow path — used only if JSON is absent)
# ---------------------------------------------------------------------------

def _live_evaluate_demand(
    all_models,
    X_test: pd.DataFrame,
    y_test: pd.Series,
) -> tuple[list[DemandModelMetric], str]:
    candidates = [
        ("Linear Regression", all_models.demand_linear_regression),
        ("Random Forest", all_models.demand_random_forest),
        ("XGBoost", all_models.demand_xgboost),
    ]
    metrics: list[DemandModelMetric] = []
    for name, model in candidates:
        if model is None:
            logger.warning("Skipping %s — model not loaded", name)
            continue
        mae, rmse, r2 = _regression_metrics(y_test, model.predict(X_test))
        metrics.append(DemandModelMetric(model=name, mae=mae, rmse=rmse, r2=r2))

    best_model = max(metrics, key=lambda m: m.r2).model if metrics else ""
    return metrics, best_model


def _live_evaluate_shortage(
    all_models,
    X_test: pd.DataFrame,
    y_test: pd.Series,
) -> tuple[list[ClassificationModelMetric], str]:
    label_encoder = all_models.label_encoder
    y_test_enc = label_encoder.transform(y_test)

    candidates = [
        ("Logistic Regression", all_models.shortage_logistic_regression),
        ("Random Forest", all_models.shortage_random_forest),
        ("XGBoost", all_models.shortage_xgboost),
    ]
    metrics: list[ClassificationModelMetric] = []
    for name, model in candidates:
        if model is None:
            logger.warning("Skipping %s — model not loaded", name)
            continue
        y_pred = label_encoder.inverse_transform(model.predict(X_test).astype(int))
        y_actual = label_encoder.inverse_transform(y_test_enc)
        labels = list(label_encoder.classes_)
        cm = sk_confusion_matrix(y_actual, y_pred, labels=labels)
        cm_data = {
            "labels": labels,
            "entries": [
                {"actual": actual, "predicted": pred, "count": int(cm[i, j])}
                for i, actual in enumerate(labels)
                for j, pred in enumerate(labels)
            ],
        }
        accuracy, precision, recall, f1 = _classification_metrics(y_actual, y_pred)
        metrics.append(ClassificationModelMetric(
            model=name,
            accuracy=accuracy,
            precision=precision,
            recall=recall,
            f1=f1,
            confusion_matrix=cm_data,
        ))

    best_model = max(metrics, key=lambda m: m.f1).model if metrics else ""
    return metrics, best_model


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def evaluate_models() -> ModelComparisonResponse:
    """
    Return evaluation metrics for all three models on both tasks.

    Fast path  : reads pre-computed JSON files written by training scripts.
    Slow path  : runs live evaluation using saved per-algorithm .pkl files
                 (only if JSON files are missing).
    """
    demand_result = _load_demand_metrics_from_json()
    shortage_result = _load_shortage_metrics_from_json()

    if demand_result and shortage_result:
        logger.info("Loaded model metrics from persisted JSON files")
        demand_metrics, demand_best = demand_result
        shortage_metrics, shortage_best = shortage_result
    else:
        logger.info("Metrics JSON not found — running live evaluation")
        data = pd.read_csv(settings.data_path)
        data["date"] = pd.to_datetime(data["date"])
        train, test = create_time_split(data)

        all_models = load_all_models()

        if not demand_result:
            demand_metrics, demand_best = _live_evaluate_demand(
                all_models, test[DEMAND_FEATURES], test["future_demand"]
            )
        else:
            demand_metrics, demand_best = demand_result

        if not shortage_result:
            shortage_metrics, shortage_best = _live_evaluate_shortage(
                all_models, test[SHORTAGE_FEATURES], test["shortage_risk"]
            )
        else:
            shortage_metrics, shortage_best = shortage_result

    return ModelComparisonResponse(
        demand_models=demand_metrics,
        shortage_models=shortage_metrics,
        demand_best_model=demand_best,
        shortage_best_model=shortage_best,
        evaluated_at=datetime.now(timezone.utc),
    )
