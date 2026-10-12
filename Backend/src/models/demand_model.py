"""
Demand prediction model training.

Trains Linear Regression, Random Forest, and XGBoost regressors,
compares them on MAE / RMSE / R², selects the best model by R²,
saves the best pipeline to disk, and persists all metrics to JSON.
"""

import json
import os

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from xgboost import XGBRegressor

from src.data.preprocessing import (
    CATEGORICAL_FEATURES,
    DEMAND_FEATURES,
    NUMERICAL_FEATURES,
    create_time_split,
    load_dataset,
)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
MODELS_DIR = "models"
BEST_DEMAND_MODEL_PATH = os.path.join(MODELS_DIR, "demand_xgb_model.pkl")
DEMAND_METRICS_PATH = os.path.join(MODELS_DIR, "demand_model_metrics.json")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _preprocessor() -> ColumnTransformer:
    return ColumnTransformer(
        transformers=[
            (
                "categorical",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                CATEGORICAL_FEATURES,
            ),
            ("numerical", "passthrough", NUMERICAL_FEATURES),
        ]
    )


def _regression_metrics(y_true: pd.Series, y_pred: np.ndarray) -> dict:
    mae = float(mean_absolute_error(y_true, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    r2 = float(r2_score(y_true, y_pred))
    return {
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "r2": round(r2, 4),
    }


def _build_candidates() -> list[tuple[str, Pipeline]]:
    """Return all candidate pipelines."""
    return [
        (
            "Linear Regression",
            Pipeline(
                [
                    ("preprocessor", _preprocessor()),
                    ("model", LinearRegression()),
                ]
            ),
        ),
        (
            "Random Forest",
            Pipeline(
                [
                    ("preprocessor", _preprocessor()),
                    (
                        "model",
                        RandomForestRegressor(
                            n_estimators=300,
                            max_depth=None,
                            min_samples_leaf=2,
                            random_state=42,
                            n_jobs=-1,
                        ),
                    ),
                ]
            ),
        ),
        (
            "XGBoost",
            Pipeline(
                [
                    ("preprocessor", _preprocessor()),
                    (
                        "model",
                        XGBRegressor(
                            n_estimators=500,
                            max_depth=6,
                            learning_rate=0.05,
                            subsample=0.8,
                            colsample_bytree=0.8,
                            objective="reg:squarederror",
                            random_state=42,
                            n_jobs=-1,
                        ),
                    ),
                ]
            ),
        ),
    ]


# ---------------------------------------------------------------------------
# Main training function
# ---------------------------------------------------------------------------

def train_model():
    print("=" * 60)
    print("DEMAND PREDICTION — MODEL COMPARISON")
    print("Linear Regression  |  Random Forest  |  XGBoost")
    print("=" * 60)

    # ------------------------------------------------------------------
    # Load and split data
    # ------------------------------------------------------------------
    df = load_dataset()
    train_df, test_df = create_time_split(df)

    X_train = train_df[DEMAND_FEATURES]
    y_train = train_df["future_demand"]
    X_test = test_df[DEMAND_FEATURES]
    y_test = test_df["future_demand"]

    print(f"\nTraining rows : {len(X_train)}")
    print(f"Testing rows  : {len(X_test)}")

    # ------------------------------------------------------------------
    # Train and evaluate all candidates
    # ------------------------------------------------------------------
    candidates = _build_candidates()
    all_metrics: list[dict] = []
    trained_models: list[tuple[str, Pipeline]] = []

    for name, pipeline in candidates:
        print(f"\n  Training {name}...")
        pipeline.fit(X_train, y_train)
        y_pred = pipeline.predict(X_test)
        metrics = _regression_metrics(y_test, y_pred)
        all_metrics.append({"model": name, **metrics})
        trained_models.append((name, pipeline))

        print(f"    MAE  : {metrics['mae']:.4f}")
        print(f"    RMSE : {metrics['rmse']:.4f}")
        print(f"    R²   : {metrics['r2']:.4f}")

    # ------------------------------------------------------------------
    # Select best model — highest R²
    # ------------------------------------------------------------------
    best_idx = max(range(len(all_metrics)), key=lambda i: all_metrics[i]["r2"])
    best_name, best_pipeline = trained_models[best_idx]
    best_metrics = all_metrics[best_idx]

    print("\n" + "-" * 60)
    print(f"  Best model : {best_name}")
    print(f"  MAE  : {best_metrics['mae']:.4f}")
    print(f"  RMSE : {best_metrics['rmse']:.4f}")
    print(f"  R²   : {best_metrics['r2']:.4f}")
    print("-" * 60)

    # ------------------------------------------------------------------
    # Persist best model
    # ------------------------------------------------------------------
    os.makedirs(MODELS_DIR, exist_ok=True)
    joblib.dump(best_pipeline, BEST_DEMAND_MODEL_PATH)
    print(f"\nBest model saved → {BEST_DEMAND_MODEL_PATH}")

    # Save each trained model individually for evaluation service
    for name, pipeline in trained_models:
        slug = name.lower().replace(" ", "_")
        path = os.path.join(MODELS_DIR, f"demand_{slug}_model.pkl")
        joblib.dump(pipeline, path)
        print(f"  Saved {name} → {path}")

    # ------------------------------------------------------------------
    # Persist metrics JSON
    # ------------------------------------------------------------------
    metrics_payload = {
        "task": "demand_regression",
        "best_model": best_name,
        "models": all_metrics,
    }
    with open(DEMAND_METRICS_PATH, "w") as f:
        json.dump(metrics_payload, f, indent=2)
    print(f"\nMetrics saved  → {DEMAND_METRICS_PATH}")

    # ------------------------------------------------------------------
    # Summary table
    # ------------------------------------------------------------------
    print("\n--- Model Comparison Summary ---")
    header = f"{'Model':<22} {'MAE':>10} {'RMSE':>10} {'R²':>10}"
    print(header)
    print("-" * len(header))
    for m in all_metrics:
        marker = " ← best" if m["model"] == best_name else ""
        print(
            f"{m['model']:<22} {m['mae']:>10.4f} {m['rmse']:>10.4f} {m['r2']:>10.4f}{marker}"
        )

    # Sample predictions from best model
    y_pred_best = best_pipeline.predict(X_test)
    results = pd.DataFrame(
        {
            "Actual Demand": y_test.values[:10],
            "Predicted Demand": np.round(y_pred_best[:10], 2),
        }
    )
    print("\n--- Sample Predictions (Best Model) ---")
    print(results.to_string(index=False))

    print("\n" + "=" * 60)
    print("Demand model training completed successfully.")
    print("=" * 60)


if __name__ == "__main__":
    train_model()
