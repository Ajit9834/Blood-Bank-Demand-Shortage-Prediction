import os
import numpy as np
import pandas as pd


# -----------------------------
# Configuration
# -----------------------------
RANDOM_SEED = 42
NUM_ROWS = 15000

OUTPUT_PATH = "data/raw/blood_bank_data.csv"

rng = np.random.default_rng(RANDOM_SEED)


# -----------------------------
# Basic information
# -----------------------------
blood_groups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]

blood_group_demand_factor = {
    "A+": 1.00,
    "A-": 0.72,
    "B+": 0.98,
    "B-": 0.70,
    "AB+": 0.68,
    "AB-": 0.58,
    "O+": 1.10,
    "O-": 0.78,
}

season_demand_factor = {
    "Winter": 1.05,
    "Spring": 0.98,
    "Summer": 1.08,
    "Monsoon": 1.12,
}


# -----------------------------
# Generate dates
# -----------------------------
dates = pd.date_range(
    start="2023-01-01",
    end="2025-12-31",
    periods=NUM_ROWS
)

df = pd.DataFrame({
    "date": dates
})

df["blood_group"] = rng.choice(
    blood_groups,
    size=NUM_ROWS
)

df["month"] = df["date"].dt.month

df["day_of_week"] = df["date"].dt.dayofweek


# -----------------------------
# Season
# -----------------------------
def get_season(month):
    if month in [12, 1, 2]:
        return "Winter"
    elif month in [3, 4, 5]:
        return "Spring"
    elif month in [6, 7, 8, 9]:
        return "Monsoon"
    else:
        return "Summer"


df["season"] = df["month"].apply(get_season)


# -----------------------------
# Blood stock
# -----------------------------
df["current_blood_stock"] = rng.integers(
    20,
    100,
    size=NUM_ROWS
)


# -----------------------------
# Average daily usage
# -----------------------------
base_usage = rng.normal(
    loc=9.5,
    scale=2.0,
    size=NUM_ROWS
)

df["average_daily_usage"] = np.clip(
    base_usage,
    4,
    18
).round(2)


# -----------------------------
# Previous demand
# -----------------------------
group_factor = df["blood_group"].map(
    blood_group_demand_factor
)

df["previous_demand"] = (
    df["average_daily_usage"]
    * group_factor
    * rng.normal(8.5, 0.7, NUM_ROWS)
).round().astype(int)

df["previous_demand"] = np.clip(
    df["previous_demand"],
    25,
    150
)


# -----------------------------
# Hospital requests
# -----------------------------
df["hospital_requests"] = np.clip(
    rng.poisson(16, NUM_ROWS),
    5,
    35
)


# -----------------------------
# Emergency cases
# -----------------------------
df["emergency_cases"] = np.clip(
    rng.poisson(6, NUM_ROWS),
    0,
    18
)


# -----------------------------
# Donations
# -----------------------------
df["number_of_donations"] = np.clip(
    rng.poisson(10, NUM_ROWS),
    2,
    25
)


# -----------------------------
# Incoming blood units
# -----------------------------
df["incoming_blood_units"] = np.clip(
    df["number_of_donations"]
    * rng.normal(0.8, 0.2, NUM_ROWS),
    0,
    25
).round().astype(int)


# -----------------------------
# Previous week demand
# -----------------------------
df["previous_week_demand"] = (
    df["previous_demand"]
    * rng.normal(1.0, 0.08, NUM_ROWS)
).round().astype(int)

df["previous_week_demand"] = np.clip(
    df["previous_week_demand"],
    20,
    160
)


# -----------------------------
# Previous month demand
# -----------------------------
df["previous_month_demand"] = (
    df["previous_demand"] * 4
    * rng.normal(1.0, 0.08, NUM_ROWS)
).round().astype(int)

df["previous_month_demand"] = np.clip(
    df["previous_month_demand"],
    80,
    600
)


# -----------------------------
# Seasonal demand factor
# -----------------------------
season_factor = df["season"].map(
    season_demand_factor
)


# -----------------------------
# Future demand
# -----------------------------
future_demand = (
    0.30 * df["previous_week_demand"]
    + 0.20 * df["previous_demand"]
    + 0.15 * (df["average_daily_usage"] * 7)
    + 1.00 * df["hospital_requests"]
    + 1.50 * df["emergency_cases"]
    + 8 * season_factor
    + rng.normal(0, 5, NUM_ROWS)
)

future_demand = np.clip(
    future_demand,
    25,
    170
)

df["future_demand"] = future_demand.round().astype(int)


# -----------------------------
# Days of stock remaining
# -----------------------------
df["days_of_stock_remaining"] = (
    df["current_blood_stock"]
    / df["average_daily_usage"]
).round(2)


# -----------------------------
# Create shortage target
# -----------------------------
#
# We calculate the actual future stock gap only to CREATE
# the training target.
#
# future_demand will NOT be used as an input feature when
# training the shortage model.
#
available_stock = (
    df["current_blood_stock"]
    + df["incoming_blood_units"]
)

stock_gap = available_stock - df["future_demand"]


# -----------------------------
# Balanced shortage classes
# -----------------------------
#
# Instead of fixed thresholds that created too many "High"
# samples, use quantiles to create approximately balanced
# classes in this synthetic development dataset.
#
# Lowest 35%  -> High
# Middle 35%  -> Medium
# Highest 30% -> Low
#
# Meaning:
#   Large positive stock gap  -> Low risk
#   Moderate stock gap        -> Medium risk
#   Negative/low stock gap    -> High risk
#
q35 = stock_gap.quantile(0.35)
q70 = stock_gap.quantile(0.70)


def assign_shortage_risk(gap):
    if gap <= q35:
        return "High"
    elif gap <= q70:
        return "Medium"
    else:
        return "Low"


df["shortage_risk"] = stock_gap.apply(
    assign_shortage_risk
)


# -----------------------------
# Remove helper variables
# -----------------------------
df = df.drop(columns=[])


# -----------------------------
# Round numeric columns
# -----------------------------
df["average_daily_usage"] = (
    df["average_daily_usage"].round(2)
)

df["days_of_stock_remaining"] = (
    df["days_of_stock_remaining"].round(2)
)


# -----------------------------
# Reorder columns
# -----------------------------
df = df[
    [
        "date",
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
        "future_demand",
        "shortage_risk",
    ]
]


# -----------------------------
# Save dataset
# -----------------------------
os.makedirs(
    os.path.dirname(OUTPUT_PATH),
    exist_ok=True
)

df.to_csv(
    OUTPUT_PATH,
    index=False
)


# -----------------------------
# Display summary
# -----------------------------
print("=" * 60)
print("Synthetic Blood Bank Dataset Generated")
print("=" * 60)

print(f"Rows: {len(df)}")
print(f"Columns: {len(df.columns)}")

print("\nSaved to:")
print(OUTPUT_PATH)

print("\nBlood Groups:")
print(df["blood_group"].value_counts())

print("\nShortage Risk Distribution:")
print(df["shortage_risk"].value_counts())

print("\nShortage Risk Percentage:")
print(
    (df["shortage_risk"].value_counts(normalize=True) * 100)
    .round(2)
)

print("\nMissing Values:")
print(df.isnull().sum().sum())

print("\nDuplicate Rows:")
print(df.duplicated().sum())

print("=" * 60)