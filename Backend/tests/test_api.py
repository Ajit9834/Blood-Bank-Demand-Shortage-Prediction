from fastapi.testclient import TestClient

from api.main import app


client = TestClient(app)


def test_health():
    response = client.get("/health")

    assert response.status_code == 200

    data = response.json()

    assert data["status"] == "healthy"


def test_prediction():
    test_input = {
        "blood_group": "O+",
        "month": 10,
        "day_of_week": 4,
        "season": "Autumn",
        "current_blood_stock": 60,
        "previous_demand": 78,
        "average_daily_usage": 11.2,
        "number_of_donations": 8,
        "incoming_blood_units": 10,
        "hospital_requests": 18,
        "emergency_cases": 3,
        "previous_week_demand": 80,
        "previous_month_demand": 76,
        "days_of_stock_remaining": 5.4,
    }

    response = client.post("/predict", json=test_input)

    assert response.status_code == 200

    data = response.json()

    assert "predicted_demand" in data
    assert "shortage_risk" in data
    assert isinstance(data["predicted_demand"], float)
    assert data["shortage_risk"] in ["High", "Medium", "Low"]