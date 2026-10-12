# Blood Bank Prediction Backend

FastAPI services for blood inventory, demand prediction, shortage risk, analytics, model evaluation, alerts, and CSV export.

## Setup

```powershell
cd Backend
py -3.14 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Start the API from the `Backend` directory:

```powershell
.\.venv\Scripts\python.exe -m uvicorn api.main:app --reload
```

Swagger documentation is available at `http://localhost:8000/docs`.

Runtime paths and CORS can be overridden with environment variables:

```text
BLOOD_BANK_DATA_PATH
INVENTORY_PATH
DEMAND_MODEL_PATH
SHORTAGE_MODEL_PATH
LABEL_ENCODER_PATH
CORS_ORIGINS        # comma-separated origins
```

## API

Prediction and health are available at both their legacy root paths and `/api` paths. Operations use the `/api` prefix:

```text
GET  /api/health
POST /api/predict
GET  /api/inventory
GET  /api/inventory/{blood_group}
POST /api/inventory
PUT  /api/inventory/{blood_group}
GET  /api/analytics
GET  /api/analytics/demand
GET  /api/analytics/shortage
GET  /api/models/comparison
GET  /api/models/performance
GET  /api/alerts
POST /api/alerts/generate
GET  /api/export/inventory
GET  /api/export/predictions
GET  /api/export/analytics
GET  /api/export/models
```

Inventory is persisted in `data/processed/inventory.json` and initialized from the actual raw dataset. Analytics and exports are derived from `data/raw/blood_bank_data.csv`. Model performance evaluates the chronological test split using the stored XGBoost artifacts plus newly evaluated comparison models.

Run backend tests with:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```
