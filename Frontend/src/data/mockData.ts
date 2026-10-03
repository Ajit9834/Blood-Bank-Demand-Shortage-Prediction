import type {
  BloodGroup,
  ClassificationModelMetric,
  DemandModelMetric,
  DemandPoint,
  InventoryItem,
  StockTrendPoint,
} from "../types";

export const bloodGroups: BloodGroup[] = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];

export const inventory: InventoryItem[] = [
  { group: "O+", stock: 80, dailyUsage: 9, incoming: 20, demand: 65, coverage: 8, risk: "Low", change: 12 },
  { group: "O-", stock: 15, dailyUsage: 5, incoming: 3, demand: 28, coverage: 3, risk: "High", change: -18 },
  { group: "A+", stock: 42, dailyUsage: 6, incoming: 10, demand: 39, coverage: 7, risk: "Medium", change: 4 },
  { group: "A-", stock: 18, dailyUsage: 4, incoming: 8, demand: 25, coverage: 4, risk: "High", change: -9 },
  { group: "B+", stock: 60, dailyUsage: 7, incoming: 15, demand: 45, coverage: 9, risk: "Low", change: 8 },
  { group: "B-", stock: 25, dailyUsage: 4, incoming: 7, demand: 22, coverage: 6, risk: "Medium", change: -3 },
  { group: "AB+", stock: 30, dailyUsage: 3, incoming: 5, demand: 20, coverage: 10, risk: "Low", change: 6 },
  { group: "AB-", stock: 12, dailyUsage: 2, incoming: 2, demand: 14, coverage: 5, risk: "High", change: -11 },
];

export const demandForecast: DemandPoint[] = [
  { label: "Mon 12", demand: 21, baseline: 24 },
  { label: "Tue 13", demand: 25, baseline: 24 },
  { label: "Wed 14", demand: 22, baseline: 25 },
  { label: "Thu 15", demand: 29, baseline: 26 },
  { label: "Fri 16", demand: 27, baseline: 27 },
  { label: "Sat 17", demand: 31, baseline: 28 },
  { label: "Sun 18", demand: 25, baseline: 29 },
  { label: "Mon 19", demand: 33, baseline: 30 },
  { label: "Tue 20", demand: 30, baseline: 30 },
  { label: "Wed 21", demand: 36, baseline: 31 },
  { label: "Thu 22", demand: 34, baseline: 32 },
  { label: "Fri 23", demand: 38, baseline: 33 },
];

export const stockTrend: StockTrendPoint[] = [
  { label: "Mon 12", stock: 318, demand: 301 },
  { label: "Tue 13", stock: 326, demand: 309 },
  { label: "Wed 14", stock: 317, demand: 312 },
  { label: "Thu 15", stock: 329, demand: 318 },
  { label: "Fri 16", stock: 321, demand: 326 },
  { label: "Sat 17", stock: 337, demand: 332 },
  { label: "Sun 18", stock: 330, demand: 321 },
  { label: "Mon 19", stock: 342, demand: 339 },
  { label: "Tue 20", stock: 335, demand: 346 },
  { label: "Wed 21", stock: 350, demand: 351 },
  { label: "Thu 22", stock: 344, demand: 359 },
  { label: "Fri 23", stock: 362, demand: 367 },
];

export const demandMix = inventory.map((item) => ({ group: item.group, demand: item.demand }));

export const demandModels: DemandModelMetric[] = [
  { model: "Linear Regression", mae: 5.2, rmse: 7.1, r2: 0.78 },
  { model: "Random Forest", mae: 3.8, rmse: 5.4, r2: 0.87 },
  { model: "XGBoost", mae: 3.1, rmse: 4.6, r2: 0.91 },
];

export const classificationModels: ClassificationModelMetric[] = [
  { model: "Random Forest", accuracy: 89, precision: 87, recall: 88, f1: 87 },
  { model: "XGBoost", accuracy: 93, precision: 92, recall: 91, f1: 91 },
];

export const defaultForecast: DemandPoint[] = [
  { label: "Day 1", demand: 5 },
  { label: "Day 2", demand: 7 },
  { label: "Day 3", demand: 6 },
  { label: "Day 4", demand: 8 },
  { label: "Day 5", demand: 7 },
  { label: "Day 6", demand: 6 },
  { label: "Day 7", demand: 6 },
];