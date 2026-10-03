from datetime import date, datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class BloodGroup(str, Enum):
    A_POSITIVE = "A+"
    A_NEGATIVE = "A-"
    B_POSITIVE = "B+"
    B_NEGATIVE = "B-"
    AB_POSITIVE = "AB+"
    AB_NEGATIVE = "AB-"
    O_POSITIVE = "O+"
    O_NEGATIVE = "O-"


class RiskLevel(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"


class InventoryRecord(BaseModel):
    blood_group: BloodGroup
    current_blood_stock: int = Field(..., ge=0)
    incoming_blood_units: int = Field(..., ge=0)
    average_daily_usage: float = Field(..., ge=0)
    available_units: int = Field(..., ge=0)
    projected_demand: float = Field(..., ge=0)
    days_of_stock_remaining: float = Field(..., ge=0)
    shortage_risk: RiskLevel
    stock_change: int
    updated_at: datetime


class InventoryCreate(BaseModel):
    blood_group: BloodGroup
    current_blood_stock: int = Field(..., ge=0)
    incoming_blood_units: int = Field(..., ge=0)
    average_daily_usage: float = Field(..., ge=0)


class InventoryUpdate(BaseModel):
    current_blood_stock: int | None = Field(default=None, ge=0)
    incoming_blood_units: int | None = Field(default=None, ge=0)
    average_daily_usage: float | None = Field(default=None, ge=0)


class InventoryResponse(BaseModel):
    items: list[InventoryRecord]


class DemandTrendPoint(BaseModel):
    label: str
    demand: float


class StockTrendPoint(BaseModel):
    label: str
    stock: float
    demand: float


class GroupDemandPoint(BaseModel):
    group: BloodGroup
    demand: float


class ShortageTrendPoint(BaseModel):
    label: str
    low: int
    medium: int
    high: int


class AnalyticsResponse(BaseModel):
    start_date: date | None
    end_date: date | None
    demand_trend: list[DemandTrendPoint]
    stock_trend: list[StockTrendPoint]
    demand_by_group: list[GroupDemandPoint]
    shortage_trend: list[ShortageTrendPoint]


class DemandAnalyticsResponse(BaseModel):
    start_date: date | None
    end_date: date | None
    demand_trend: list[DemandTrendPoint]
    demand_by_group: list[GroupDemandPoint]


class ShortageAnalyticsResponse(BaseModel):
    start_date: date | None
    end_date: date | None
    shortage_trend: list[ShortageTrendPoint]


class DemandModelMetric(BaseModel):
    model: str
    mae: float
    rmse: float
    r2: float


class ClassificationModelMetric(BaseModel):
    model: str
    accuracy: float
    precision: float
    recall: float
    f1: float


class ModelComparisonResponse(BaseModel):
    demand_models: list[DemandModelMetric]
    shortage_models: list[ClassificationModelMetric]
    evaluated_at: datetime


class Alert(BaseModel):
    id: str
    blood_group: BloodGroup
    alert_type: Literal["low_stock", "high_shortage_risk", "demand_gap", "critical_shortage"]
    severity: Literal["warning", "critical"]
    message: str
    created_at: datetime


class AlertsResponse(BaseModel):
    alerts: list[Alert]
    generated_at: datetime
