import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Bell, CalendarDays, Download, LoaderCircle, RefreshCw } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ApiInventoryRecord, PageKey, RiskLevel } from "../types";
import { downloadCsv, getAlerts, getAnalytics, getInventory, getModelComparison, apiRoutes } from "../services/api";
import { EmptyState, Panel, RiskBadge, SectionHeading, StatusMessage } from "./ui";

const pageInfo: Record<PageKey, { title: string; description: string }> = {
  dashboard: { title: "Blood Bank ML Dashboard", description: "Live inventory, demand, and shortage risk" },
  demand: { title: "Blood Demand Prediction", description: "Predict expected blood requirements" },
  shortage: { title: "Shortage Risk Prediction", description: "Identify insufficient stock risk" },
  inventory: { title: "Blood Inventory Management", description: "Live units, usage, and availability" },
  analytics: { title: "Analytics", description: "Live demand, stock, and risk trends" },
  models: { title: "ML Model Performance", description: "Actual evaluation results from trained models" },
  about: { title: "About BloodSight", description: "Blood-bank decision support" },
  login: { title: "Sign in", description: "Access your BloodSight account" },
  register: { title: "Create account", description: "Register for BloodSight" },
  forgotPassword: { title: "Forgot password", description: "Request a secure password reset link" },
  resetPassword: { title: "Reset password", description: "Choose a new account password" },
  notFound: { title: "Page not found", description: "This page could not be found" },
};

const CACHE_TTL_MS = 15_000;
const queryCache = new Map<string, { value: unknown; expiresAt: number }>();
const queryRequests = new Map<string, Promise<unknown>>();

async function loadCached<T>(key: string, loader: () => Promise<T>, force = false): Promise<T> {
  const cached = queryCache.get(key);
  if (!force && cached && cached.expiresAt > Date.now()) return cached.value as T;
  const existing = queryRequests.get(key);
  if (existing) return existing as Promise<T>;
  const request = loader().then((value) => {
    queryCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    queryRequests.delete(key);
    return value;
  }).catch((error) => {
    queryRequests.delete(key);
    throw error;
  });
  queryRequests.set(key, request);
  return request;
}

function useRemoteData<T>(key: string, loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaderRef = useRef(loader);
  const requestId = useRef(0);
  loaderRef.current = loader;
  const reload = useCallback(async (force = true) => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const value = await loadCached(key, () => loaderRef.current(), force);
      if (currentRequest === requestId.current) setData(value);
    } catch (loadError) {
      if (currentRequest === requestId.current) setError(loadError instanceof Error ? loadError.message : "Unable to load backend data");
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [key]);
  useEffect(() => {
    void reload(false);
    return () => { requestId.current += 1; };
  }, [reload]);
  return { data, loading, error, reload };
}

function LoadState({ loading, error, empty, onRetry }: { loading: boolean; error: string | null; empty: boolean; onRetry: () => void }) {
  if (loading) return <div className="flex min-h-[180px] items-center justify-center"><LoaderCircle className="animate-spin text-[#2d6aca]" size={24} /></div>;
  if (error) return <div className="space-y-3"><StatusMessage type="error">{error}</StatusMessage><button onClick={onRetry} className="rounded-xl border border-[#dfe6ef] bg-white px-3 py-2 text-xs font-semibold text-[#52657e]">Retry</button></div>;
  if (empty) return <EmptyState title="No backend data" description="The API returned no records for this view." />;
  return null;
}

