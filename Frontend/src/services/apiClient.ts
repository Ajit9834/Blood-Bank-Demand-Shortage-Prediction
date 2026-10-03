import axios from "axios";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "https://blood-bank-demand-shortage-prediction-1.onrender.com",
  headers: {
    "Content-Type": "application/json",
  },
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