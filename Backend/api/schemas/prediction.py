from pydantic import BaseModel, Field


class PredictionRequest(BaseModel):
    blood_group: str = Field(..., json_schema_extra={"example": "O+"})
    month: int = Field(..., ge=1, le=12, json_schema_extra={"example": 10})
    day_of_week: int = Field(..., ge=0, le=6, json_schema_extra={"example": 4})
    season: str = Field(..., json_schema_extra={"example": "Autumn"})

    current_blood_stock: int = Field(
        ..., ge=0, json_schema_extra={"example": 60}
    )
    previous_demand: int = Field(
        ..., ge=0, json_schema_extra={"example": 78}
    )
    average_daily_usage: float = Field(
        ..., ge=0, json_schema_extra={"example": 11.2}
    )
    number_of_donations: int = Field(
        ..., ge=0, json_schema_extra={"example": 8}
    )
    incoming_blood_units: int = Field(
        ..., ge=0, json_schema_extra={"example": 10}
    )
    hospital_requests: int = Field(
        ..., ge=0, json_schema_extra={"example": 18}
    )
    emergency_cases: int = Field(
        ..., ge=0, json_schema_extra={"example": 3}
    )
    previous_week_demand: int = Field(
        ..., ge=0, json_schema_extra={"example": 80}
    )
    previous_month_demand: int = Field(
        ..., ge=0, json_schema_extra={"example": 76}
    )
    days_of_stock_remaining: float = Field(
        ..., ge=0, json_schema_extra={"example": 5.4}
    )


class PredictionResponse(BaseModel):
    predicted_demand: float
    shortage_risk: str