export function LiveTopNavbar({ page, onMenu, onToast }: { page: PageKey; onMenu: () => void; onToast: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  const alerts = useRemoteData("alerts", getAlerts);
  const info = pageInfo[page];
  return <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-[#e8edf3] bg-[#f6f8fb]/95 px-5 backdrop-blur-md sm:px-8 lg:px-10"><div className="flex min-w-0 items-center gap-3"><button aria-label="Open navigation" onClick={onMenu} className="rounded-xl border border-[#e0e7f0] bg-white p-2.5 text-[#51647e] shadow-sm lg:hidden">☰</button><div className="min-w-0"><p className="truncate text-[17px] font-bold text-[#12223b] sm:text-[19px]">{info.title}</p><p className="mt-0.5 hidden truncate text-xs text-[#8290a1] sm:block">{info.description}</p></div></div><div className="flex items-center gap-3"><div className="hidden items-center gap-2 text-xs font-medium text-[#718096] md:flex"><CalendarDays size={15} />{new Date().toLocaleDateString()}</div><div className="relative"><button aria-label="Notifications" onClick={() => setOpen((value) => !value)} className="relative rounded-xl border border-[#e0e7f0] bg-white p-2.5 text-[#52657e] shadow-sm"><Bell size={17} />{alerts.data?.length ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#e2515a]" /> : null}</button>{open ? <div className="absolute right-0 top-12 w-[320px] rounded-2xl border border-[#e4eaf2] bg-white p-4 shadow-[0_18px_45px_rgba(25,47,80,0.14)]"><div className="flex items-center justify-between"><p className="text-sm font-bold text-[#12223b]">Live alerts</p><span className="text-xs text-[#e2515a]">{alerts.data?.length ?? 0}</span></div><div className="mt-3 space-y-2">{alerts.loading ? <p className="text-xs text-[#8290a1]">Loading alerts...</p> : alerts.data?.length ? alerts.data.slice(0, 5).map((alert) => <button key={alert.id} onClick={() => { onToast(alert.message); setOpen(false); }} className="flex w-full gap-2 rounded-xl bg-[#fff8f8] p-3 text-left text-xs text-[#52657e]"><AlertTriangle size={15} className="shrink-0 text-[#e2515a]" />{alert.message}</button>) : <p className="text-xs text-[#8290a1]">No active alerts.</p>}</div></div> : null}</div></div></header>;
}

export function LiveDashboardPage({ onToast }: { onToast: (message: string) => void }) {
  const inventory = useRemoteData("inventory", getInventory);
  const alerts = useRemoteData("alerts", getAlerts);
  const metrics = useMemo(() => ({
    totalStock: inventory.data?.reduce((total, item) => total + item.current_blood_stock, 0) ?? 0,
    totalDemand: inventory.data?.reduce((total, item) => total + item.projected_demand, 0) ?? 0,
    highRisk: inventory.data?.filter((item) => item.shortage_risk === "High").length ?? 0,
  }), [inventory.data]);
  return <div className="page-enter space-y-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#e2515a]">Live operations</p><h1 className="mt-2 text-3xl font-bold text-[#12223b]">Blood bank overview</h1></div><button onClick={() => { void inventory.reload(); void alerts.reload(); onToast("Live data refreshed"); }} className="inline-flex items-center gap-2 rounded-xl border border-[#dfe6ef] bg-white px-3.5 py-2.5 text-xs font-semibold text-[#52657e]"><RefreshCw size={14} /> Refresh data</button></div><LoadState loading={inventory.loading} error={inventory.error} empty={!inventory.loading && !inventory.data?.length} onRetry={() => { void inventory.reload(); }} />{inventory.data?.length ? <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Current stock" value={String(metrics.totalStock)} helper="units across all groups" /><Metric label="Projected demand" value={metrics.totalDemand.toFixed(0)} helper="from latest source records" /><Metric label="High-risk groups" value={String(metrics.highRisk)} helper="actual calculated risk" /><Metric label="Active alerts" value={String(alerts.data?.length ?? 0)} helper="generated from live data" /></div><Panel className="p-5 sm:p-6"><SectionHeading title="Inventory snapshot" description="Current backend inventory records" action={<button onClick={() => void downloadCsv(apiRoutes.exportInventory, "inventory.csv")} className="inline-flex items-center gap-2 rounded-xl border border-[#dfe6ef] px-3 py-2 text-xs font-semibold text-[#52657e]"><Download size={14} /> Export CSV</button>} /><InventoryRows items={inventory.data} /></Panel></> : null}</div>;
}

function Metric({ label, value, helper }: { label: string; value: string; helper: string }) { return <Panel className="p-5"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8a98aa]">{label}</p><p className="mt-3 text-3xl font-bold text-[#12223b]">{value}</p><p className="mt-2 text-xs text-[#7d8b9c]">{helper}</p></Panel>; }

function InventoryRows({ items }: { items: ApiInventoryRecord[] }) { return <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="text-[10px] uppercase tracking-[0.12em] text-[#95a1b0]"><tr><th className="px-3 py-3">Group</th><th className="px-3 py-3">Stock</th><th className="px-3 py-3">Incoming</th><th className="px-3 py-3">Usage/day</th><th className="px-3 py-3">Available</th><th className="px-3 py-3">Coverage</th><th className="px-3 py-3">Risk</th></tr></thead><tbody>{items.map((item) => <tr key={item.blood_group} className="border-t border-[#edf1f5]"><td className="px-3 py-4 font-bold text-[#344862]">{item.blood_group}</td><td className="px-3 py-4">{item.current_blood_stock}</td><td className="px-3 py-4">{item.incoming_blood_units}</td><td className="px-3 py-4">{item.average_daily_usage}</td><td className="px-3 py-4">{item.available_units}</td><td className="px-3 py-4">{item.days_of_stock_remaining} days</td><td className="px-3 py-4"><RiskBadge risk={item.shortage_risk} compact /></td></tr>)}</tbody></table></div>; }

export function LiveInventoryPage() {
  const inventory = useRemoteData("inventory", getInventory);
  const [query, setQuery] = useState("");
  const [risk, setRisk] = useState<"All" | RiskLevel>("All");
  const items = useMemo(() => inventory.data?.filter((item) => item.blood_group.includes(query.toUpperCase()) && (risk === "All" || item.shortage_risk === risk)) ?? [], [inventory.data, query, risk]);
  return <div className="page-enter space-y-6"><Panel className="p-5 sm:p-6"><SectionHeading title="Live inventory" description="Stored and calculated by the backend" action={<button onClick={() => void downloadCsv(apiRoutes.exportInventory, "inventory.csv")} className="inline-flex items-center gap-2 rounded-xl border border-[#dfe6ef] px-3 py-2 text-xs font-semibold text-[#52657e]"><Download size={14} /> Export CSV</button>} /><div className="mb-5 flex gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search group" className="rounded-xl border border-[#dfe6ef] px-3 py-2 text-sm" /><select value={risk} onChange={(event) => setRisk(event.target.value as "All" | RiskLevel)} className="rounded-xl border border-[#dfe6ef] px-3 py-2 text-sm"><option>All</option><option>Low</option><option>Medium</option><option>High</option></select></div><LoadState loading={inventory.loading} error={inventory.error} empty={!inventory.loading && !items.length} onRetry={() => { void inventory.reload(); }} />{items.length ? <InventoryRows items={items} /> : null}</Panel></div>;
}

export function LiveAnalyticsPage() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const analyticsKey = `analytics:${startDate}:${endDate}`;
  const analytics = useRemoteData(analyticsKey, () => getAnalytics(startDate || undefined, endDate || undefined));
  return <div className="page-enter space-y-6"><Panel className="p-5 sm:p-6"><div className="mb-6 flex flex-wrap items-end justify-between gap-3"><SectionHeading title="Live analytics" description="Calculated from the backend source dataset" action={<button onClick={() => void downloadCsv(apiRoutes.exportAnalytics, "analytics.csv")} className="inline-flex items-center gap-2 rounded-xl border border-[#dfe6ef] px-3 py-2 text-xs font-semibold text-[#52657e]"><Download size={14} /> Export CSV</button>} /><div className="flex gap-2"><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="rounded-xl border border-[#dfe6ef] px-2 py-2 text-xs" /><input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="rounded-xl border border-[#dfe6ef] px-2 py-2 text-xs" /><button onClick={() => void analytics.reload()} className="rounded-xl border border-[#dfe6ef] px-3 py-2 text-xs font-semibold">Apply</button></div></div><LoadState loading={analytics.loading} error={analytics.error} empty={!analytics.loading && !analytics.data?.demand_trend.length} onRetry={() => { void analytics.reload(); }} />{analytics.data ? <div className="grid gap-6 xl:grid-cols-2"><ChartPanel title="Historical demand"><LineChart data={analytics.data.demand_trend}><CartesianGrid vertical={false} stroke="#eef2f7" /><XAxis dataKey="label" hide /><YAxis /><Tooltip /><Line dataKey="demand" stroke="#e2515a" dot={false} /></LineChart></ChartPanel><ChartPanel title="Stock versus demand"><AreaChart data={analytics.data.stock_trend}><CartesianGrid vertical={false} stroke="#eef2f7" /><XAxis dataKey="label" hide /><YAxis /><Tooltip /><Area dataKey="stock" stroke="#35a879" fill="#35a879" fillOpacity={0.15} /><Line dataKey="demand" stroke="#e2515a" dot={false} /></AreaChart></ChartPanel><ChartPanel title="Demand by blood group"><BarChart data={analytics.data.demand_by_group}><CartesianGrid vertical={false} stroke="#eef2f7" /><XAxis dataKey="group" /><YAxis /><Tooltip /><Bar dataKey="demand" fill="#2d6aca" /></BarChart></ChartPanel><ChartPanel title="Shortage trend"><LineChart data={analytics.data.shortage_trend}><CartesianGrid vertical={false} stroke="#eef2f7" /><XAxis dataKey="label" hide /><YAxis /><Tooltip /><Line dataKey="high" stroke="#e2515a" /><Line dataKey="medium" stroke="#e4a23b" /><Line dataKey="low" stroke="#35a879" /></LineChart></ChartPanel></div> : null}</Panel></div>;
}

function ChartPanel({ title, children }: { title: string; children: React.ReactElement }) { return <div><h3 className="mb-3 text-sm font-bold text-[#344862]">{title}</h3><div className="h-[260px]"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div></div>; }

export function LiveModelsPage() {
  const models = useRemoteData("models", getModelComparison);
  return <div className="page-enter space-y-6"><Panel className="p-5 sm:p-6"><SectionHeading title="Actual model performance" description="Metrics evaluated against the chronological test split" action={<button onClick={() => void downloadCsv(apiRoutes.exportModels, "model-performance.csv")} className="inline-flex items-center gap-2 rounded-xl border border-[#dfe6ef] px-3 py-2 text-xs font-semibold text-[#52657e]"><Download size={14} /> Export metrics</button>} /><LoadState loading={models.loading} error={models.error} empty={!models.loading && !models.data} onRetry={() => { void models.reload(); }} />{models.data ? <div className="grid gap-6 xl:grid-cols-2"><MetricTable title="Demand models" headers={["Model", "MAE", "RMSE", "R2"]} rows={models.data.demand_models.map((item) => [item.model, item.mae.toFixed(3), item.rmse.toFixed(3), item.r2.toFixed(3)])} /><MetricTable title="Shortage models" headers={["Model", "Accuracy", "Precision", "Recall", "F1"]} rows={models.data.shortage_models.map((item) => [item.model, item.accuracy.toFixed(3), item.precision.toFixed(3), item.recall.toFixed(3), item.f1.toFixed(3)])} /></div> : null}</Panel></div>;
}

function MetricTable({ title, headers, rows }: { title: string; headers: string[]; rows: string[][] }) { return <div><h3 className="mb-3 text-sm font-bold text-[#344862]">{title}</h3><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="text-[10px] uppercase text-[#95a1b0]">{headers.map((header) => <th key={header} className="px-3 py-2">{header}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row[0]} className="border-t border-[#edf1f5]">{row.map((cell) => <td key={cell} className="px-3 py-3 font-semibold text-[#52657e]">{cell}</td>)}</tr>)}</tbody></table></div></div>; }
