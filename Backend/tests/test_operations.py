from fastapi.testclient import TestClient

from api.main import app


client = TestClient(app)


VALID_INVENTORY = {
    "current_blood_stock": 80,
    "incoming_blood_units": 12,
    "average_daily_usage": 9.5,
}


def test_operations_get_endpoints():
    endpoints = [
        "/api/health",
        "/api/inventory",
        "/api/inventory/O%2B",
        "/api/analytics",
        "/api/analytics/demand",
        "/api/analytics/shortage",
        "/api/models/comparison",
        "/api/models/performance",
        "/api/alerts",
        "/api/export/inventory",
        "/api/export/predictions",
        "/api/export/analytics",
        "/api/export/models",
    ]
    for endpoint in endpoints:
        response = client.get(endpoint)
        assert response.status_code == 200, endpoint


def test_inventory_validation_and_update():
    invalid = client.post("/api/inventory", json={"blood_group": "invalid", **VALID_INVENTORY})
    assert invalid.status_code == 422

    current = client.get("/api/inventory/O%2B").json()
    response = client.put(
        "/api/inventory/O%2B",
        json={
            "current_blood_stock": current["current_blood_stock"],
            "incoming_blood_units": current["incoming_blood_units"],
            "average_daily_usage": current["average_daily_usage"],
        },
    )
    assert response.status_code == 200
    assert response.json()["blood_group"] == "O+"


def test_alert_generation_endpoint():
    response = client.post("/api/alerts/generate")
    assert response.status_code == 200
    assert "alerts" in response.json()
