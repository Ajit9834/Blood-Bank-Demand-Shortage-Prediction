import axios from "axios";

// One client keeps the future FastAPI base URL out of presentation components.
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000",
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
});

export const apiRoutes = {
  predict: "/api/predict",
  inventory: "/api/inventory",
  analytics: "/api/analytics",
  demandAnalytics: "/api/analytics/demand",
  shortageAnalytics: "/api/analytics/shortage",
  modelComparison: "/api/models/comparison",
  alerts: "/api/alerts",
  generateAlerts: "/api/alerts/generate",
  exportInventory: "/api/export/inventory",
  exportPredictions: "/api/export/predictions",
  exportAnalytics: "/api/export/analytics",
  exportModels: "/api/export/models",
} as const;