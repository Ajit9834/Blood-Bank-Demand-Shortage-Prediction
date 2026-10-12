"""
Shortage risk classification model training.

Trains Logistic Regression, Random Forest, and XGBoost classifiers,
compares them on Accuracy / Precision / Recall / F1, selects the best
model by F1 (weighted), saves the best pipeline to disk, and persists
all metrics to JSON.
"""

import json
import os

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.multiclass import OneVsRestClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, OneHotEncoder
from xgboost import XGBClassifier

from src.data.preprocessing import (
    CATEGORICAL_FEATURES,
    NUMERICAL_FEATURES,
    SHORTAGE_FEATURES,
    create_time_split,
    load_dataset,
)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
MODELS_DIR = "models"
BEST_SHORTAGE_MODEL_PATH = os.path.join(MODELS_DIR, "shortage_xgb_model.pkl")
LABEL_ENCODER_PATH = os.path.join(MODELS_DIR, "shortage_label_encoder.pkl")
SHORTAGE_METRICS_PATH = os.path.join(MODELS_DIR, "shortage_model_metrics.json")


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


def _classification_metrics(y_true, y_pred) -> dict:
    return {
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "precision": round(
            float(precision_score(y_true, y_pred, average="weighted", zero_division=0)), 4
        ),
        "recall": round(
            float(recall_score(y_true, y_pred, average="weighted", zero_division=0)), 4
        ),
        "f1": round(
            float(f1_score(y_true, y_pred, average="weighted", zero_division=0)), 4
        ),
    }


