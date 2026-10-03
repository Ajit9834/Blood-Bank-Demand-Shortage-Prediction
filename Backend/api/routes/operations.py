from datetime import date

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from api.schemas.operations import (
    AlertsResponse,
    AnalyticsResponse,
    BloodGroup,
    DemandAnalyticsResponse,
    InventoryCreate,
    InventoryRecord,
    InventoryResponse,
    InventoryUpdate,
    ModelComparisonResponse,
    ShortageAnalyticsResponse,
)
from src.services.alert_service import generate_alerts
from src.services.analytics_service import get_analytics, get_demand_analytics, get_shortage_analytics
from src.services.export_service import analytics_csv, inventory_csv, model_performance_csv, predictions_csv
from src.services.inventory_service import create_inventory, get_inventory, list_inventory, update_inventory
from src.services.model_performance_service import evaluate_models

router = APIRouter()


@router.get("/inventory", response_model=InventoryResponse, tags=["inventory"])
def inventory() -> InventoryResponse:
    return InventoryResponse(items=list_inventory())


@router.get("/inventory/{blood_group}", response_model=InventoryRecord, tags=["inventory"])
def inventory_by_group(blood_group: BloodGroup) -> InventoryRecord:
    result = get_inventory(blood_group)
    if result is None:
        raise HTTPException(status_code=404, detail="Blood group inventory not found")
    return result


@router.post("/inventory", response_model=InventoryRecord, status_code=201, tags=["inventory"])
def add_inventory(payload: InventoryCreate) -> InventoryRecord:
    try:
        return create_inventory(payload)
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@router.put("/inventory/{blood_group}", response_model=InventoryRecord, tags=["inventory"])
def edit_inventory(blood_group: BloodGroup, payload: InventoryUpdate) -> InventoryRecord:
    result = update_inventory(blood_group, payload)
    if result is None:
        raise HTTPException(status_code=404, detail="Blood group inventory not found")
    return result


@router.get("/analytics", response_model=AnalyticsResponse, tags=["analytics"])
def analytics(start_date: date | None = Query(default=None), end_date: date | None = Query(default=None)) -> AnalyticsResponse:
    if start_date and end_date and start_date > end_date:
        raise HTTPException(status_code=400, detail="start_date must be before end_date")
    return get_analytics(start_date, end_date)


@router.get("/analytics/demand", response_model=DemandAnalyticsResponse, tags=["analytics"])
def demand_analytics(start_date: date | None = Query(default=None), end_date: date | None = Query(default=None)) -> DemandAnalyticsResponse:
    return get_demand_analytics(start_date, end_date)


@router.get("/analytics/shortage", response_model=ShortageAnalyticsResponse, tags=["analytics"])
def shortage_analytics(start_date: date | None = Query(default=None), end_date: date | None = Query(default=None)) -> ShortageAnalyticsResponse:
    return get_shortage_analytics(start_date, end_date)


@router.get("/models/comparison", response_model=ModelComparisonResponse, tags=["models"])
@router.get("/models/performance", response_model=ModelComparisonResponse, tags=["models"])
def model_performance() -> ModelComparisonResponse:
    return evaluate_models()


@router.get("/alerts", response_model=AlertsResponse, tags=["alerts"])
def alerts() -> AlertsResponse:
    return generate_alerts()


@router.post("/alerts/generate", response_model=AlertsResponse, tags=["alerts"])
def generate_alerts_endpoint() -> AlertsResponse:
    return generate_alerts()


def _csv_response(content: str, filename: str) -> StreamingResponse:
    return StreamingResponse(iter([content]), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.get("/export/inventory", tags=["export"])
def export_inventory() -> StreamingResponse:
    return _csv_response(inventory_csv().getvalue(), "inventory.csv")


@router.get("/export/predictions", tags=["export"])
def export_predictions() -> StreamingResponse:
    return _csv_response(predictions_csv().getvalue(), "predictions.csv")


@router.get("/export/analytics", tags=["export"])
def export_analytics() -> StreamingResponse:
    return _csv_response(analytics_csv().getvalue(), "analytics.csv")


@router.get("/export/models", tags=["export"])
def export_models() -> StreamingResponse:
    return _csv_response(model_performance_csv().getvalue(), "model-performance.csv")
