import os
import joblib
import numpy as np
import pandas as pd

from xgboost import XGBClassifier

from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, LabelEncoder
from sklearn.pipeline import Pipeline

from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    classification_report,
)

from src.data.preprocessing import (
    load_dataset,
    create_time_split,
    SHORTAGE_FEATURES,
    CATEGORICAL_FEATURES,
    NUMERICAL_FEATURES,
)


MODEL_PATH = "models/shortage_xgb_model.pkl"
LABEL_ENCODER_PATH = "models/shortage_label_encoder.pkl"


def build_model():

    preprocessor = ColumnTransformer(
        transformers=[
            (
                "categorical",
                OneHotEncoder(
                    handle_unknown="ignore",
                    sparse_output=False,
                ),
                CATEGORICAL_FEATURES,
            ),
            (
                "numerical",
                "passthrough",
                NUMERICAL_FEATURES,
            ),
        ]
    )

    model = XGBClassifier(
        n_estimators=500,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        objective="multi:softprob",
        num_class=3,
        eval_metric="mlogloss",
        random_state=42,
        n_jobs=-1,
    )

    pipeline = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("model", model),
        ]
    )

    return pipeline


def train_model():

    print("=" * 60)
    print("XGBOOST SHORTAGE RISK CLASSIFICATION MODEL")
    print("=" * 60)

    # -----------------------------
    # Load dataset
    # -----------------------------
    df = load_dataset()

    # -----------------------------
    # Chronological split
    # -----------------------------
    train_df, test_df = create_time_split(df)

    X_train = train_df[SHORTAGE_FEATURES]
    y_train = train_df["shortage_risk"]

    X_test = test_df[SHORTAGE_FEATURES]
    y_test = test_df["shortage_risk"]

    print("\nTraining rows:", len(X_train))
    print("Testing rows:", len(X_test))

    # -----------------------------
    # Encode target labels
    # -----------------------------
    label_encoder = LabelEncoder()

    y_train_encoded = label_encoder.fit_transform(
        y_train
    )

    y_test_encoded = label_encoder.transform(
        y_test
    )

    print("\nClass Mapping:")

    for encoded, class_name in enumerate(
        label_encoder.classes_
    ):
        print(
            f"  {encoded} -> {class_name}"
        )

    # -----------------------------
    # Build model
    # -----------------------------
    pipeline = build_model()

    # -----------------------------
    # Train
    # -----------------------------
    print("\nTraining XGBoost classifier...")

    pipeline.fit(
        X_train,
        y_train_encoded
    )

    print("Training completed.")

    # -----------------------------
    # Predictions
    # -----------------------------
    y_pred_encoded = pipeline.predict(
        X_test
    )

    y_pred = label_encoder.inverse_transform(
        y_pred_encoded.astype(int)
    )

    # -----------------------------
    # Evaluation
    # -----------------------------
    accuracy = accuracy_score(
        y_test,
        y_pred
    )

    precision = precision_score(
        y_test,
        y_pred,
        average="weighted",
        zero_division=0
    )

    recall = recall_score(
        y_test,
        y_pred,
        average="weighted",
        zero_division=0
    )

    f1 = f1_score(
        y_test,
        y_pred,
        average="weighted",
        zero_division=0
    )

    print("\n--- Evaluation Metrics ---")

    print(f"Accuracy  : {accuracy:.4f}")
    print(f"Precision : {precision:.4f}")
    print(f"Recall    : {recall:.4f}")
    print(f"F1 Score  : {f1:.4f}")

    # -----------------------------
    # Classification report
    # -----------------------------
    print("\n--- Classification Report ---")

    print(
        classification_report(
            y_test,
            y_pred,
            labels=label_encoder.classes_,
            zero_division=0
        )
    )

    # -----------------------------
    # Confusion matrix
    # -----------------------------
    cm = confusion_matrix(
        y_test,
        y_pred,
        labels=label_encoder.classes_
    )

    cm_df = pd.DataFrame(
        cm,
        index=[
            f"Actual {label}"
            for label in label_encoder.classes_
        ],
        columns=[
            f"Predicted {label}"
            for label in label_encoder.classes_
        ]
    )

    print("--- Confusion Matrix ---")
    print(cm_df)

    # -----------------------------
    # Save model
    # -----------------------------
    os.makedirs(
        "models",
        exist_ok=True
    )

    joblib.dump(
        pipeline,
        MODEL_PATH
    )

    joblib.dump(
        label_encoder,
        LABEL_ENCODER_PATH
    )

    print("\nModel saved to:")
    print(MODEL_PATH)

    print("\nLabel encoder saved to:")
    print(LABEL_ENCODER_PATH)

    # -----------------------------
    # Sample predictions
    # -----------------------------
    results = pd.DataFrame({
        "Actual Risk": y_test.values[:15],
        "Predicted Risk": y_pred[:15],
    })

    print("\nSample Predictions:")
    print(
        results.to_string(
            index=False
        )
    )

    print("\n" + "=" * 60)
    print(
        "Shortage model completed successfully."
    )
    print("=" * 60)


if __name__ == "__main__":
    train_model()