from datetime import date
from functools import lru_cache

import pandas as pd

from api.schemas.operations import (
    AnalyticsResponse,
    DemandAnalyticsResponse,
    DemandTrendPoint,
    GroupDemandPoint,
    ShortageAnalyticsResponse,
    ShortageTrendPoint,
    StockTrendPoint,
)
from src.config import settings


DATA_PATH = settings.data_path


@lru_cache(maxsize=1)
def _load_source_data() -> pd.DataFrame:
    data = pd.read_csv(DATA_PATH)
    data["date"] = pd.to_datetime(data["date"])
    return data.sort_values("date")


def load_analytics_data(start_date: date | None = None, end_date: date | None = None) -> pd.DataFrame:
    data = _load_source_data()
    filtered = data
    if start_date:
        filtered = filtered[filtered["date"] >= pd.Timestamp(start_date)]
    if end_date:
        filtered = filtered[filtered["date"] < pd.Timestamp(end_date) + pd.Timedelta(days=1)]
    return filtered.copy()


def _date_bounds(data: pd.DataFrame) -> tuple[date | None, date | None]:
    if data.empty:
        return None, None
    return data["date"].dt.date.min(), data["date"].dt.date.max()


def _daily_data(data: pd.DataFrame) -> pd.DataFrame:
    return data.assign(day=data["date"].dt.strftime("%Y-%m-%d")).groupby("day", as_index=False).agg(
        demand=("future_demand", "mean"),
        stock=("current_blood_stock", "sum"),
    )


def get_demand_analytics(start_date: date | None = None, end_date: date | None = None) -> DemandAnalyticsResponse:
    data = load_analytics_data(start_date, end_date)
    daily = _daily_data(data)
    actual_start, actual_end = _date_bounds(data)
    return DemandAnalyticsResponse(
        start_date=actual_start,
        end_date=actual_end,
        demand_trend=[DemandTrendPoint(label=row.day, demand=round(float(row.demand), 2)) for row in daily.itertuples()],
        demand_by_group=[GroupDemandPoint(group=row.blood_group, demand=round(float(row.future_demand), 2)) for row in data.groupby("blood_group")["future_demand"].mean().reset_index().itertuples()],
    )


def get_shortage_analytics(start_date: date | None = None, end_date: date | None = None) -> ShortageAnalyticsResponse:
    data = load_analytics_data(start_date, end_date)
    actual_start, actual_end = _date_bounds(data)
    grouped = data.assign(day=data["date"].dt.strftime("%Y-%m-%d")).pivot_table(
        index="day", columns="shortage_risk", values="blood_group", aggfunc="count", fill_value=0
    ).reset_index()
    return ShortageAnalyticsResponse(
        start_date=actual_start,
        end_date=actual_end,
        shortage_trend=[
            ShortageTrendPoint(label=row["day"], low=int(row.get("Low", 0)), medium=int(row.get("Medium", 0)), high=int(row.get("High", 0)))
            for row in grouped.to_dict("records")
        ],
    )


def get_analytics(start_date: date | None = None, end_date: date | None = None) -> AnalyticsResponse:
    data = load_analytics_data(start_date, end_date)
    daily = _daily_data(data)
    actual_start, actual_end = _date_bounds(data)
    demand_by_group = data.groupby("blood_group")["future_demand"].mean().reset_index()
    shortage_grouped = data.assign(day=data["date"].dt.strftime("%Y-%m-%d")).pivot_table(
        index="day", columns="shortage_risk", values="blood_group", aggfunc="count", fill_value=0
    ).reset_index()
    return AnalyticsResponse(
        start_date=actual_start,
        end_date=actual_end,
        demand_trend=[DemandTrendPoint(label=row.day, demand=round(float(row.demand), 2)) for row in daily.itertuples()],
        demand_by_group=[GroupDemandPoint(group=row.blood_group, demand=round(float(row.future_demand), 2)) for row in demand_by_group.itertuples()],
        stock_trend=[StockTrendPoint(label=row.day, stock=round(float(row.stock), 2), demand=round(float(row.demand), 2)) for row in daily.itertuples()],
        shortage_trend=[
            ShortageTrendPoint(label=row["day"], low=int(row.get("Low", 0)), medium=int(row.get("Medium", 0)), high=int(row.get("High", 0)))
            for row in shortage_grouped.to_dict("records")
        ],
    )
