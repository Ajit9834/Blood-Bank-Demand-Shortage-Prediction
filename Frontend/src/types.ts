export type RiskLevel = "Low" | "Medium" | "High";

export type PageKey =
  | "dashboard"
  | "demand"
  | "shortage"
  | "inventory"
  | "analytics"
  | "models"
  | "about";

export type BloodGroup = "O+" | "O-" | "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-";

export type Season = "Winter" | "Spring" | "Summer" | "Monsoon";

export interface PredictionRequest {
  blood_group: BloodGroup;
  month: number;
  day_of_week: number;
  season: Season;
  current_blood_stock: number;
  previous_demand: number;
  average_daily_usage: number;
  number_of_donations: number;
  incoming_blood_units: number;
  hospital_requests: number;
  emergency_cases: number;
  previous_week_demand: number;
  previous_month_demand: number;
  days_of_stock_remaining: number;
}

export interface PredictionResponse {
  predicted_demand: number;
  shortage_risk: RiskLevel;
}

export interface ApiInventoryRecord {
  blood_group: BloodGroup;
  current_blood_stock: number;
  incoming_blood_units: number;
  average_daily_usage: number;
  available_units: number;
  projected_demand: number;
  days_of_stock_remaining: number;
  shortage_risk: RiskLevel;
  stock_change: number;
  updated_at: string;
}

export interface ApiAnalytics {
  start_date: string | null;
  end_date: string | null;
  demand_trend: { label: string; demand: number }[];
  stock_trend: { label: string; stock: number; demand: number }[];
  demand_by_group: { group: BloodGroup; demand: number }[];
  shortage_trend: { label: string; low: number; medium: number; high: number }[];
}

export interface ApiModelComparison {
  demand_models: DemandModelMetric[];
  shortage_models: ClassificationModelMetric[];
  evaluated_at: string;
}

export interface ApiAlert {
  id: string;
  blood_group: BloodGroup;
  alert_type: "low_stock" | "high_shortage_risk" | "demand_gap" | "critical_shortage";
  severity: "warning" | "critical";
  message: string;
  created_at: string;
}

export interface InventoryItem {
  group: BloodGroup;
  stock: number;
  dailyUsage: number;
  incoming: number;
  demand: number;
  coverage: number;
  risk: RiskLevel;
  change: number;
}

export interface DemandPoint {
  label: string;
  demand: number;
  baseline?: number;
}

export interface StockTrendPoint {
  label: string;
  stock: number;
  demand: number;
}

export interface ForecastResult {
  group: BloodGroup;
  demand: number;
  period: string;
  dailyAverage: number;
  model: string;
  confidence: number;
  forecast: DemandPoint[];
}

export interface RiskResult {
  group: BloodGroup;
  risk: RiskLevel;
  stock: number;
  demand: number;
  gap: number;
  coverage: number;
  message: string;
}

export interface DemandModelMetric {
  model: string;
  mae: number;
  rmse: number;
  r2: number;
}

export interface ClassificationModelMetric {
  model: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
}