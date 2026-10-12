# 🩸 Blood Bank Demand & Shortage Prediction System (BloodSight)

[![FastAPI](https://img.shields.io/badge/FastAPI-0.142.2-009688.svg?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB.svg?style=flat&logo=python&logoColor=white)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-19.2.6-61DAFB.svg?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-3178C6.svg?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-7.3.2-646CFF.svg?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC.svg?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![XGBoost](https://img.shields.io/badge/XGBoost-3.2.0-FF6600.svg?style=flat)](https://xgboost.readthedocs.io/)
[![scikit-learn](https://img.shields.io/badge/scikit--learn-1.9.1-F7931E.svg?style=flat&logo=scikit-learn&logoColor=white)](https://scikit-learn.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Ready-4169E1.svg?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An end-to-end, machine learning-driven clinical decision support and inventory management platform for blood banks and hospital networks. The system forecasts blood unit demand and assesses stockout shortage risks in real time, helping healthcare providers minimize transfusion delays and prevent biological inventory spoilage.

---

## 🔗 Live Deployments & Demo

- **Frontend Dashboard:** [https://bloodbankdemandshortageprediction.vercel.app](https://bloodbankdemandshortageprediction.vercel.app)
- **Backend API Docs (Swagger UI):** [https://blood-bank-demand-shortage-prediction-1.onrender.com/docs](https://blood-bank-demand-shortage-prediction-1.onrender.com/docs)
- **GitHub Repository:** [https://github.com/Ajit9834/Blood-Bank-Demand-Shortage-Prediction](https://github.com/Ajit9834/Blood-Bank-Demand-Shortage-Prediction)

---

## 📌 Table of Contents

- [Problem Statement](#-problem-statement)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Machine Learning Pipelines & Benchmarks](#-machine-learning-pipelines--benchmarks)
- [Tech Stack](#-tech-stack)
- [Repository Structure](#-repository-structure)
- [API Reference](#-api-reference)
- [Local Development Setup](#-local-development-setup)
- [Configuration & Environment Variables](#-configuration--environment-variables)
- [Deployment Guide](#-deployment-guide)
- [Testing](#-testing)
- [License](#-license)

---

## 🩺 Problem Statement

Blood inventory is perishable (red blood cells last approximately 35–42 days, platelets only 5 days) and demand fluctuates heavily due to:
- **Seasonal health patterns & epidemics** (monsoon dengue spikes, winter viral illnesses).
- **Emergency admissions & trauma surges**.
- **Uneven ABO/Rh blood group distributions** across the general population.

Traditional rule-of-thumb restocking leads to two catastrophic extremes:
1. **Critical Stockouts:** Transfusions delayed, jeopardizing patient survival during surgeries or trauma.
2. **Excess Wastage:** High procurement costs and wasted donor blood expiring on hospital shelves.

**BloodSight** solves this dilemma by framing inventory optimization as a dual ML problem:
- **Demand Forecasting (Regression):** Predicts precise units needed based on clinical, temporal, and historical trends.
- **Shortage Stratification (Multi-class Classification):** Classifies immediate stockout risk into **Low**, **Medium**, or **High** risk levels to trigger targeted restocking and donor recruitment.

---

## ✨ Key Features

### 1. 🔮 Interactive Live Prediction Engine
- Dual ML inference: single API request predicts **exact unit demand** and **tri-class shortage risk** (`Low`, `Medium`, `High`).
- Parameter adjustments for 14 operational features, including blood group, season, day of week, previous-day/week/month demand lags, incoming units, emergency admissions, and current stock.

### 2. 📦 Real-Time Blood Inventory Management
- Per-blood-group stock tracking (`A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`).
- Automated calculation of **days of stock remaining** and projected coverage.
- RESTful operations to view, create, and update stock units with change audit logs.

### 3. 📊 Visual Analytics & Operational Insights
- Interactive charts built with **Recharts**:
  - Longitudinal demand trends over time.
  - Stock levels vs. forecasted demand gap analysis.
  - Blood group consumption share breakdowns.
  - Temporal shortage risk distributions.
- Date range filtering (`start_date`, `end_date`).

### 4. 🚨 Automated Early Warning Alerts
- Heuristic and model-driven alert triggers:
  - `low_stock`: Units fall below minimum safety reserve.
  - `high_shortage_risk`: Model predicts imminent stock depletion.
  - `demand_gap`: Forecasted hospital requests exceed available units.
  - `critical_shortage`: Extreme zero-stock or emergency deficit.
- Categorized severity tiers: `warning` and `critical`.

### 5. 🔬 ML Benchmark & Model Comparison Hub
- Live side-by-side benchmark evaluation on chronological hold-out test splits.
- Real evaluation metrics:
  - **Regression:** MAE, RMSE, and $R^2$ score comparison for Linear Regression, Random Forest, and XGBoost.
  - **Classification:** Accuracy, Precision, Recall, F1-Score, and interactive **Confusion Matrices** for Logistic Regression, Random Forest, and XGBoost.

### 6. 🔐 Authentication & Session Security
- User registration and login with salt-hashed passwords (`scrypt`).
- Token-based bearer authentication and session revocation.
- Secure password recovery pipeline via transactional emails powered by the **Resend API**.
- Managed PostgreSQL integration with graceful fallback mode.

### 7. 📥 CSV Data Exporting
- Real-time CSV streaming downloads for:
  - Current inventory records.
  - Historical prediction logs.
  - Aggregated operational analytics.
  - Model evaluation comparison benchmarks.

---

## 🏗 System Architecture

```mermaid
flowchart TD
    subgraph Client["Client Tier (Vercel)"]
        UI["React 19 + TypeScript Dashboard\n(Vite + TailwindCSS + Recharts)"]
    end

    subgraph Gateway["Routing & Gateway"]
        Proxy["Vercel Reverse Proxy\n(/api/* rewrites)"]
    end

    subgraph Server["Application Tier (Render)"]
        API["FastAPI Application\n(Uvicorn ASGI Engine)"]
        AuthModule["Authentication & Security\n(scrypt + Bearer Tokens)"]
        OpsModule["Operations & Analytics Service\n(Inventory, Alerts, CSV Streams)"]
        PredictModule["Prediction Engine Service\n(Multi-factor Feature Engineering)"]
    end

    subgraph ML["Machine Learning Pipeline"]
        DemandModel["Best Demand Model\n(Linear Regression / XGBoost / RF)"]
        ShortageModel["Best Shortage Model\n(Logistic Regression / XGBoost / RF)"]
        Encoder["Label Encoders & Preprocessors\n(scikit-learn ColumnTransformer)"]
    end

    subgraph Data["Persistence & Services"]
        PG[(PostgreSQL Database\nUsers & Sessions)]
        JSONFile[(Inventory Store\nJSON / Raw CSV)]
        Resend["Resend Email Service\n(Password Reset Delivery)"]
    end

    UI -->|HTTPS / REST| Proxy
    Proxy -->|CORS Authorized| API
    API --> AuthModule
    API --> OpsModule
    API --> PredictModule

    AuthModule --> PG
    AuthModule --> Resend
    OpsModule --> JSONFile
    PredictModule --> DemandModel
    PredictModule --> ShortageModel
    PredictModule --> Encoder
```

---

## 🧠 Machine Learning Pipelines & Benchmarks

The models were evaluated on chronological hold-out test splits ($N = 3,000$ test records out of 15,000 historical clinical samples) to prevent temporal data leakage.

### 1. Blood Demand Forecasting (Regression)

Predicts the continuous number of blood units requested across clinical departments.

| Algorithm | Mean Absolute Error (MAE) | Root Mean Squared Error (RMSE) | Coefficient of Determination ($R^2$) | Status |
| :--- | :---: | :---: | :---: | :---: |
| **Linear Regression** | **3.9823** | **5.0068** | **0.8763** | 🏆 **Best Model** |
| **XGBoost Regressor** | 4.1342 | 5.2063 | 0.8662 | Evaluated |
| **Random Forest Regressor** | 4.2234 | 5.3057 | 0.8611 | Evaluated |

### 2. Shortage Risk Classification (Multi-Class)

Predicts whether a blood bank faces **Low**, **Medium**, or **High** shortage risk.

| Algorithm | Accuracy | Precision | Recall | F1-Score | Status |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Logistic Regression** | **89.55%** | **89.51%** | **89.55%** | **0.8944** | 🏆 **Best Model** |
| **XGBoost Classifier** | 89.35% | 89.41% | 89.35% | 0.8937 | Evaluated |
| **Random Forest Classifier** | 87.85% | 87.86% | 87.85% | 0.8785 | Evaluated |

#### Feature Matrix (14 Dimensions):
- **Categorical:** `blood_group` (A+, A-, B+, B-, AB+, AB-, O+, O-), `season` (Winter, Spring, Summer, Monsoon).
- **Temporal & Clinical:** `month`, `day_of_week`, `emergency_cases`, `hospital_requests`, `number_of_donations`.
- **Inventory & Historical Lags:** `current_blood_stock`, `incoming_blood_units`, `average_daily_usage`, `days_of_stock_remaining`, `previous_demand`, `previous_week_demand`, `previous_month_demand`.

---

## 💻 Tech Stack

### Frontend
- **Framework:** React 19, TypeScript
- **Bundler:** Vite 7
- **Styling:** Tailwind CSS v4, Lucide React Icons
- **Data Visualization:** Recharts 3
- **Networking:** Axios with central API client routing

### Backend & ML
- **Framework:** FastAPI, Uvicorn (ASGI)
- **Validation:** Pydantic v2
- **Data Manipulation:** Pandas 3, NumPy 2
- **Machine Learning:** Scikit-Learn 1.9, XGBoost 3.2, Scipy 1.17, Joblib
- **Database Driver:** `psycopg` (PostgreSQL)
- **Email Service:** Resend API client
- **Testing:** Pytest, HTTPX

---

## 📁 Repository Structure

```text
blood-bank-demand-shortage-prediction/
├── Backend/
│   ├── api/
│   │   ├── routes/
│   │   │   ├── auth.py              # Login, register, logout, password recovery
│   │   │   ├── health.py            # System healthcheck endpoint
│   │   │   ├── operations.py        # Inventory, analytics, alerts, CSV exports
│   │   │   └── prediction.py        # Single & batched prediction endpoint
│   │   ├── schemas/
│   │   │   ├── auth.py              # Auth request & response schemas
│   │   │   ├── operations.py        # Inventory, analytics, alert schemas
│   │   │   └── prediction.py        # Prediction request & response schemas
│   │   ├── db.py                    # PostgreSQL connection & table migrations
│   │   ├── dependencies.py          # Bearer auth dependency injection
│   │   ├── mail_service.py          # Resend transactional email integration
│   │   ├── main.py                  # FastAPI application entrypoint & middleware
│   │   ├── security.py              # Scrypt hashing and verification
│   │   └── settings.py              # Database & environment configuration
│   ├── data/
│   │   ├── processed/inventory.json # Persistent JSON inventory state
│   │   └── raw/blood_bank_data.csv  # Historical clinical records
│   ├── models/                      # Serialized ML models (.pkl) & metrics (.json)
│   ├── src/
│   │   ├── config.py                # Core configuration & path resolvers
│   │   ├── data/
│   │   │   ├── generate_dataset.py  # Clinical dataset generator
│   │   │   └── preprocessing.py     # Feature engineering & transformers
│   │   ├── models/
│   │   │   ├── demand_model.py      # Demand regression training pipeline
│   │   │   ├── model_loader.py      # Model deserialization & caching
│   │   │   └── shortage_model.py    # Shortage classification training pipeline
│   │   └── services/
│   │       ├── alert_service.py     # Early warning generation
│   │       ├── analytics_service.py # Aggregated metrics & chart data
│   │       ├── export_service.py    # In-memory CSV streaming
│   │       ├── inventory_service.py # Inventory read/write business logic
│   │       ├── model_performance_service.py # Model evaluation & confusion matrices
│   │       └── prediction_service.py  # Inference coordinator
│   ├── tests/                       # Unit & integration test suites
│   ├── main.py                      # Root alias for Uvicorn
│   └── requirements.txt             # Python dependencies
├── Frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AuthPage.tsx         # Login & Registration modal/page
│   │   │   ├── AuthShell.tsx        # Protected auth wrapper
│   │   │   ├── LiveOperationsPages.tsx # Inventory, Analytics, Models, Alerts
│   │   │   ├── LivePredictionPage.tsx  # Dynamic inference form & results
│   │   │   ├── PasswordRecoveryPage.tsx# Reset token entry & submission
│   │   │   └── ui.tsx               # Reusable UI component library
│   │   ├── services/
│   │   │   ├── api.ts               # Typed service client methods
│   │   │   └── apiClient.ts         # Axios instance & route mapping
│   │   ├── types.ts                 # TypeScript interfaces and types
│   │   ├── App.tsx                  # Main layout, tabs & view router
│   │   └── index.css                # Tailwind CSS v4 styling rules
│   ├── package.json                 # Frontend dependencies & scripts
│   ├── vite.config.ts               # Vite configuration
│   └── vercel.json                  # Production rewrite rules & security headers
├── render.yaml                      # Render Blueprint deployment definition
└── README.md                        # Master project documentation
```

---

## 📡 API Reference

Interactive OpenAPI documentation is available locally at `http://localhost:8000/docs` or on Render at `https://blood-bank-demand-shortage-prediction-1.onrender.com/docs`.

### Primary Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Healthcheck and service uptime status |
| `POST` | `/api/predict` | Predict blood demand (units) and shortage risk (`Low`/`Med`/`High`) |
| `GET` | `/api/inventory` | List current inventory for all 8 blood groups |
| `GET` | `/api/inventory/{blood_group}` | Retrieve inventory details for a specific blood group |
| `POST` | `/api/inventory` | Add initial inventory record for a blood group |
| `PUT` | `/api/inventory/{blood_group}` | Update stock, usage, or incoming units |
| `GET` | `/api/analytics` | Get trend curves, stock vs. demand, and shortage distributions |
| `GET` | `/api/models/comparison` | Live evaluation metrics and confusion matrices across models |
| `GET` | `/api/alerts` | List active inventory and demand gap alerts |
| `POST` | `/api/alerts/generate` | Trigger alert re-evaluation |
| `GET` | `/api/export/inventory` | Stream inventory data as CSV |
| `GET` | `/api/export/predictions` | Stream prediction history as CSV |
| `GET` | `/api/export/analytics` | Stream analytics aggregations as CSV |
| `GET` | `/api/export/models` | Stream model evaluation benchmarks as CSV |
| `POST` | `/api/auth/register` | Register a new user account |
| `POST` | `/api/auth/login` | Authenticate user and issue session token |
| `POST` | `/api/auth/forgot-password` | Request password reset token via email |
| `POST` | `/api/auth/reset-password` | Submit new password with reset token |
| `POST` | `/api/auth/logout` | Invalidate active session token |

### Sample Prediction Request & Response

**Endpoint:** `POST /api/predict`

```json
{
  "blood_group": "O+",
  "month": 7,
  "day_of_week": 2,
  "season": "Monsoon",
  "current_blood_stock": 45,
  "previous_demand": 50,
  "average_daily_usage": 12.5,
  "number_of_donations": 10,
  "incoming_blood_units": 8,
  "hospital_requests": 55,
  "emergency_cases": 6,
  "previous_week_demand": 85,
  "previous_month_demand": 360,
  "days_of_stock_remaining": 3.6
}
```

**Response (`200 OK`):**

```json
{
  "predicted_demand": 53.4,
  "shortage_risk": "High"
}
```

---

## 🚀 Local Development Setup

### Prerequisites
- **Python 3.10+** (Python 3.11 or 3.12 recommended)
- **Node.js 18+** & **npm**
- **Git**
- *(Optional)* **PostgreSQL** instance (required for persistent authentication)

---

### Step 1: Clone the Repository

```bash
git clone https://github.com/Ajit9834/Blood-Bank-Demand-Shortage-Prediction.git
cd Blood-Bank-Demand-Shortage-Prediction
```

---

### Step 2: Backend Setup

1. Navigate to the `Backend` directory:
   ```bash
   cd Backend
   ```

2. Create and activate a Python virtual environment:
   ```bash
   # Windows (PowerShell)
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1

   # macOS / Linux
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. Install backend dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Create a `.env` file in `Backend/.env`:
   ```env
   # PostgreSQL Connection (optional for local mock testing)
   DATABASE_URL=postgresql://postgres:password@localhost:5432/bloodbank

   # Allowed CORS origins (comma-separated)
   CORS_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:3000

   # Resend Email Configuration (Optional - for password recovery)
   RESEND_API_KEY=re_your_api_key_here
   RESEND_FROM_EMAIL=noreply@yourdomain.com
   FRONTEND_URL=http://localhost:5173/
   ```

5. Start the FastAPI development server:
   ```bash
   uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
   ```
   The backend API will be available at `http://localhost:8000`. Swagger documentation will be at `http://localhost:8000/docs`.

---

### Step 3: Frontend Setup

1. In a new terminal, navigate to the `Frontend` directory:
   ```bash
   cd Frontend
   ```

2. Install npm dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables in `Frontend/.env`:
   ```env
   VITE_API_BASE_URL=http://localhost:8000/api
   ```

4. Start the Vite development server:
   ```bash
   npm run dev
   ```
   Open your browser at `http://localhost:5173`.

---

## ⚙️ Configuration & Environment Variables

### Backend (`Backend/.env`)

| Variable | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `DATABASE_URL` | No | *None* | PostgreSQL connection string (`postgresql://user:pass@host:port/db`). If omitted, database auth features will be disabled. |
| `CORS_ORIGINS` | No | `http://localhost:5173,...` | Comma-separated list of permitted origins. |
| `SESSION_TTL_HOURS` | No | `168` (7 days) | Active user session token lifetime in hours. |
| `PASSWORD_RESET_TTL_MINUTES` | No | `60` (1 hour) | Password reset token expiration window. |
| `RESEND_API_KEY` | No | *Empty* | API token for Resend transactional email delivery. |
| `RESEND_FROM_EMAIL` | No | *Empty* | Verified sender email address for password reset links. |
| `FRONTEND_URL` | No | `http://localhost:5173/` | Base URL used to build password reset email links. |
| `BLOOD_BANK_DATA_PATH` | No | `Backend/data/raw/blood_bank_data.csv` | Path to historical dataset. |
| `INVENTORY_PATH` | No | `Backend/data/processed/inventory.json` | Path to persistent inventory store. |

### Frontend (`Frontend/.env`)

| Variable | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `VITE_API_BASE_URL` | No | `/api` | Base URL of the backend API service. Set to `http://localhost:8000/api` for local development. |

---

## 🚢 Deployment Guide

### Deploying the Backend to Render

This repository includes a `render.yaml` configuration file for automatic deployment:

1. Push your repository to GitHub.
2. Log in to [Render](https://render.com) and create a new **Blueprint Instance** pointing to your repository.
3. Render automatically reads `render.yaml` to configure:
   - **Build Command:** `pip install -r Backend/requirements.txt`
   - **Start Command:** `cd Backend && uvicorn api.main:app --host 0.0.0.0 --port $PORT`
4. Set your production environment variables in the Render dashboard:
   - `CORS_ORIGINS`: `https://bloodbankdemandshortageprediction.vercel.app`
   - `DATABASE_URL`: Your managed PostgreSQL connection URL.
   - `RESEND_API_KEY` and `RESEND_FROM_EMAIL` (if utilizing email features).

### Deploying the Frontend to Vercel

1. Import the repository into [Vercel](https://vercel.com).
2. Set the **Root Directory** to `Frontend`.
3. Set the **Framework Preset** to `Vite`.
4. Add environment variables:
   - `VITE_API_BASE_URL`: `/api`
5. Vercel uses `Frontend/vercel.json` to proxy `/api/*` traffic directly to your backend instance on Render while injecting modern security headers (`HSTS`, `X-Frame-Options`, `X-Content-Type-Options`).

---

## 🧪 Testing

Run backend unit and integration test suites using `pytest`:

```bash
cd Backend
pytest -v
```

The test suite covers:
- Core API health and prediction endpoints (`tests/test_api.py`).
- Inventory management, analytics, and CSV streaming (`tests/test_operations.py`).
- User registration, authentication, sessions, and password recovery workflows (`tests/test_auth.py`).

---

## 🤝 Contributing

Contributions, feature suggestions, and bug reports are welcome!

1. Fork the Project: `git checkout -b feature/AmazingFeature`
2. Commit your Changes: `git commit -m "Add AmazingFeature"`
3. Push to the Branch: `git push origin feature/AmazingFeature`
4. Open a Pull Request.

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.

---

## 👨‍💻 Author

**Ajit**  
- GitHub: [@Ajit9834](https://github.com/Ajit9834)  
- Repository: [Blood-Bank-Demand-Shortage-Prediction](https://github.com/Ajit9834/Blood-Bank-Demand-Shortage-Prediction)
