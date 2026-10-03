from datetime import datetime, timezone
from functools import lru_cache

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.multiclass import OneVsRestClassifier

from api.schemas.operations import ClassificationModelMetric, DemandModelMetric, ModelComparisonResponse
from src.config import settings
from src.data.preprocessing import CATEGORICAL_FEATURES, DEMAND_FEATURES, NUMERICAL_FEATURES, SHORTAGE_FEATURES, create_time_split
from src.models.model_loader import load_models


DATA_PATH = settings.data_path


def _preprocessor() -> ColumnTransformer:
    return ColumnTransformer(
        transformers=[
            ("categorical", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAL_FEATURES),
            ("numerical", "passthrough", NUMERICAL_FEATURES),
        ]
    )


def _load_data() -> tuple[pd.DataFrame, pd.DataFrame]:
    data = pd.read_csv(DATA_PATH)
    data["date"] = pd.to_datetime(data["date"])
    return create_time_split(data)


def _regression_metrics(actual: pd.Series, predicted: np.ndarray) -> tuple[float, float, float]:
    return (
        round(float(mean_absolute_error(actual, predicted)), 4),
        round(float(np.sqrt(mean_squared_error(actual, predicted))), 4),
        round(float(r2_score(actual, predicted)), 4),
    )


def _classification_metrics(actual: pd.Series, predicted: np.ndarray) -> tuple[float, float, float, float]:
    return (
        round(float(accuracy_score(actual, predicted)), 4),
        round(float(precision_score(actual, predicted, average="weighted", zero_division=0)), 4),
        round(float(recall_score(actual, predicted, average="weighted", zero_division=0)), 4),
        round(float(f1_score(actual, predicted, average="weighted", zero_division=0)), 4),
    )


@lru_cache(maxsize=1)
def evaluate_models() -> ModelComparisonResponse:
    train, test = _load_data()
    demand_x_train, demand_x_test = train[DEMAND_FEATURES], test[DEMAND_FEATURES]
    demand_y_train, demand_y_test = train["future_demand"], test["future_demand"]

    demand_models = [
        ("Linear Regression", Pipeline([("preprocessor", _preprocessor()), ("model", LinearRegression())])),
        ("Random Forest", Pipeline([("preprocessor", _preprocessor()), ("model", RandomForestRegressor(n_estimators=150, random_state=42, n_jobs=-1))])),
    ]
    demand_metrics: list[DemandModelMetric] = []
    for name, model in demand_models:
        model.fit(demand_x_train, demand_y_train)
        mae, rmse, r2 = _regression_metrics(demand_y_test, model.predict(demand_x_test))
        demand_metrics.append(DemandModelMetric(model=name, mae=mae, rmse=rmse, r2=r2))

    models = load_models()
    demand_model = models.demand_model
    mae, rmse, r2 = _regression_metrics(demand_y_test, demand_model.predict(demand_x_test))
    demand_metrics.append(DemandModelMetric(model="XGBoost", mae=mae, rmse=rmse, r2=r2))

    label_encoder = models.label_encoder
    shortage_x_train, shortage_x_test = train[SHORTAGE_FEATURES], test[SHORTAGE_FEATURES]
    shortage_y_train = label_encoder.transform(train["shortage_risk"])
    shortage_y_test = label_encoder.transform(test["shortage_risk"])
    shortage_models = [
        ("Logistic Regression", Pipeline([("preprocessor", _preprocessor()), ("model", OneVsRestClassifier(LogisticRegression(max_iter=2000, solver="liblinear", random_state=42)))])),
        ("Random Forest", Pipeline([("preprocessor", _preprocessor()), ("model", RandomForestClassifier(n_estimators=150, random_state=42, n_jobs=-1))])),
    ]
    shortage_metrics: list[ClassificationModelMetric] = []
    for name, model in shortage_models:
        model.fit(shortage_x_train, shortage_y_train)
        predictions = label_encoder.inverse_transform(model.predict(shortage_x_test).astype(int))
        actual = label_encoder.inverse_transform(shortage_y_test)
        accuracy, precision, recall, f1 = _classification_metrics(actual, predictions)
        shortage_metrics.append(ClassificationModelMetric(model=name, accuracy=accuracy, precision=precision, recall=recall, f1=f1))

    shortage_model = models.shortage_model
    predictions = label_encoder.inverse_transform(shortage_model.predict(shortage_x_test).astype(int))
    actual = label_encoder.inverse_transform(shortage_y_test)
    accuracy, precision, recall, f1 = _classification_metrics(actual, predictions)
    shortage_metrics.append(ClassificationModelMetric(model="XGBoost", accuracy=accuracy, precision=precision, recall=recall, f1=f1))

    return ModelComparisonResponse(
        demand_models=demand_metrics,
        shortage_models=shortage_metrics,
        evaluated_at=datetime.now(timezone.utc),
    )