def _build_candidates(num_classes: int) -> list[tuple[str, Pipeline]]:
    """Return all candidate classification pipelines."""
    return [
        (
            "Logistic Regression",
            Pipeline(
                [
                    ("preprocessor", _preprocessor()),
                    (
                        "model",
                        OneVsRestClassifier(
                            LogisticRegression(
                                max_iter=2000,
                                solver="liblinear",
                                C=1.0,
                                random_state=42,
                            )
                        ),
                    ),
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
                        RandomForestClassifier(
                            n_estimators=300,
                            max_depth=None,
                            min_samples_leaf=1,
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
                        XGBClassifier(
                            n_estimators=500,
                            max_depth=6,
                            learning_rate=0.05,
                            subsample=0.8,
                            colsample_bytree=0.8,
                            objective="multi:softprob",
                            num_class=num_classes,
                            eval_metric="mlogloss",
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
    print("SHORTAGE RISK CLASSIFICATION — MODEL COMPARISON")
    print("Logistic Regression  |  Random Forest  |  XGBoost")
    print("=" * 60)

    # ------------------------------------------------------------------
    # Load and split data
    # ------------------------------------------------------------------
    df = load_dataset()
    train_df, test_df = create_time_split(df)

    X_train = train_df[SHORTAGE_FEATURES]
    y_train = train_df["shortage_risk"]
    X_test = test_df[SHORTAGE_FEATURES]
    y_test = test_df["shortage_risk"]

    print(f"\nTraining rows : {len(X_train)}")
    print(f"Testing rows  : {len(X_test)}")

    # ------------------------------------------------------------------
    # Encode labels
    # ------------------------------------------------------------------
    label_encoder = LabelEncoder()
    y_train_enc = label_encoder.fit_transform(y_train)
    y_test_enc = label_encoder.transform(y_test)
    num_classes = len(label_encoder.classes_)

    print("\nClass mapping:")
    for idx, cls in enumerate(label_encoder.classes_):
        print(f"  {idx} -> {cls}")

    # ------------------------------------------------------------------
    # Train and evaluate all candidates
    # ------------------------------------------------------------------
    candidates = _build_candidates(num_classes)
    all_metrics: list[dict] = []
    trained_models: list[tuple[str, Pipeline]] = []

    for name, pipeline in candidates:
        print(f"\n  Training {name}...")
        pipeline.fit(X_train, y_train_enc)
        y_pred_enc = pipeline.predict(X_test).astype(int)
        y_pred = label_encoder.inverse_transform(y_pred_enc)
        metrics = _classification_metrics(y_test, y_pred)
        all_metrics.append({"model": name, **metrics})
        trained_models.append((name, pipeline))

        print(f"    Accuracy  : {metrics['accuracy']:.4f}")
        print(f"    Precision : {metrics['precision']:.4f}")
        print(f"    Recall    : {metrics['recall']:.4f}")
        print(f"    F1        : {metrics['f1']:.4f}")

    # ------------------------------------------------------------------
    # Select best model — highest weighted F1
    # ------------------------------------------------------------------
    best_idx = max(range(len(all_metrics)), key=lambda i: all_metrics[i]["f1"])
    best_name, best_pipeline = trained_models[best_idx]
    best_metrics = all_metrics[best_idx]

    print("\n" + "-" * 60)
    print(f"  Best model : {best_name}")
    print(f"  Accuracy   : {best_metrics['accuracy']:.4f}")
    print(f"  Precision  : {best_metrics['precision']:.4f}")
    print(f"  Recall     : {best_metrics['recall']:.4f}")
    print(f"  F1         : {best_metrics['f1']:.4f}")
    print("-" * 60)

    # ------------------------------------------------------------------
    # Persist models
    # ------------------------------------------------------------------
    os.makedirs(MODELS_DIR, exist_ok=True)
    joblib.dump(best_pipeline, BEST_SHORTAGE_MODEL_PATH)
    joblib.dump(label_encoder, LABEL_ENCODER_PATH)
    print(f"\nBest model saved    → {BEST_SHORTAGE_MODEL_PATH}")
    print(f"Label encoder saved → {LABEL_ENCODER_PATH}")

    # Save each trained model individually for evaluation service
    for name, pipeline in trained_models:
        slug = name.lower().replace(" ", "_")
        path = os.path.join(MODELS_DIR, f"shortage_{slug}_model.pkl")
        joblib.dump(pipeline, path)
        print(f"  Saved {name} → {path}")

    # ------------------------------------------------------------------
    # Persist metrics JSON
    # ------------------------------------------------------------------
    metrics_payload = {
        "task": "shortage_classification",
        "best_model": best_name,
        "models": all_metrics,
    }
    with open(SHORTAGE_METRICS_PATH, "w") as f:
        json.dump(metrics_payload, f, indent=2)
    print(f"\nMetrics saved       → {SHORTAGE_METRICS_PATH}")

    # ------------------------------------------------------------------
    # Summary table
    # ------------------------------------------------------------------
    print("\n--- Model Comparison Summary ---")
    header = f"{'Model':<24} {'Accuracy':>10} {'Precision':>10} {'Recall':>10} {'F1':>10}"
    print(header)
    print("-" * len(header))
    for m in all_metrics:
        marker = " ← best" if m["model"] == best_name else ""
        print(
            f"{m['model']:<24} {m['accuracy']:>10.4f} {m['precision']:>10.4f}"
            f" {m['recall']:>10.4f} {m['f1']:>10.4f}{marker}"
        )

    # Classification report for best model
    y_pred_best_enc = best_pipeline.predict(X_test).astype(int)
    y_pred_best = label_encoder.inverse_transform(y_pred_best_enc)

    print(f"\n--- Classification Report ({best_name}) ---")
    print(
        classification_report(
            y_test,
            y_pred_best,
            labels=label_encoder.classes_,
            zero_division=0,
        )
    )

    # Confusion matrix
    cm = confusion_matrix(y_test, y_pred_best, labels=label_encoder.classes_)
    cm_df = pd.DataFrame(
        cm,
        index=[f"Actual {c}" for c in label_encoder.classes_],
        columns=[f"Pred {c}" for c in label_encoder.classes_],
    )
    print("--- Confusion Matrix ---")
    print(cm_df)

    # Sample predictions
    results = pd.DataFrame(
        {
            "Actual Risk": y_test.values[:15],
            "Predicted Risk": y_pred_best[:15],
        }
    )
    print("\n--- Sample Predictions (Best Model) ---")
    print(results.to_string(index=False))

    print("\n" + "=" * 60)
    print("Shortage model training completed successfully.")
    print("=" * 60)


if __name__ == "__main__":
    train_model()
