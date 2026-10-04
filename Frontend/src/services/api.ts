import type { ApiAlert, ApiAnalytics, ApiInventoryRecord, ApiModelComparison, AuthSession, ForecastResult, PredictionRequest, PredictionResponse, RiskResult } from "../types";
import { apiClient, apiRoutes } from "./apiClient";

export { apiClient, apiRoutes };

const AUTH_SESSION_KEY = "bloodsight.auth.session";

export function getStoredAuthSession(): AuthSession | null {
  const stored = sessionStorage.getItem(AUTH_SESSION_KEY);
  if (!stored) return null;
  try {
    const session = JSON.parse(stored) as AuthSession;
    if (!session.access_token || !Number.isFinite(session.expires_at) || session.expires_at <= Date.now()) {
      sessionStorage.removeItem(AUTH_SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    return null;
  }
}

function storeAuthSession(session: Omit<AuthSession, "expires_at">): AuthSession {
  const storedSession: AuthSession = {
    ...session,
    expires_at: Date.now() + session.expires_in * 1000,
  };
  sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(storedSession));
  return storedSession;
}

export function clearAuthSession(): void {
  sessionStorage.removeItem(AUTH_SESSION_KEY);
}

export async function loginAccount(email: string, password: string): Promise<AuthSession> {
  const { data } = await apiClient.post<AuthSession>(apiRoutes.authLogin, { email, password });
  return storeAuthSession(data);
}

export async function registerAccount(email: string, password: string): Promise<AuthSession> {
  const { data } = await apiClient.post<AuthSession>(apiRoutes.authRegister, { email, password });
  return storeAuthSession(data);
}

export async function logoutAccount(accessToken: string): Promise<void> {
  await apiClient.post(apiRoutes.authLogout, undefined, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function requestPasswordReset(email: string): Promise<void> {
  await apiClient.post(apiRoutes.authForgotPassword, { email });
}

export async function resetAccountPassword(token: string, password: string): Promise<void> {
  await apiClient.post(apiRoutes.authResetPassword, { token, password });
}

function normalizePredictionRequest(request: PredictionRequest): PredictionRequest {
  const finite = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback;
  const boundedInteger = (value: number, minimum: number, maximum: number, fallback: number) => Math.min(maximum, Math.max(minimum, Math.trunc(finite(value, fallback))));
  return {
    ...request,
    month: boundedInteger(request.month, 1, 12, 1),
    day_of_week: boundedInteger(request.day_of_week, 0, 6, 0),
    days_of_stock_remaining: Math.max(0, finite(request.days_of_stock_remaining, 0)),
    previous_demand: Math.max(0, Math.trunc(request.previous_demand)),
    average_daily_usage: Math.max(0, request.average_daily_usage),
    number_of_donations: Math.max(0, Math.trunc(request.number_of_donations)),
    incoming_blood_units: Math.max(0, Math.trunc(request.incoming_blood_units)),
    current_blood_stock: Math.max(0, Math.trunc(request.current_blood_stock)),
    hospital_requests: Math.max(0, Math.trunc(request.hospital_requests)),
    emergency_cases: Math.max(0, Math.trunc(request.emergency_cases)),
    previous_week_demand: Math.max(0, Math.trunc(request.previous_week_demand)),
    previous_month_demand: Math.max(0, Math.trunc(request.previous_month_demand)),
  };
}

export async function predictDemand(request: PredictionRequest, period: string): Promise<ForecastResult> {
  const payload = normalizePredictionRequest(request);
  const { data } = await apiClient.post<PredictionResponse>(apiRoutes.predict, payload);
  const days = Number(period.match(/\d+/)?.[0] ?? 7);
  return {
    group: request.blood_group,
    demand: data.predicted_demand,
    period,
    dailyAverage: Number((data.predicted_demand / days).toFixed(2)),
    model: "XGBoost",
    confidence: 0,
    forecast: [{ label: period, demand: data.predicted_demand }],
  };
}

export async function predictShortage(request: PredictionRequest): Promise<RiskResult> {
  const payload = normalizePredictionRequest(request);
  const { data } = await apiClient.post<PredictionResponse>(apiRoutes.predict, payload);
  const gap = Math.max(0, Math.round(data.predicted_demand - payload.current_blood_stock));
  return {
    group: request.blood_group,
    risk: data.shortage_risk,
    stock: payload.current_blood_stock,
    demand: data.predicted_demand,
    gap,
    coverage: Number(request.days_of_stock_remaining.toFixed(2)),
    message: data.shortage_risk === "High"
      ? "Current projected stock may be insufficient to meet expected demand."
      : "Current projected stock is expected to cover demand at the selected risk level.",
  };
}

export async function getInventory(): Promise<ApiInventoryRecord[]> {
  const { data } = await apiClient.get<{ items: ApiInventoryRecord[] }>(apiRoutes.inventory);
  return data.items;
}

export async function getAnalytics(startDate?: string, endDate?: string): Promise<ApiAnalytics> {
  const { data } = await apiClient.get<ApiAnalytics>(apiRoutes.analytics, { params: { start_date: startDate || undefined, end_date: endDate || undefined } });
  return data;
}

export async function getModelComparison(): Promise<ApiModelComparison> {
  const { data } = await apiClient.get<ApiModelComparison>(apiRoutes.modelComparison);
  return data;
}

export async function getAlerts(): Promise<ApiAlert[]> {
  const { data } = await apiClient.get<{ alerts: ApiAlert[] }>(apiRoutes.alerts);
  return data.alerts;
}

export async function downloadCsv(route: string, filename: string): Promise<void> {
  const response = await apiClient.get(route, { responseType: "blob" });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}