import os
import joblib
import numpy as np
import pandas as pd

from xgboost import XGBRegressor
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.pipeline import Pipeline
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from src.data.preprocessing import (
    load_dataset,
    create_time_split,
    DEMAND_FEATURES,
    CATEGORICAL_FEATURES,
    NUMERICAL_FEATURES,
)


MODEL_PATH = "models/demand_xgb_model.pkl"


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

    model = XGBRegressor(
        n_estimators=500,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        objective="reg:squarederror",
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
    print("XGBOOST DEMAND PREDICTION MODEL")
    print("=" * 60)

    # Load data
    df = load_dataset()

    # Time-based split
    train_df, test_df = create_time_split(df)

    X_train = train_df[DEMAND_FEATURES]
    y_train = train_df["future_demand"]

    X_test = test_df[DEMAND_FEATURES]
    y_test = test_df["future_demand"]

    print("\nTraining rows:", len(X_train))
    print("Testing rows:", len(X_test))

    # Build model
    pipeline = build_model()

    # Train
    print("\nTraining XGBoost model...")

    pipeline.fit(
        X_train,
        y_train
    )

    print("Training completed.")

    # Predict
    y_pred = pipeline.predict(X_test)

    # Metrics
    mae = mean_absolute_error(
        y_test,
        y_pred
    )

    rmse = np.sqrt(
        mean_squared_error(
            y_test,
            y_pred
        )
    )

    r2 = r2_score(
        y_test,
        y_pred
    )

    print("\n--- Evaluation Metrics ---")

    print(f"MAE  : {mae:.4f}")
    print(f"RMSE : {rmse:.4f}")
    print(f"R²   : {r2:.4f}")

    # Save model
    os.makedirs(
        "models",
        exist_ok=True
    )

    joblib.dump(
        pipeline,
        MODEL_PATH
    )

    print("\nModel saved to:")
    print(MODEL_PATH)

    # Sample predictions
    results = pd.DataFrame({
        "Actual Demand": y_test.values[:10],
        "Predicted Demand": np.round(
            y_pred[:10],
            2
        ),
    })

    print("\nSample Predictions:")
    print(results.to_string(index=False))

    print("\n" + "=" * 60)
    print("Demand model completed successfully.")
    print("=" * 60)


if __name__ == "__main__":
    train_model()