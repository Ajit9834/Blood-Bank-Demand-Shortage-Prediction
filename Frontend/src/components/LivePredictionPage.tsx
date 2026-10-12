import { useState } from "react";
import { AlertTriangle, Download, LoaderCircle, ShieldCheck, SlidersHorizontal, TrendingUp } from "lucide-react";
import type { ApiModelComparison, BloodGroup, ForecastResult, PredictionRequest, RiskResult, Season } from "../types";
import { apiRoutes, downloadCsv, getModelComparison, predictDemand, predictShortage } from "../services/api";
import { LoadingState, Panel, RiskBadge, SectionHeading, StatusMessage } from "./ui";
import { bloodGroups } from "../data/mockData";

type PredictionMode = "demand" | "shortage";

type LivePredictionPageProps = {
  mode: PredictionMode;
  onToast: (message: string) => void;
};

const initialRequest: PredictionRequest = {
  blood_group: "O+",
  month: 10,
  day_of_week: 4,
  season: "Summer",
  current_blood_stock: 80,
  previous_demand: 78,
  average_daily_usage: 9,
  number_of_donations: 20,
  incoming_blood_units: 20,
  hospital_requests: 42,
  emergency_cases: 4,
  previous_week_demand: 61,
  previous_month_demand: 244,
  days_of_stock_remaining: 8.89,
};

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between text-xs font-semibold text-[#52657e]">
        <span>{label}</span>
        {hint ? <span className="text-[10px] font-normal text-[#9aa6b5]">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

function NumberInput({ value, onChange, min = 0, max, step = 1, suffix = "units", name }: { value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number; suffix?: string; name?: string }) {
  return (
    <div className="relative">
      <input name={name} type="number" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full rounded-xl border border-[#dfe6ef] bg-white px-3.5 py-3 pr-16 text-sm font-semibold text-[#344862] outline-none transition focus:border-[#2d6aca] focus:ring-4 focus:ring-[#2d6aca]/10" />
      <span className="pointer-events-none absolute right-3.5 top-3.5 text-[11px] text-[#9aa6b5]">{suffix}</span>
    </div>
  );
}

function SelectInput({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-[#dfe6ef] bg-white px-3.5 py-3 text-sm font-medium text-[#344862] outline-none focus:border-[#2d6aca] focus:ring-4 focus:ring-[#2d6aca]/10">{children}</select>;
}

export function LivePredictionPage({ mode, onToast }: LivePredictionPageProps) {
  const [request, setRequest] = useState<PredictionRequest>(initialRequest);
  const [period, setPeriod] = useState("Next 7 Days");
  const [loading, setLoading] = useState(false);
  const [demandResult, setDemandResult] = useState<ForecastResult | null>(null);
  const [riskResult, setRiskResult] = useState<RiskResult | null>(null);
  const [modelComparison, setModelComparison] = useState<ApiModelComparison | null>(null);

  const update = <Key extends keyof PredictionRequest>(key: Key, value: PredictionRequest[Key]) => {
    setRequest((current) => ({ ...current, [key]: value }));
  };

  const runPrediction = async () => {
    setLoading(true);
    setDemandResult(null);
    setRiskResult(null);
    try {
      // Fetch prediction + model comparison in parallel
      const [comparison] = await Promise.all([getModelComparison()]);
      setModelComparison(comparison);

      if (mode === "demand") {
        setDemandResult(await predictDemand(request, period));
        onToast("Demand prediction generated");
      } else {
        setRiskResult(await predictShortage(request));
        onToast("Shortage risk prediction generated");
      }
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Prediction request failed");
    } finally {
      setLoading(false);
    }
  };

  const isDemand = mode === "demand";
  return (
    <div className="page-enter space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.82fr)_minmax(0,1.18fr)]">
        <Panel className="p-5 sm:p-6">
          <div className="mb-6 flex items-start gap-3">
            <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${isDemand ? "bg-[#eaf2ff] text-[#2d6aca]" : "bg-[#fff0f0] text-[#e2515a]"}`}>
              {isDemand ? <SlidersHorizontal size={19} /> : <AlertTriangle size={19} />}
            </span>
            <div>
              <h2 className="text-base font-bold text-[#12223b]">Backend prediction inputs</h2>
              <p className="mt-1 text-xs leading-5 text-[#8491a2]">Every field below is sent to the FastAPI <code>/api/predict</code> endpoint.</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Blood group"><SelectInput value={request.blood_group} onChange={(value) => update("blood_group", value as BloodGroup)}>{bloodGroups.map((group) => <option key={group}>{group}</option>)}</SelectInput></Field>
            {isDemand ? <Field label="Forecast period"><SelectInput value={period} onChange={setPeriod}><option>Next 7 Days</option><option>Next 14 Days</option><option>Next 30 Days</option></SelectInput></Field> : null}
            <Field label="Month" hint="month"><NumberInput name="month" value={request.month} onChange={(value) => update("month", value)} min={1} max={12} suffix="1-12" /></Field>
            <Field label="Day of week" hint="day_of_week"><NumberInput name="day_of_week" value={request.day_of_week} onChange={(value) => update("day_of_week", value)} min={0} max={6} suffix="0-6" /></Field>
            <Field label="Season" hint="season"><SelectInput value={request.season} onChange={(value) => update("season", value as Season)}><option>Winter</option><option>Spring</option><option>Summer</option><option>Monsoon</option></SelectInput></Field>
            <Field label="Current blood stock" hint="current_blood_stock"><NumberInput name="current_blood_stock" value={request.current_blood_stock} onChange={(value) => update("current_blood_stock", Math.max(0, Math.trunc(value)))} min={0} step={1} /></Field>
            <Field label="Previous demand" hint="previous_demand"><NumberInput name="previous_demand" value={request.previous_demand} onChange={(value) => update("previous_demand", Math.max(0, Math.trunc(value)))} min={0} step={1} /></Field>
            <Field label="Average daily usage" hint="average_daily_usage"><NumberInput name="average_daily_usage" value={request.average_daily_usage} onChange={(value) => update("average_daily_usage", Math.max(0, value))} min={0} step={0.1} suffix="units/day" /></Field>
            <Field label="Number of donations" hint="number_of_donations"><NumberInput name="number_of_donations" value={request.number_of_donations} onChange={(value) => update("number_of_donations", Math.max(0, Math.trunc(value)))} min={0} step={1} /></Field>
            <Field label="Incoming blood units" hint="incoming_blood_units"><NumberInput name="incoming_blood_units" value={request.incoming_blood_units} onChange={(value) => update("incoming_blood_units", Math.max(0, Math.trunc(value)))} min={0} step={1} /></Field>
            <Field label="Hospital requests" hint="hospital_requests"><NumberInput name="hospital_requests" value={request.hospital_requests} onChange={(value) => update("hospital_requests", Math.max(0, Math.trunc(value)))} min={0} step={1} /></Field>
            <Field label="Emergency cases" hint="emergency_cases"><NumberInput name="emergency_cases" value={request.emergency_cases} onChange={(value) => update("emergency_cases", Math.max(0, Math.trunc(value)))} min={0} step={1} /></Field>
            <Field label="Previous week demand" hint="previous_week_demand"><NumberInput name="previous_week_demand" value={request.previous_week_demand} onChange={(value) => update("previous_week_demand", Math.max(0, Math.trunc(value)))} min={0} step={1} /></Field>
            <Field label="Previous month demand" hint="previous_month_demand"><NumberInput name="previous_month_demand" value={request.previous_month_demand} onChange={(value) => update("previous_month_demand", Math.max(0, Math.trunc(value)))} min={0} step={1} /></Field>
            <Field label="Days of stock remaining" hint="days_of_stock_remaining"><NumberInput name="days_of_stock_remaining" value={request.days_of_stock_remaining} onChange={(value) => update("days_of_stock_remaining", Math.max(0, value))} min={0} step={0.1} suffix="days" /></Field>
          </div>
          <button disabled={loading} onClick={runPrediction} className={`mt-6 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-bold text-white transition disabled:opacity-60 ${isDemand ? "bg-[#e2515a] hover:bg-[#d74750]" : "bg-[#12223b] hover:bg-[#1c3557]"}`}>
            {loading ? <><LoaderCircle size={17} className="animate-spin" /> Requesting prediction...</> : isDemand ? <><TrendingUp size={16} /> Predict demand</> : <><ShieldCheck size={16} /> Predict shortage risk</>}
          </button>
          <button onClick={() => void downloadCsv(apiRoutes.exportPredictions, "predictions.csv")} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[#dfe6ef] bg-white px-4 py-3 text-xs font-semibold text-[#52657e]"><Download size={14} /> Export predictions CSV</button>
        </Panel>
        <div className="space-y-6">
          {loading ? <LoadingState label="Running backend prediction models" /> : null}
          {!loading && isDemand && demandResult ? <DemandResponse result={demandResult} comparison={modelComparison} /> : null}
          {!loading && !isDemand && riskResult ? <RiskResponse result={riskResult} comparison={modelComparison} /> : null}
          {!loading && !demandResult && !riskResult ? <Panel className="p-6"><SectionHeading title="Backend response" description="Submit the form to display the live prediction response." /></Panel> : null}
        </div>
      </div>
    </div>
  );
}

function DemandResponse({ result, comparison }: { result: ForecastResult; comparison: ApiModelComparison | null }) {
  return (
    <div className="space-y-4">
      {/* ── Prediction result card ── */}
      <Panel className="overflow-hidden">
        <div className="border-b border-[#edf1f5] bg-[#f8fbff] px-5 py-4 sm:px-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#2d6aca]">Live backend response</p>
          <h2 className="mt-1 text-xl font-bold text-[#12223b]">{result.group} blood demand</h2>
          <p className="mt-0.5 text-xs text-[#8290a1]">Forecast period: {result.period}</p>
        </div>
        <div className="grid divide-y divide-[#edf1f5] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#95a1b0]">Predicted demand</p>
            <p className="mt-2 text-3xl font-bold text-[#12223b]">
              {result.demand}
              <span className="ml-1.5 text-sm font-medium text-[#8b98a9]">units</span>
            </p>
          </div>
          <div className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#95a1b0]">Daily average</p>
            <p className="mt-2 text-3xl font-bold text-[#12223b]">
              {result.dailyAverage}
              <span className="ml-1.5 text-sm font-medium text-[#8b98a9]">units/day</span>
            </p>
          </div>
          <div className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#95a1b0]">Model used</p>
            <p className="mt-2 text-lg font-bold text-[#2d6aca]">{result.model}</p>
            <span className="mt-1 inline-block rounded-md bg-[#35a879] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-white">
              Best model
            </span>
          </div>
        </div>
      </Panel>

      {/* ── Inline model comparison ── */}
      {comparison && (
        <Panel className="p-5 sm:p-6">
          <SectionHeading
            eyebrow="How all models compare"
            title="Demand model evaluation metrics"
            description="Best value in each column is highlighted. The model used above was selected by highest R²."
          />
          <InlineComparisonTable
            headers={["Model", "MAE ↓", "RMSE ↓", "R² ↑"]}
            rows={comparison.demand_models.map((m) => ({ name: m.model, values: [m.mae, m.rmse, m.r2] }))}
            lowerIsBetter={[true, true, false]}
            bestModel={comparison.demand_best_model}
          />
        </Panel>
      )}
    </div>
  );
}

function RiskResponse({ result, comparison }: { result: RiskResult; comparison: ApiModelComparison | null }) {
  const isHigh = result.risk === "High";
  const isMed = result.risk === "Medium";
  return (
    <div className="space-y-4">
      {/* ── Risk result card ── */}
      <Panel className="overflow-hidden">
        <div
          className={`border-b border-[#edf1f5] px-5 py-4 sm:px-6 ${
            isHigh ? "bg-[#fff8f8]" : isMed ? "bg-[#fffaf0]" : "bg-[#f4fcf8]"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8a98aa]">Live backend response</p>
              <h2 className="mt-1 text-xl font-bold text-[#12223b]">{result.group} shortage risk</h2>
            </div>
            <RiskBadge risk={result.risk} />
          </div>
        </div>
        <div className="grid divide-y divide-[#edf1f5] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#95a1b0]">Current stock</p>
            <p className="mt-2 text-3xl font-bold text-[#12223b]">{result.stock}</p>
          </div>
          <div className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#95a1b0]">Predicted demand</p>
            <p className="mt-2 text-3xl font-bold text-[#12223b]">{result.demand}</p>
          </div>
          <div className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#95a1b0]">Expected gap</p>
            <p className={`mt-2 text-3xl font-bold ${result.gap ? "text-[#d7545c]" : "text-[#35a879]"}`}>
              {result.gap}
            </p>
          </div>
        </div>
        <div className="p-5 sm:p-6">
          <StatusMessage type={result.risk === "High" ? "error" : "success"}>{result.message}</StatusMessage>
        </div>
      </Panel>

      {/* ── Inline model comparison ── */}
      {comparison && (
        <Panel className="p-5 sm:p-6">
          <SectionHeading
            eyebrow="How all models compare"
            title="Shortage model evaluation metrics"
            description="Best value in each column is highlighted. The model used above was selected by highest weighted F1."
          />
          <InlineComparisonTable
            headers={["Model", "Accuracy ↑", "Precision ↑", "Recall ↑", "F1 ↑"]}
            rows={comparison.shortage_models.map((m) => ({
              name: m.model,
              values: [m.accuracy, m.precision, m.recall, m.f1],
            }))}
            lowerIsBetter={[false, false, false, false]}
            bestModel={comparison.shortage_best_model}
          />
        </Panel>
      )}
    </div>
  );
}

/**
 * Compact comparison table used inside prediction result panels.
 * Best value in each column → green pill. Best model row → green bg + Best badge.
 */
function InlineComparisonTable({
  headers,
  rows,
  lowerIsBetter,
  bestModel,
}: {
  headers: string[];
  rows: { name: string; values: number[] }[];
  lowerIsBetter: boolean[];
  bestModel: string;
}) {
  const bestValues = lowerIsBetter.map((lower, colIdx) => {
    const vals = rows.map((r) => r.values[colIdx]);
    return lower ? Math.min(...vals) : Math.max(...vals);
  });

  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-[#edf1f5]">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[#edf1f5] bg-[#f8fafc]">
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#95a1b0]">
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
                  isBest ? "bg-[#f0faf5]" : "hover:bg-[#fbfcfe]"
                }`}
              >
                {/* Name */}
                <td className="px-4 py-3">
                  <span className="font-bold text-[#344862]">{row.name}</span>
                  {isBest && (
                    <span className="ml-2 inline-block rounded-md bg-[#35a879] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-white">
                      Best
                    </span>
                  )}
                </td>
                {/* Metrics */}
                {row.values.map((val, colIdx) => {
                  const isColBest = val === bestValues[colIdx];
                  return (
                    <td key={colIdx} className="px-4 py-3">
                      {isColBest ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-[#e6f8ef] px-2.5 py-1 text-sm font-bold text-[#1f8a5a]">
                          {val.toFixed(4)}
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
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
  );
}
