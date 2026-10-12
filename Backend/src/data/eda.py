import os

import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns


# -----------------------------
# Configuration
# -----------------------------
DATA_PATH = "data/raw/blood_bank_data.csv"
OUTPUT_DIR = "outputs/figures"

os.makedirs(OUTPUT_DIR, exist_ok=True)


# -----------------------------
# Load dataset
# -----------------------------
df = pd.read_csv(DATA_PATH)

df["date"] = pd.to_datetime(df["date"])


print("=" * 60)
print("EXPLORATORY DATA ANALYSIS")
print("=" * 60)

print("\nDataset Shape:")
print(df.shape)

print("\nColumns:")
print(df.columns.tolist())

print("\nData Types:")
print(df.dtypes)

print("\nMissing Values:")
print(df.isnull().sum())

print("\nDuplicate Rows:")
print(df.duplicated().sum())


# -----------------------------
# 1. Future Demand Distribution
# -----------------------------
plt.figure(figsize=(10, 6))

sns.histplot(
    df["future_demand"],
    bins=30,
    kde=True
)

plt.title("Distribution of Future Blood Demand")
plt.xlabel("Future Demand (Units)")
plt.ylabel("Frequency")
plt.tight_layout()

plt.savefig(
    f"{OUTPUT_DIR}/future_demand_distribution.png",
    dpi=300
)

plt.close()


# -----------------------------
# 2. Demand by Blood Group
# -----------------------------
plt.figure(figsize=(10, 6))

sns.boxplot(
    data=df,
    x="blood_group",
    y="future_demand"
)

plt.title("Future Blood Demand by Blood Group")
plt.xlabel("Blood Group")
plt.ylabel("Future Demand (Units)")
plt.tight_layout()

plt.savefig(
    f"{OUTPUT_DIR}/demand_by_blood_group.png",
    dpi=300
)

plt.close()


# -----------------------------
# 3. Shortage Risk Distribution
# -----------------------------
plt.figure(figsize=(8, 6))

sns.countplot(
    data=df,
    x="shortage_risk",
    order=["Low", "Medium", "High"]
)

plt.title("Shortage Risk Distribution")
plt.xlabel("Shortage Risk")
plt.ylabel("Number of Records")
plt.tight_layout()

plt.savefig(
    f"{OUTPUT_DIR}/shortage_risk_distribution.png",
    dpi=300
)

plt.close()


# -----------------------------
# 4. Current Stock vs Future Demand
# -----------------------------
plt.figure(figsize=(10, 6))

sns.scatterplot(
    data=df.sample(
        min(3000, len(df)),
        random_state=42
    ),
    x="current_blood_stock",
    y="future_demand",
    hue="shortage_risk",
    alpha=0.6
)

plt.title("Current Blood Stock vs Future Demand")
plt.xlabel("Current Blood Stock")
plt.ylabel("Future Demand")
plt.tight_layout()

plt.savefig(
    f"{OUTPUT_DIR}/stock_vs_demand.png",
    dpi=300
)

plt.close()


# -----------------------------
# 5. Correlation Matrix
# -----------------------------
numeric_columns = [
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
    "future_demand",
]

correlation_matrix = df[numeric_columns].corr()

plt.figure(figsize=(12, 9))

sns.heatmap(
    correlation_matrix,
    annot=True,
    fmt=".2f",
    cmap="coolwarm",
    center=0
)

plt.title("Correlation Matrix")
plt.tight_layout()

plt.savefig(
    f"{OUTPUT_DIR}/correlation_matrix.png",
    dpi=300
)

plt.close()


# -----------------------------
# 6. Monthly Demand Trend
# -----------------------------
monthly_demand = (
    df.groupby(df["date"].dt.to_period("M"))["future_demand"]
    .mean()
    .reset_index()
)

monthly_demand["date"] = (
    monthly_demand["date"].dt.to_timestamp()
)

plt.figure(figsize=(14, 6))

plt.plot(
    monthly_demand["date"],
    monthly_demand["future_demand"]
)

plt.title("Monthly Average Future Blood Demand")
plt.xlabel("Date")
plt.ylabel("Average Future Demand")
plt.xticks(rotation=45)
plt.tight_layout()

plt.savefig(
    f"{OUTPUT_DIR}/monthly_demand_trend.png",
    dpi=300
)

plt.close()


# -----------------------------
# Summary statistics
# -----------------------------
print("\nFuture Demand Statistics:")
print(df["future_demand"].describe())

print("\nAverage Demand by Blood Group:")
print(
    df.groupby("blood_group")["future_demand"]
    .mean()
    .sort_values(ascending=False)
    .round(2)
)

print("\nAverage Stock by Shortage Risk:")
print(
    df.groupby("shortage_risk")[
        [
            "current_blood_stock",
            "future_demand",
            "incoming_blood_units",
            "days_of_stock_remaining",
        ]
    ]
    .mean()
    .round(2)
)

print("\nEDA completed successfully.")

print("\nFigures saved to:")
print(OUTPUT_DIR)

print("=" * 60)