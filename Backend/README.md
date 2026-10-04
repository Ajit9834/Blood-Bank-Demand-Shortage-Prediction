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

Set `DATABASE_URL` to a PostgreSQL connection URL in the environment or in
`Backend/.env` to enable account registration, login, and logout. The account
and session tables are created at startup. `SESSION_TTL_HOURS` optionally sets
the session lifetime (default: 168 hours). Without `DATABASE_URL`, the existing
dashboard API still starts, but authentication endpoints require PostgreSQL.

Runtime paths, CORS, and database settings can be overridden with environment variables:

```text
BLOOD_BANK_DATA_PATH
INVENTORY_PATH
DEMAND_MODEL_PATH
SHORTAGE_MODEL_PATH
LABEL_ENCODER_PATH
CORS_ORIGINS        # comma-separated origins
DATABASE_URL        # PostgreSQL connection URL; required for authentication
SESSION_TTL_HOURS   # bearer session lifetime in hours (default: 168)
RESEND_API_KEY      # Resend API key; keep private in Backend/.env
RESEND_FROM_EMAIL   # verified sender address configured in Resend
FRONTEND_URL        # frontend reset page URL (local default: http://localhost:5173/)
PASSWORD_RESET_TTL_MINUTES # reset link lifetime (default: 60)
```

## API

Prediction and health are available at both their legacy root paths and `/api` paths. Operations use the `/api` prefix:

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/forgot-password
POST /api/auth/reset-password
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

Registration requires an email and a password of at least 4 characters, and
returns a bearer token. Send that token in the `Authorization` header when
logging out. Forgot-password responses do not reveal whether an email exists;
reset links are single-use and expire after the configured interval. Set a
Resend API key and verified sender in `Backend/.env` to deliver reset emails. PostgreSQL stores
account, session, and reset-token data; prediction, inventory, and analytics
behavior is unchanged.

Run backend tests with:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```
