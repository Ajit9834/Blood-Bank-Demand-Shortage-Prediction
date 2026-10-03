import type { HTMLAttributes, ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, CircleAlert, CircleCheck, Info, LoaderCircle } from "lucide-react";
import type { RiskLevel } from "../types";

export function RiskBadge({ risk, compact = false }: { risk: RiskLevel; compact?: boolean }) {
  const styles = {
    Low: "border-emerald-200 bg-emerald-50 text-emerald-700",
    Medium: "border-amber-200 bg-amber-50 text-amber-700",
    High: "border-rose-200 bg-rose-50 text-rose-700",
  }[risk];

  const dotStyles = { Low: "bg-emerald-500", Medium: "bg-amber-500", High: "bg-rose-500" }[risk];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${styles} ${compact ? "px-2 py-0.5 text-[10px]" : ""}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotStyles}`} />
      {risk}
    </span>
  );
}

export function KpiCard({
  label,
  value,
  helper,
  icon,
  accent = "blue",
  change,
}: {
  label: string;
  value: string;
  helper: string;
  icon: ReactNode;
  accent?: "blue" | "red" | "green" | "amber";
  change?: { value: string; positive?: boolean };
}) {
  const colors = {
    blue: "bg-[#eaf2ff] text-[#2d6aca]",
    red: "bg-[#fff0f0] text-[#dd555d]",
    green: "bg-[#eaf8f1] text-[#208a62]",
    amber: "bg-[#fff7e6] text-[#c18224]",
  }[accent];

  return (
    <div className="group rounded-2xl border border-[#e6ebf2] bg-white p-5 transition-all duration-300 hover:-translate-y-1 hover:border-[#d5deeb] hover:shadow-[0_14px_35px_rgba(25,47,80,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8a98aa]">{label}</p>
          <p className="mt-3 text-[27px] font-bold tracking-[-0.04em] text-[#12223b]">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${colors}`}>{icon}</div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#eff2f6] pt-3">
        <span className="text-xs text-[#7d8b9c]">{helper}</span>
        {change ? (
          <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${change.positive === false ? "text-[#dd555d]" : "text-[#208a62]"}`}>
            {change.positive === false ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}
            {change.value}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function Panel({ children, className = "", ...props }: { children: ReactNode; className?: string } & HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-2xl border border-[#e6ebf2] bg-white ${className}`} {...props}>{children}</div>;
}

export function SectionHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow ? <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#e2515a]">{eyebrow}</p> : null}
        <h2 className="text-lg font-bold tracking-[-0.025em] text-[#12223b]">{title}</h2>
        {description ? <p className="mt-1 text-sm text-[#7d8b9c]">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function LoadingState({ label = "Loading insight" }: { label?: string }) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#dbe3ee] bg-[#fbfcfe] text-center">
      <LoaderCircle className="animate-spin text-[#2d6aca]" size={22} />
      <p className="text-sm font-medium text-[#64748b]">{label}</p>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#dbe3ee] bg-[#fbfcfe] px-5 text-center">
      <Info className="mb-2 text-[#99a6b7]" size={22} />
      <p className="text-sm font-semibold text-[#334155]">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-5 text-[#8592a3]">{description}</p>
    </div>
  );
}

export function StatusMessage({ type, children }: { type: "success" | "error"; children: ReactNode }) {
  const isSuccess = type === "success";
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm ${isSuccess ? "border-emerald-200 bg-emerald-50/70 text-emerald-800" : "border-rose-200 bg-rose-50/70 text-rose-800"}`}>
      {isSuccess ? <CircleCheck className="mt-0.5 shrink-0" size={16} /> : <CircleAlert className="mt-0.5 shrink-0" size={16} />}
      <span>{children}</span>
    </div>
  );
}