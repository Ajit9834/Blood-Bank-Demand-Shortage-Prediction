from io import StringIO

import pandas as pd

from src.services.analytics_service import get_analytics, load_analytics_data
from src.services.inventory_service import inventory_frame
from src.services.model_performance_service import evaluate_models


def inventory_csv() -> StringIO:
    output = StringIO()
    inventory_frame().to_csv(output, index=False)
    output.seek(0)
    return output


def predictions_csv() -> StringIO:
    output = StringIO()
    load_analytics_data().to_csv(output, index=False)
    output.seek(0)
    return output


def analytics_csv() -> StringIO:
    analytics = get_analytics()
    rows = []
    for point in analytics.demand_trend:
        rows.append({"type": "demand", "label": point.label, "demand": point.demand})
    for point in analytics.stock_trend:
        rows.append({"type": "stock", "label": point.label, "stock": point.stock, "demand": point.demand})
    for point in analytics.shortage_trend:
        rows.append({"type": "shortage", "label": point.label, "low": point.low, "medium": point.medium, "high": point.high})
    output = StringIO()
    pd.DataFrame(rows).to_csv(output, index=False)
    output.seek(0)
    return output


def model_performance_csv() -> StringIO:
    comparison = evaluate_models()
    rows = [
        {"task": "demand", "model": item.model, "mae": item.mae, "rmse": item.rmse, "r2": item.r2}
        for item in comparison.demand_models
    ]
    rows.extend(
        {"task": "shortage", "model": item.model, "accuracy": item.accuracy, "precision": item.precision, "recall": item.recall, "f1": item.f1}
        for item in comparison.shortage_models
    )
    output = StringIO()
    pd.DataFrame(rows).to_csv(output, index=False)
    output.seek(0)
    return output
