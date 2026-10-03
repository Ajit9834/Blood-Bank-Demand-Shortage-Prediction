from datetime import datetime, timezone

from api.schemas.operations import Alert, AlertsResponse
from src.services.inventory_service import list_inventory


def generate_alerts() -> AlertsResponse:
    generated_at = datetime.now(timezone.utc)
    alerts: list[Alert] = []
    for item in list_inventory():
        group = item.blood_group.value
        if item.days_of_stock_remaining <= 3:
            alerts.append(Alert(id=f"low-stock-{group}", blood_group=item.blood_group, alert_type="low_stock", severity="critical" if item.days_of_stock_remaining <= 1 else "warning", message=f"{group} has only {item.days_of_stock_remaining:.1f} days of stock remaining.", created_at=generated_at))
        if item.shortage_risk.value == "High":
            alerts.append(Alert(id=f"high-risk-{group}", blood_group=item.blood_group, alert_type="high_shortage_risk", severity="critical", message=f"{group} is classified as high shortage risk.", created_at=generated_at))
        if item.projected_demand > item.available_units:
            alerts.append(Alert(id=f"demand-gap-{group}", blood_group=item.blood_group, alert_type="demand_gap", severity="critical", message=f"{group} projected demand exceeds available units by {item.projected_demand - item.available_units:.0f}.", created_at=generated_at))
        if item.days_of_stock_remaining <= 1:
            alerts.append(Alert(id=f"critical-{group}", blood_group=item.blood_group, alert_type="critical_shortage", severity="critical", message=f"{group} requires immediate replenishment.", created_at=generated_at))
    return AlertsResponse(alerts=alerts, generated_at=generated_at)
