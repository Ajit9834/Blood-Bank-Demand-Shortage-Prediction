import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder


DATA_PATH = "data/raw/blood_bank_data.csv"


# Features used by the demand model
DEMAND_FEATURES = [
    "blood_group",
    "month",
    "day_of_week",
    "season",
    "current_blood_stock",
    "previous_demand",
    "average_daily_usage",
    "number_of_donations",
    "incoming_blood_units",
    "hospital_requests",
    "emergency_cases",
    "previous_week_demand",
    "previous_month_demand",
    "days_of_stock_remaining",
]

# Features used by the shortage model
SHORTAGE_FEATURES = [
    "blood_group",
    "month",
    "day_of_week",
    "season",
    "current_blood_stock",
    "previous_demand",
    "average_daily_usage",
    "number_of_donations",
    "incoming_blood_units",
    "hospital_requests",
    "emergency_cases",
    "previous_week_demand",
    "previous_month_demand",
    "days_of_stock_remaining",
]


CATEGORICAL_FEATURES = [
    "blood_group",
    "season",
]

NUMERICAL_FEATURES = [
    "month",
    "day_of_week",
    "current_blood_stock",
    "previous_demand",
    "average_daily_usage",
    "number_of_donations",
    "incoming_blood_units",
    "hospital_requests",
    "emergency_cases",
    "previous_week_demand",
    "previous_month_demand",
    "days_of_stock_remaining",
]


def load_dataset():
    """Load the raw blood bank dataset."""
    df = pd.read_csv(DATA_PATH)

    df["date"] = pd.to_datetime(df["date"])

    return df


def create_preprocessor():
    """Create preprocessing pipeline for categorical and numerical features."""

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

    return preprocessor


def create_time_split(df):
    """
    Split data chronologically.

    Training:
        2023-2024

    Testing:
        2025
    """

    train_df = df[df["date"] < "2025-01-01"].copy()

    test_df = df[df["date"] >= "2025-01-01"].copy()

    return train_df, test_df


def prepare_demand_data(train_df, test_df):
    """Prepare features and target for demand prediction."""

    X_train = train_df[DEMAND_FEATURES]
    y_train = train_df["future_demand"]

    X_test = test_df[DEMAND_FEATURES]
    y_test = test_df["future_demand"]

    return X_train, X_test, y_train, y_test


def prepare_shortage_data(train_df, test_df):
    """Prepare features and target for shortage prediction."""

    X_train = train_df[SHORTAGE_FEATURES]
    y_train = train_df["shortage_risk"]

    X_test = test_df[SHORTAGE_FEATURES]
    y_test = test_df["shortage_risk"]

    return X_train, X_test, y_train, y_test


if __name__ == "__main__":

    print("=" * 60)
    print("DATA PREPROCESSING CHECK")
    print("=" * 60)

    df = load_dataset()

    print("\nFull Dataset:")
    print(df.shape)

    train_df, test_df = create_time_split(df)

    print("\nTraining Dataset:")
    print(train_df.shape)

    print("\nTesting Dataset:")
    print(test_df.shape)

    print("\nTraining Date Range:")
    print(
        train_df["date"].min(),
        "to",
        train_df["date"].max(),
    )

    print("\nTesting Date Range:")
    print(
        test_df["date"].min(),
        "to",
        test_df["date"].max(),
    )

    print("\nDemand Features:")
    for feature in DEMAND_FEATURES:
        print(" -", feature)

    print("\nTarget:")
    print(" - future_demand")

    print("\nShortage Target:")
    print(" - shortage_risk")

    print("\nShortage Class Distribution - Training:")
    print(train_df["shortage_risk"].value_counts())

    print("\nShortage Class Distribution - Testing:")
    print(test_df["shortage_risk"].value_counts())

    print("\nPreprocessing check completed.")

    print("=" * 60)