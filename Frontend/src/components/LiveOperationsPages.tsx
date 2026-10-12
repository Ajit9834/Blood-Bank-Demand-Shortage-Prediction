import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Bell, CalendarDays, Download, LoaderCircle, RefreshCw } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ApiInventoryRecord, ConfusionMatrix, PageKey, RiskLevel } from "../types";
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

  return (
    <div className="page-enter space-y-6">

      {/* ── Best-model winner banners ── */}
      {models.data && (
        <div className="grid gap-4 sm:grid-cols-2">
          <BestModelBanner
            label="Best demand model"
            name={models.data.demand_best_model}
            sub="Selected by highest R² on test set"
            color="green"
          />
          <BestModelBanner
            label="Best shortage model"
            name={models.data.shortage_best_model}
            sub="Selected by highest weighted F1 on test set"
            color="blue"
          />
        </div>
      )}

      {/* ── Metric tables ── */}
      <Panel className="p-5 sm:p-6">
        <SectionHeading
          title="Actual model performance"
          description="All three algorithms evaluated on the same chronological test split (2025). Best value in each column is highlighted."
          action={
            <button
              onClick={() => void downloadCsv(apiRoutes.exportModels, "model-performance.csv")}
              className="inline-flex items-center gap-2 rounded-xl border border-[#dfe6ef] px-3 py-2 text-xs font-semibold text-[#52657e]"
            >
              <Download size={14} /> Export metrics
            </button>
          }
        />
        <LoadState
          loading={models.loading}
          error={models.error}
          empty={!models.loading && !models.data}
          onRetry={() => { void models.reload(); }}
        />
        {models.data && (
          <div className="mt-6 grid gap-8 xl:grid-cols-2">
            <ComparisonTable
              title="Demand prediction  (Regression)"
              headers={["Model", "MAE ↓", "RMSE ↓", "R² ↑"]}
              rows={models.data.demand_models.map((m) => ({
                name: m.model,
                values: [m.mae, m.rmse, m.r2],
              }))}
              lowerIsBetter={[true, true, false]}
              bestModel={models.data.demand_best_model}
            />
            <ComparisonTable
              title="Shortage risk  (Classification)"
              headers={["Model", "Accuracy ↑", "Precision ↑", "Recall ↑", "F1 ↑"]}
              rows={models.data.shortage_models.map((m) => ({
                name: m.model,
                values: [m.accuracy, m.precision, m.recall, m.f1],
              }))}
              lowerIsBetter={[false, false, false, false]}
              bestModel={models.data.shortage_best_model}
            />
          </div>
        )}
      </Panel>

      {/* ── Confusion Matrices ── */}
      {models.data && models.data.shortage_models.some((m) => m.confusion_matrix) && (
        <Panel className="p-5 sm:p-6">
          <SectionHeading
            title="Confusion Matrices (Shortage Risk Classification)"
            description="Detailed distribution of actual vs. predicted risk levels (High, Low, Medium) on the chronological test split."
          />
          <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {models.data.shortage_models.map((m) =>
              m.confusion_matrix ? (
                <ConfusionMatrixHeatmap
                  key={m.model}
                  modelName={m.model}
                  cm={m.confusion_matrix}
                  isBest={m.model === models.data!.shortage_best_model}
                />
              ) : null
            )}
          </div>
        </Panel>
      )}

      {models.data && (
        <p className="text-center text-[11px] text-[#9aa6b5]">
          Metrics evaluated at{" "}
          {new Date(models.data.evaluated_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}

/* ── shared sub-components ──────────────────────────────────────── */

function BestModelBanner({
  label,
  name,
  sub,
  color,
}: {
  label: string;
  name: string;
  sub: string;
  color: "green" | "blue";
}) {
  const g = color === "green";
  return (
    <div
      className={`flex items-center gap-4 rounded-2xl border px-5 py-4 ${
        g
          ? "border-[#d5e6dd] bg-[#f0faf5]"
          : "border-[#dbe6f3] bg-[#f1f6fd]"
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ${
          g ? "bg-[#35a879]" : "bg-[#2d6aca]"
        }`}
      >
        {/* trophy icon */}
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      </span>
      <div>
        <p className={`text-[10px] font-bold uppercase tracking-[0.16em] ${g ? "text-[#2d7a58]" : "text-[#2448a0]"}`}>
          {label}
        </p>
        <p className="mt-0.5 text-base font-bold text-[#12223b]">{name}</p>
        <p className={`mt-0.5 text-[11px] ${g ? "text-[#5a8a70]" : "text-[#4a6aa0]"}`}>{sub}</p>
      </div>
    </div>
  );
}

/**
 * Generic comparison table.
 * - Best value in every metric column gets a green pill + bold green text.
 * - The best-model row gets a subtle green background + "Best" badge.
 */
function ComparisonTable({
  title,
  headers,
  rows,
  lowerIsBetter,
  bestModel,
}: {
  title: string;
  headers: string[];
  rows: { name: string; values: number[] }[];
  lowerIsBetter: boolean[];
  bestModel: string;
}) {
  // Pre-compute the best value for each metric column
  const bestValues = lowerIsBetter.map((lower, colIdx) => {
    const vals = rows.map((r) => r.values[colIdx]);
    return lower ? Math.min(...vals) : Math.max(...vals);
  });

  return (
    <div>
      <h3 className="mb-3 text-sm font-bold text-[#344862]">{title}</h3>
      <div className="overflow-x-auto rounded-2xl border border-[#edf1f5]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#edf1f5] bg-[#f8fafc]">
              {headers.map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#95a1b0]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isBest = row.name === bestModel;
              return (
                <tr
                  key={row.name}
                  className={`border-t border-[#edf1f5] transition-colors ${
                    isBest
                      ? "bg-[#f0faf5]"
                      : "hover:bg-[#fbfcfe]"
                  }`}
                >
                  {/* Model name cell */}
                  <td className="px-4 py-3.5">
                    <span className="font-bold text-[#344862]">{row.name}</span>
                    {isBest && (
                      <span className="ml-2 inline-block rounded-md bg-[#35a879] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-white">
                        Best
                      </span>
                    )}
                  </td>
                  {/* Metric value cells */}
                  {row.values.map((val, colIdx) => {
                    const isColBest = val === bestValues[colIdx];
                    return (
                      <td key={colIdx} className="px-4 py-3.5">
                        {isColBest ? (
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#e6f8ef] px-2.5 py-1 text-sm font-bold text-[#1f8a5a]">
                            {val.toFixed(4)}
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </span>
                        ) : (
                          <span className="font-semibold text-[#52657e]">{val.toFixed(4)}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Confusion matrix heatmap.
 *
 * Colour scale per cell:
 *   - Diagonal (correct)     → green  (#e6f8ef → #1a7a4a), intensity by recall
 *   - Off-diagonal (errors)  → red    (#fff5f5 → #c0392b), intensity by count
 * Max counts are computed independently so the full colour range is used.
 */
function ConfusionMatrixHeatmap({
  modelName,
  cm,
  isBest,
}: {
  modelName: string;
  cm: ConfusionMatrix;
  isBest: boolean;
}) {
  const { labels, entries } = cm;

  // Build a lookup: (actual, predicted) → count
  const countMap = new Map<string, number>();
  let maxDiag = 1;
  let maxOffDiag = 1;
  for (const e of entries) {
    countMap.set(`${e.actual}::${e.predicted}`, e.count);
    if (e.actual === e.predicted) maxDiag = Math.max(maxDiag, e.count);
    else maxOffDiag = Math.max(maxOffDiag, e.count);
  }

  // Row totals for per-row recall display
  const rowTotals = new Map<string, number>();
  for (const label of labels) {
    const total = labels.reduce(
      (sum, pred) => sum + (countMap.get(`${label}::${pred}`) ?? 0),
      0
    );
    rowTotals.set(label, total);
  }

  function cellStyle(actual: string, predicted: string): React.CSSProperties {
    const count = countMap.get(`${actual}::${predicted}`) ?? 0;
    const isDiag = actual === predicted;
    if (isDiag) {
      const ratio = maxDiag > 0 ? count / maxDiag : 0;
      // green: #e6f8ef (low) → #1a7a4a (high)
      const r = Math.round(230 - ratio * (230 - 26));
      const g = Math.round(248 - ratio * (248 - 122));
      const b = Math.round(239 - ratio * (239 - 74));
      return { backgroundColor: `rgb(${r},${g},${b})`, color: ratio > 0.55 ? "#fff" : "#1a4a2e" };
    } else {
      const ratio = maxOffDiag > 0 ? count / maxOffDiag : 0;
      if (count === 0) return { backgroundColor: "#f8fafc", color: "#bcc8d8" };
      // red: #fff5f5 (low) → #c0392b (high)
      const r = Math.round(255 - ratio * (255 - 192));
      const g = Math.round(245 - ratio * (245 - 57));
      const b = Math.round(245 - ratio * (245 - 43));
      return { backgroundColor: `rgb(${r},${g},${b})`, color: ratio > 0.55 ? "#fff" : "#7b1a14" };
    }
  }

  // Per-class recall for the right-side annotations
  function recall(label: string): string {
    const correct = countMap.get(`${label}::${label}`) ?? 0;
    const total = rowTotals.get(label) ?? 0;
    return total > 0 ? `${((correct / total) * 100).toFixed(1)}%` : "—";
  }

  return (
    <div className={`rounded-2xl border p-4 ${isBest ? "border-[#b8dfc8] bg-[#f6fdf9]" : "border-[#edf1f5] bg-white"}`}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-[#344862]">{modelName}</p>
          <p className="mt-0.5 text-[10px] text-[#8a98aa]">Shortage risk · 3-class</p>
        </div>
        {isBest && (
          <span className="rounded-md bg-[#35a879] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-white">
            Best
          </span>
        )}
      </div>

      {/* Predicted header row */}
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-[3px] text-center text-xs">
          <thead>
            <tr>
              {/* top-left corner */}
              <th className="w-[68px] pb-1 text-left text-[10px] font-bold uppercase tracking-widest text-[#95a1b0]">
                Actual ↓
              </th>
              {labels.map((pred) => (
                <th
                  key={pred}
                  className="pb-1 text-[10px] font-bold uppercase tracking-widest text-[#52657e]"
                >
                  {pred}
                </th>
              ))}
              <th className="pb-1 text-[10px] font-bold uppercase tracking-widest text-[#8a98aa]">
                Recall
              </th>
            </tr>
          </thead>
          <tbody>
            {labels.map((actual) => (
              <tr key={actual}>
                {/* Row label */}
                <td className="pr-1 text-left text-[11px] font-bold text-[#344862]">
                  {actual}
                </td>
                {/* Matrix cells */}
                {labels.map((predicted) => {
                  const count = countMap.get(`${actual}::${predicted}`) ?? 0;
                  const isDiag = actual === predicted;
                  return (
                    <td
                      key={predicted}
                      className="rounded-lg py-2.5 font-bold leading-tight transition-transform hover:scale-105"
                      style={cellStyle(actual, predicted)}
                      title={`Actual: ${actual} → Predicted: ${predicted}: ${count}`}
                    >
                      <span className="block text-sm font-bold">{count}</span>
                      {isDiag && (
                        <span className="block text-[9px] font-normal opacity-80">✓</span>
                      )}
                    </td>
                  );
                })}
                {/* Recall annotation */}
                <td className="pl-1 text-[11px] font-semibold text-[#52657e]">
                  {recall(actual)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-4 border-t border-[#edf1f5] pt-2.5">
        <div className="flex items-center gap-1.5 text-[10px] text-[#7a8b9a]">
          <span className="h-3 w-3 rounded bg-[#35a879]" />
          Correct
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-[#7a8b9a]">
          <span className="h-3 w-3 rounded bg-[#e25b63]" />
          Misclassified
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-[#7a8b9a]">
          <span className="h-3 w-3 rounded bg-[#f0f4f8]" />
          Zero
        </div>
      </div>
    </div>
  );
}
