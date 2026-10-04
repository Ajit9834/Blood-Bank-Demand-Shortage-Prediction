import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  BrainCircuit,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Database,
  Download,
  Droplets,
  Gauge,
  GitBranch,
  Info,
  Layers3,
  LayoutDashboard,
  LoaderCircle,
  LogIn,
  LogOut,
  Menu,
  MoreHorizontal,
  Package,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Users,
  UserPlus,
  X,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { bloodGroups, classificationModels, demandForecast, demandMix, demandModels, inventory, stockTrend } from "./data/mockData";
import { clearAuthSession, getStoredAuthSession, logoutAccount, predictDemand, predictShortage } from "./services/api";
import type { AuthSession, BloodGroup, ForecastResult, PageKey, RiskLevel, RiskResult, Season } from "./types";
import { EmptyState, KpiCard, LoadingState, Panel, RiskBadge, SectionHeading, StatusMessage } from "./components/ui";
import { AuthPage } from "./components/AuthPage";
import { AuthShell } from "./components/AuthShell";
import { PasswordRecoveryPage } from "./components/PasswordRecoveryPage";
const LivePredictionPage = lazy(() => import("./components/LivePredictionPage").then((module) => ({ default: module.LivePredictionPage })));
const LiveDashboardPage = lazy(() => import("./components/LiveOperationsPages").then((module) => ({ default: module.LiveDashboardPage })));
const LiveInventoryPage = lazy(() => import("./components/LiveOperationsPages").then((module) => ({ default: module.LiveInventoryPage })));
const LiveAnalyticsPage = lazy(() => import("./components/LiveOperationsPages").then((module) => ({ default: module.LiveAnalyticsPage })));
const LiveModelsPage = lazy(() => import("./components/LiveOperationsPages").then((module) => ({ default: module.LiveModelsPage })));
const LiveTopNavbar = lazy(() => import("./components/LiveOperationsPages").then((module) => ({ default: module.LiveTopNavbar })));

const DemandPage = ({ onToast }: { onToast: (message: string) => void }) => <LivePredictionPage mode="demand" onToast={onToast} />;
const ShortagePage = ({ onToast }: { onToast: (message: string) => void }) => <LivePredictionPage mode="shortage" onToast={onToast} />;
const Dashboard = ({ onToast }: { onNavigate: (page: PageKey) => void; onToast: (message: string) => void }) => <LiveDashboardPage onToast={onToast} />;
const InventoryPage = () => <LiveInventoryPage />;
const AnalyticsPage = () => <LiveAnalyticsPage />;
const ModelsPage = () => <LiveModelsPage />;
const TopNavbar = ({ page, onMenu, onToast }: { page: PageKey; onMenu: () => void; onToast: (message: string) => void }) => <LiveTopNavbar page={page} onMenu={onMenu} onToast={onToast} />;

const navItems: { key: PageKey; label: string; icon: typeof LayoutDashboard; section?: string }[] = [
  { key: "dashboard", label: "Overview", icon: LayoutDashboard, section: "Workspace" },
  { key: "demand", label: "Demand prediction", icon: TrendingUp },
  { key: "shortage", label: "Shortage risk", icon: AlertTriangle },
  { key: "inventory", label: "Blood inventory", icon: Package, section: "Operations" },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
  { key: "models", label: "Model performance", icon: BrainCircuit, section: "Project" },
  { key: "about", label: "About BloodSight", icon: Info },
];

const pageInfo: Record<PageKey, { title: string; description: string }> = {
  dashboard: { title: "Blood Bank ML Dashboard", description: "Demand Forecasting & Shortage Risk Analysis" },
  demand: { title: "Blood Demand Prediction", description: "Predict expected blood requirements for the selected forecast period." },
  shortage: { title: "Shortage Risk Prediction", description: "Identify blood groups that may face insufficient stock." },
  inventory: { title: "Blood Inventory Management", description: "A live operational view of current units, incoming donations and projected need." },
  analytics: { title: "Analytics", description: "Explore demand, stock and risk trends across the blood bank." },
  models: { title: "ML Model Performance", description: "Comparison of algorithms used for blood-bank prediction." },
  about: { title: "About BloodSight", description: "A decision-support platform for smarter blood-bank planning." },
  login: { title: "Sign in", description: "Access your BloodSight account" },
  register: { title: "Create account", description: "Register for BloodSight" },
  forgotPassword: { title: "Forgot password", description: "Request a secure password reset link" },
  resetPassword: { title: "Reset password", description: "Choose a new account password" },
  notFound: { title: "Page not found", description: "This page could not be found" },
};

const riskColors = { Low: "#35a879", Medium: "#e4a23b", High: "#e25b63" };
const riskData = [
  { name: "Low risk", value: 4, color: riskColors.Low },
  { name: "Medium risk", value: 2, color: riskColors.Medium },
  { name: "High risk", value: 2, color: riskColors.High },
];
const RESET_TOKEN_STORAGE_KEY = "bloodsight.password.reset-token";
const pagePaths: Record<PageKey, string> = {
  dashboard: "/dashboard",
  demand: "/demand",
  shortage: "/shortage",
  inventory: "/inventory",
  analytics: "/analytics",
  models: "/models",
  about: "/about",
  login: "/login",
  register: "/register",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  notFound: "/404",
};
const protectedPages = new Set<PageKey>(["dashboard", "demand", "shortage", "inventory", "analytics", "models", "about"]);

function pageFromLocation(session: AuthSession | null): PageKey {
  const isAuthenticated = Boolean(session && session.expires_at > Date.now());
  if (new URLSearchParams(window.location.search).has("reset_token")) return "resetPassword";
  if (window.location.pathname === "/") return isAuthenticated ? "dashboard" : "login";
  const requestedPage = (Object.keys(pagePaths) as PageKey[]).find((page) => pagePaths[page] === window.location.pathname);
  if (!requestedPage) return "notFound";
  if (protectedPages.has(requestedPage) && !isAuthenticated) return "login";
  if (isAuthenticated && ["login", "register", "forgotPassword"].includes(requestedPage)) return "dashboard";
  if (requestedPage === "resetPassword" && !sessionStorage.getItem(RESET_TOKEN_STORAGE_KEY)) return "forgotPassword";
  return requestedPage;
}

function Sidebar({ page, onNavigate, mobileOpen, onClose, user, onLogout, isSigningOut }: { page: PageKey; onNavigate: (page: PageKey) => void; mobileOpen: boolean; onClose: () => void; user: AuthSession["user"] | null; onLogout: () => void; isSigningOut: boolean }) {
  return (
    <>
      {mobileOpen ? <button aria-label="Close navigation" onClick={onClose} className="fixed inset-0 z-40 bg-[#10223b]/35 backdrop-blur-[2px] lg:hidden" /> : null}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col bg-[#10223b] px-4 py-5 text-white transition-transform duration-300 lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-3">
          <button onClick={() => onNavigate("dashboard")} className="flex items-center gap-3 text-left">
            <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-[#e2515a] shadow-[0_8px_20px_rgba(226,81,90,0.3)]">
              <Droplets size={21} strokeWidth={2.4} />
              <span className="absolute bottom-[7px] h-1 w-1 rounded-full bg-white/80" />
            </span>
            <span><span className="block text-[18px] font-bold tracking-[-0.04em]">BloodSight</span><span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-[0.22em] text-[#9eafc7]">AI blood intelligence</span></span>
          </button>
          <button aria-label="Close navigation" onClick={onClose} className="rounded-lg p-1.5 text-[#9eafc7] hover:bg-white/10 hover:text-white lg:hidden"><X size={18} /></button>
        </div>
        <div className="mt-10 flex-1 overflow-y-auto custom-scrollbar">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const previous = navItems[index - 1];
            const showSection = item.section && (index === 0 || item.section !== previous?.section);
            const active = page === item.key;
            return <div key={item.key}>{showSection ? <p className="mb-2 mt-6 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#6f829d]">{item.section}</p> : null}<button onClick={() => onNavigate(item.key)} className={`group mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-medium transition-all ${active ? "bg-white text-[#10223b] shadow-[0_6px_18px_rgba(0,0,0,0.12)]" : "text-[#aebbd0] hover:bg-white/8 hover:text-white"}`}><Icon size={18} strokeWidth={active ? 2.3 : 1.8} className={active ? "text-[#e2515a]" : "text-[#8093ae] group-hover:text-[#d8e3f1]"} /><span className="flex-1">{item.label}</span>{item.key === "shortage" ? <span className={`flex h-5 min-w-5 items-center justify-center rounded-full text-[10px] font-bold ${active ? "bg-[#fff0f0] text-[#e2515a]" : "bg-[#e2515a] text-white"}`}>2</span> : null}</button></div>;
          })}
          <p className="mb-2 mt-6 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#6f829d]">Account</p>
          {user ? <>
            <p className="truncate px-3 pb-2 text-xs text-[#aebbd0]" title={user.email}>{user.email}</p>
            <button onClick={onLogout} disabled={isSigningOut} className="group mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-medium text-[#aebbd0] transition-all hover:bg-white/8 hover:text-white disabled:opacity-60">
              {isSigningOut ? <LoaderCircle size={18} className="animate-spin text-[#8093ae]" /> : <LogOut size={18} className="text-[#8093ae] group-hover:text-[#d8e3f1]" />}
              <span>{isSigningOut ? "Signing out..." : "Sign out"}</span>
            </button>
          </> : <>
            <button onClick={() => onNavigate("login")} className={`group mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-medium transition-all ${page === "login" ? "bg-white text-[#10223b]" : "text-[#aebbd0] hover:bg-white/8 hover:text-white"}`}>
              <LogIn size={18} className={page === "login" ? "text-[#e2515a]" : "text-[#8093ae] group-hover:text-[#d8e3f1]"} /><span>Sign in</span>
            </button>
            <button onClick={() => onNavigate("register")} className={`group mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-medium transition-all ${page === "register" ? "bg-white text-[#10223b]" : "text-[#aebbd0] hover:bg-white/8 hover:text-white"}`}>
              <UserPlus size={18} className={page === "register" ? "text-[#e2515a]" : "text-[#8093ae] group-hover:text-[#d8e3f1]"} /><span>Create account</span>
            </button>
          </>}
        </div>
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.06] p-4"><div className="flex items-center gap-2 text-[#c7d5e6]"><Sparkles size={15} className="text-[#e9a7a9]" /><span className="text-xs font-semibold">Live environment</span></div><p className="mt-2 text-[11px] leading-5 text-[#8397b4]">Inventory, analytics, alerts, and model results are connected to FastAPI.</p><div className="mt-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#81c9a6]"><span className="h-1.5 w-1.5 rounded-full bg-[#4ac18a]" /> API connected</div></div>
      </aside>
    </>
  );
}

export function LegacyTopNavbar({ page, onMenu, onToast }: { page: PageKey; onMenu: () => void; onToast: (message: string) => void }) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const today = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(new Date());
  const info = pageInfo[page];
  return <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-[#e8edf3] bg-[#f6f8fb]/95 px-5 backdrop-blur-md sm:px-8 lg:px-10"><div className="flex min-w-0 items-center gap-3"><button aria-label="Open navigation" onClick={onMenu} className="rounded-xl border border-[#e0e7f0] bg-white p-2.5 text-[#51647e] shadow-sm lg:hidden"><Menu size={19} /></button><div className="min-w-0"><p className="truncate text-[17px] font-bold tracking-[-0.035em] text-[#12223b] sm:text-[19px]">{info.title}</p><p className="mt-0.5 hidden truncate text-xs text-[#8290a1] sm:block">{info.description}</p></div></div><div className="flex items-center gap-2.5 sm:gap-4"><div className="hidden items-center gap-2 border-r border-[#e2e8f0] pr-4 text-xs font-medium text-[#718096] md:flex"><CalendarDays size={15} className="text-[#8d9caf]" /> {today}</div><div className="relative"><button aria-label="Notifications" onClick={() => setNotificationsOpen((open) => !open)} className="relative rounded-xl border border-[#e0e7f0] bg-white p-2.5 text-[#52657e] shadow-sm transition hover:border-[#ccd7e4] hover:text-[#e2515a]"><Bell size={17} /><span className="absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full bg-[#e2515a] ring-2 ring-white" /></button>{notificationsOpen ? <div className="absolute right-0 top-12 w-[290px] rounded-2xl border border-[#e4eaf2] bg-white p-4 shadow-[0_18px_45px_rgba(25,47,80,0.14)]"><div className="flex items-center justify-between"><p className="text-sm font-bold text-[#12223b]">Notifications</p><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#e2515a]">2 new</span></div><div className="mt-3 space-y-2"><button onClick={() => { onToast("Opening shortage risk review"); setNotificationsOpen(false); }} className="flex w-full gap-3 rounded-xl bg-[#fff7f7] p-3 text-left"><span className="mt-0.5 text-[#e2515a]"><AlertTriangle size={15} /></span><span><span className="block text-xs font-semibold text-[#263852]">O- needs attention</span><span className="mt-1 block text-[11px] text-[#8a98aa]">Projected gap of 13 units</span></span></button><button onClick={() => { onToast("Donation intake synced"); setNotificationsOpen(false); }} className="flex w-full gap-3 rounded-xl p-3 text-left hover:bg-[#f7f9fc]"><span className="mt-0.5 text-[#35a879]"><CheckCircle2 size={15} /></span><span><span className="block text-xs font-semibold text-[#263852]">42 incoming donations</span><span className="mt-1 block text-[11px] text-[#8a98aa]">Updated 18 minutes ago</span></span></button></div></div> : null}</div><button onClick={() => onToast("Profile menu is available in the connected workspace")} className="flex items-center gap-2.5 rounded-xl border border-[#e0e7f0] bg-white py-1.5 pl-1.5 pr-2.5 text-left shadow-sm transition hover:border-[#ccd7e4]"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#dce8f8] text-xs font-bold text-[#2d6aca]">AC</span><span className="hidden text-xs font-semibold text-[#344862] sm:block">Alex Chen</span><ChevronDown size={14} className="text-[#90a0b3]" /></button></div></header>;
}

function BloodGroupCard({ item }: { item: (typeof inventory)[number] }) {
  const fill = Math.min(100, Math.round((item.stock / Math.max(item.demand, 1)) * 70));
  return <div className="group rounded-2xl border border-[#e6ebf2] bg-white p-4 transition-all duration-300 hover:-translate-y-1 hover:border-[#d6dfeb] hover:shadow-[0_14px_35px_rgba(25,47,80,0.08)]"><div className="flex items-center justify-between"><span className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold ${item.risk === "High" ? "bg-[#fff0f0] text-[#db5960]" : item.risk === "Medium" ? "bg-[#fff7e6] text-[#c18324]" : "bg-[#eaf8f1] text-[#208a62]"}`}>{item.group}</span><RiskBadge risk={item.risk} compact /></div><div className="mt-5 flex items-end justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9aa6b5]">Current stock</p><p className="mt-1 text-xl font-bold tracking-[-0.035em] text-[#12223b]">{item.stock}<span className="ml-1 text-xs font-medium text-[#8b98a9]">units</span></p></div><div className="text-right"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9aa6b5]">7d demand</p><p className="mt-1 text-sm font-bold text-[#344862]">{item.demand}</p></div></div><div className="mt-4"><div className="mb-1.5 flex justify-between text-[10px] font-medium text-[#8b98a9]"><span>Stock coverage</span><span className="font-bold text-[#51647e]">{item.coverage} days</span></div><div className="h-1.5 overflow-hidden rounded-full bg-[#edf1f6]"><div className={`h-full rounded-full ${item.risk === "High" ? "bg-[#e25b63]" : item.risk === "Medium" ? "bg-[#e4a23b]" : "bg-[#35a879]"}`} style={{ width: `${fill}%` }} /></div></div></div>;
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) { if (!active || !payload?.length) return null; return <div className="rounded-xl border border-[#e5ebf3] bg-white px-3 py-2.5 shadow-[0_10px_30px_rgba(25,47,80,0.12)]"><p className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#8c99aa]">{label}</p>{payload.map((item) => <div key={item.name} className="flex items-center gap-2 text-xs"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} /><span className="text-[#77869a]">{item.name}</span><span className="ml-3 font-bold text-[#263852]">{item.value}</span></div>)}</div>; }

export function LegacyDashboard({ onNavigate, onToast }: { onNavigate: (page: PageKey) => void; onToast: (message: string) => void }) {
  return <div className="page-enter space-y-7"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#e2515a]">Friday, 23 August 2024</p><h1 className="text-[26px] font-bold tracking-[-0.045em] text-[#12223b] sm:text-[31px]">Good morning, Alex <span className="text-[#b2bdca]">/</span></h1><p className="mt-2 text-sm text-[#7d8b9c]">Here is the latest pulse of your blood-bank operations.</p></div><button onClick={() => onToast("Dashboard data refreshed")} className="inline-flex items-center gap-2 rounded-xl border border-[#dfe6ef] bg-white px-3.5 py-2.5 text-xs font-semibold text-[#51647e] shadow-sm transition hover:border-[#cdd8e5] hover:text-[#2d6aca]"><RefreshCw size={14} /> Refresh data</button></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6"><KpiCard label="Total blood units" value="197" helper="Across 8 blood groups" icon={<Droplets size={19} />} accent="red" change={{ value: "+6.4%" }} /><KpiCard label="Predicted 7-day demand" value="177" helper="Expected requirements" icon={<TrendingUp size={19} />} accent="blue" change={{ value: "+4.8%" }} /><KpiCard label="High risk groups" value="2" helper="Requires attention" icon={<AlertTriangle size={19} />} accent="red" change={{ value: "2 alerts", positive: false }} /><KpiCard label="Low stock groups" value="3" helper="Below coverage target" icon={<Package size={19} />} accent="amber" /><KpiCard label="Incoming donations" value="42" helper="Next 7 days" icon={<Users size={19} />} accent="green" change={{ value: "+12.1%" }} /><KpiCard label="Prediction accuracy" value="94.2%" helper="Last validation run" icon={<Gauge size={19} />} accent="blue" change={{ value: "+1.6%" }} /></div><div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.75fr)]"><Panel className="p-5 sm:p-6"><SectionHeading eyebrow="Inventory snapshot" title="Blood stock overview" description="Current availability compared with the next 7 days of predicted demand." action={<button onClick={() => onNavigate("inventory")} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2d6aca] hover:text-[#e2515a]">View inventory <ArrowRight size={14} /></button>} /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{inventory.map((item) => <BloodGroupCard key={item.group} item={item} />)}</div></Panel><Panel className="p-5 sm:p-6"><SectionHeading eyebrow="Risk radar" title="Shortage risk distribution" description="Current model classification across all groups." /><div className="relative mx-auto h-[190px] max-w-[240px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={riskData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={58} outerRadius={80} paddingAngle={4} stroke="none">{riskData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip content={<ChartTooltip />} /></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-3xl font-bold tracking-[-0.06em] text-[#12223b]">8</span><span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a98aa]">groups</span></div></div><div className="mt-1 grid grid-cols-3 gap-2 border-t border-[#edf1f5] pt-4">{riskData.map((entry) => <div key={entry.name} className="text-center"><span className="mx-auto mb-1.5 block h-1.5 w-6 rounded-full" style={{ background: entry.color }} /><p className="text-[10px] text-[#8794a5]">{entry.name.replace(" risk", "")}</p><p className="mt-0.5 text-sm font-bold text-[#263852]">{entry.value}</p></div>)}</div></Panel></div><div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.85fr)]"><Panel className="p-5 sm:p-6"><SectionHeading eyebrow="Demand signal" title="12-day demand forecast" description="Aggregated demand across the blood bank. The dotted line shows the baseline." action={<div className="flex items-center gap-3 text-[10px] font-semibold text-[#8a98aa]"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#2d6aca]" /> Demand</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#b8c5d5]" /> Baseline</span></div>} /><div className="h-[260px] w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={demandForecast} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}><CartesianGrid vertical={false} stroke="#eef2f7" /><XAxis dataKey="label" tick={{ fill: "#8b98a9", fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" /><YAxis tick={{ fill: "#8b98a9", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip content={<ChartTooltip />} /><Line type="monotone" dataKey="demand" name="Demand" stroke="#2d6aca" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: "#2d6aca", stroke: "#fff", strokeWidth: 2 }} /><Line type="monotone" dataKey="baseline" name="Baseline" stroke="#b8c5d5" strokeWidth={1.7} strokeDasharray="5 5" dot={false} /></LineChart></ResponsiveContainer></div></Panel><Panel className="p-5 sm:p-6"><SectionHeading eyebrow="Needs review" title="Blood shortage alerts" action={<button onClick={() => onNavigate("shortage")} className="text-xs font-bold text-[#2d6aca] hover:text-[#e2515a]">View details</button>} /><div className="space-y-1">{[{ group: "O-", title: "High shortage risk", detail: "Predicted shortage: 13 units", color: "red" }, { group: "A-", title: "Medium shortage risk", detail: "Monitor upcoming demand", color: "amber" }, { group: "B+", title: "Stock level sufficient", detail: "9 days of coverage", color: "green" }].map((alert) => <button key={alert.group} onClick={() => onNavigate("shortage")} className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-[#f8fafc]"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${alert.color === "red" ? "bg-[#fff0f0] text-[#dc5961]" : alert.color === "amber" ? "bg-[#fff7e6] text-[#c08325]" : "bg-[#eaf8f1] text-[#208a62]"}`}>{alert.group}</span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-[#344862]">{alert.title}</span><span className="mt-1 block truncate text-[11px] text-[#8996a7]">{alert.detail}</span></span><ArrowRight size={15} className="shrink-0 text-[#aab5c2]" /></button>)}</div><div className="mt-4 rounded-xl bg-[#f7f9fc] p-3.5"><div className="flex items-start gap-2.5"><ShieldCheck size={16} className="mt-0.5 text-[#2d6aca]" /><p className="text-[11px] leading-5 text-[#718096]">Risk flags are decision-support signals, not medical decisions. Review alongside local operating context.</p></div></div></Panel></div></div>;
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) { return <label className="block"><span className="mb-2 flex items-center justify-between text-xs font-semibold text-[#52657e]"><span>{label}</span>{hint ? <span className="text-[10px] font-normal text-[#9aa6b5]">{hint}</span> : null}</span>{children}</label>; }
function SelectField({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: ReactNode }) { return <div className="relative"><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full appearance-none rounded-xl border border-[#dfe6ef] bg-white px-3.5 py-3 text-sm font-medium text-[#344862] outline-none transition focus:border-[#2d6aca] focus:ring-4 focus:ring-[#2d6aca]/10">{children}</select><ChevronDown size={16} className="pointer-events-none absolute right-3.5 top-3.5 text-[#8b98a9]" /></div>; }
function NumberField({ value, onChange, suffix = "units" }: { value: number; onChange: (value: number) => void; suffix?: string }) { return <div className="relative"><input type="number" min="0" value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full rounded-xl border border-[#dfe6ef] bg-white px-3.5 py-3 pr-16 text-sm font-semibold text-[#344862] outline-none transition focus:border-[#2d6aca] focus:ring-4 focus:ring-[#2d6aca]/10" /><span className="pointer-events-none absolute right-3.5 top-3.5 text-[11px] text-[#9aa6b5]">{suffix}</span></div>; }

export function LegacyDemandPage({ onToast }: { onToast: (message: string) => void }) {
  const [group, setGroup] = useState<BloodGroup>("O+"); const [period, setPeriod] = useState("Next 7 Days"); const [month] = useState(10); const [dayOfWeek] = useState(4); const [season] = useState<Season>("Summer"); const [stock, setStock] = useState(80); const [previousDemand] = useState(78); const [usage, setUsage] = useState(9); const [previousWeek, setPreviousWeek] = useState(61); const [previousMonth, setPreviousMonth] = useState(244); const [requests, setRequests] = useState(42); const [emergency, setEmergency] = useState(4); const [donations, setDonations] = useState(20); const [loading, setLoading] = useState(false); const [result, setResult] = useState<ForecastResult | null>(null);
  const runPrediction = async () => {
    setLoading(true);
    setResult(null);
    try {
      const next = await predictDemand({ blood_group: group, month, day_of_week: dayOfWeek, season, current_blood_stock: stock, previous_demand: previousDemand, average_daily_usage: usage, number_of_donations: donations, incoming_blood_units: donations, hospital_requests: requests, emergency_cases: emergency, previous_week_demand: previousWeek, previous_month_demand: previousMonth, days_of_stock_remaining: Number((stock / Math.max(usage, 0.01)).toFixed(2)) }, period); /*
        const next = await predictDemand({ blood_group: group, month, day_of_week: dayOfWeek, season, current_blood_stock: stock, previous_demand: previousDemand, average_daily_usage: usage, number_of_donations: donations, incoming_blood_units: donations, hospital_requests: requests, emergency_cases: emergency, previous_week_demand: previousWeek, previous_month_demand: previousMonth, days_of_stock_remaining: Number((stock / Math.max(usage, 0.01)).toFixed(2)) }, period);
        return <div className="page-enter space-y-6"><div className="grid gap-6 xl:grid-cols-[minmax(320px,0.82fr)_minmax(0,1.18fr)]"><Panel className="p-5 sm:p-6"><div className="mb-6 flex items-start gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf2ff] text-[#2d6aca]"><SlidersHorizontal size={19} /></span><div><h2 className="text-base font-bold text-[#12223b]">Forecast inputs</h2><p className="mt-1 text-xs leading-5 text-[#8491a2]">Tune the inputs before sending a request to the prediction service.</p></div></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Blood group"><SelectField value={group} onChange={(value) => setGroup(value as BloodGroup)}>{bloodGroups.map((bloodGroup) => <option key={bloodGroup}>{bloodGroup}</option>)}</SelectField></Field><Field label="Forecast period"><SelectField value={period} onChange={setPeriod}><option>Next 7 Days</option><option>Next 14 Days</option><option>Next 30 Days</option></SelectField></Field><Field label="Month"><NumberField value={month} onChange={setMonth} suffix="1-12" /></Field><Field label="Day of week"><NumberField value={dayOfWeek} onChange={setDayOfWeek} suffix="0-6" /></Field><Field label="Season"><SelectField value={season} onChange={(value) => setSeason(value as Season)}><option>Winter</option><option>Spring</option><option>Summer</option><option>Monsoon</option></SelectField></Field><Field label="Current stock"><NumberField value={stock} onChange={setStock} /></Field><Field label="Previous demand"><NumberField value={previousDemand} onChange={setPreviousDemand} /></Field><Field label="Average daily usage"><NumberField value={usage} onChange={setUsage} suffix="units/day" /></Field><Field label="Previous week demand"><NumberField value={previousWeek} onChange={setPreviousWeek} /></Field><Field label="Previous month demand"><NumberField value={previousMonth} onChange={setPreviousMonth} /></Field><Field label="Hospital requests"><NumberField value={requests} onChange={setRequests} /></Field><Field label="Emergency cases"><NumberField value={emergency} onChange={setEmergency} /></Field><Field label="Incoming donations" hint="Units and donation count"><NumberField value={donations} onChange={setDonations} /></Field></div><button disabled={loading} onClick={runPrediction} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#e2515a] px-4 py-3.5 text-sm font-bold text-white shadow-[0_8px_18px_rgba(226,81,90,0.2)] transition hover:bg-[#d74750] disabled:opacity-60">{loading
      */ setResult(next);
      onToast("Demand forecast generated");
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Demand prediction failed");
    } finally {
      setLoading(false);
    }
  };
  return <div className="page-enter space-y-6"><div className="grid gap-6 xl:grid-cols-[minmax(320px,0.82fr)_minmax(0,1.18fr)]"><Panel className="p-5 sm:p-6"><div className="mb-6 flex items-start gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf2ff] text-[#2d6aca]"><SlidersHorizontal size={19} /></span><div><h2 className="text-base font-bold text-[#12223b]">Forecast inputs</h2><p className="mt-1 text-xs leading-5 text-[#8491a2]">Tune the inputs before sending a request to the prediction service.</p></div></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Blood group"><SelectField value={group} onChange={(value) => setGroup(value as BloodGroup)}>{bloodGroups.map((bloodGroup) => <option key={bloodGroup}>{bloodGroup}</option>)}</SelectField></Field><Field label="Forecast period"><SelectField value={period} onChange={setPeriod}><option>Next 7 Days</option><option>Next 14 Days</option><option>Next 30 Days</option></SelectField></Field><Field label="Current stock"><NumberField value={stock} onChange={setStock} /></Field><Field label="Average daily usage"><NumberField value={usage} onChange={setUsage} suffix="units/day" /></Field><Field label="Previous week demand"><NumberField value={previousWeek} onChange={setPreviousWeek} /></Field><Field label="Previous month demand"><NumberField value={previousMonth} onChange={setPreviousMonth} /></Field><Field label="Hospital requests"><NumberField value={requests} onChange={setRequests} /></Field><Field label="Emergency cases"><NumberField value={emergency} onChange={setEmergency} /></Field><Field label="Incoming donations" hint="Next 7 days"><NumberField value={donations} onChange={setDonations} /></Field></div><button disabled={loading} onClick={runPrediction} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#e2515a] px-4 py-3.5 text-sm font-bold text-white shadow-[0_8px_18px_rgba(226,81,90,0.2)] transition hover:bg-[#d74750] disabled:opacity-60">{loading ? <><LoaderCircle size={17} className="animate-spin" /> Connecting to prediction service...</> : <><Zap size={16} /> Predict demand</>}</button><p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[10px] text-[#9aa6b5]"><Database size={12} /> Connected to FastAPI prediction service</p></Panel><div className="space-y-6">{loading ? <LoadingState label="Waiting for FastAPI prediction..." /> : result ? <DemandResult result={result} /> : <Panel className="p-6"><EmptyState title="Ready to forecast" description="Select a blood group, set a forecast period and run a prediction to see the projected demand curve." /></Panel>}</div></div></div>;
}

function DemandResult({ result }: { result: ForecastResult }) { return <div className="space-y-6"><Panel className="overflow-hidden"><div className="border-b border-[#edf1f5] bg-[#fbfcfe] p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#e2515a]">Prediction result</p><h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-[#12223b]">{result.group} blood demand</h2><p className="mt-1 text-sm text-[#8290a1]">Forecast for {result.period.toLowerCase()} based on demo inputs.</p></div><div className="flex items-center gap-2 rounded-xl border border-[#d5e6dd] bg-[#f0faf5] px-3 py-2 text-xs font-semibold text-[#208a62]"><CheckCircle2 size={15} /> Ready for review</div></div></div><div className="grid divide-y divide-[#edf1f5] sm:grid-cols-3 sm:divide-x sm:divide-y-0"><div className="p-5"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#95a1b0]">Predicted demand</p><p className="mt-2 text-3xl font-bold tracking-[-0.06em] text-[#12223b]">{result.demand}<span className="ml-1.5 text-sm font-medium tracking-normal text-[#8b98a9]">units</span></p></div><div className="p-5"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#95a1b0]">Average daily demand</p><p className="mt-2 text-3xl font-bold tracking-[-0.06em] text-[#12223b]">{result.dailyAverage}<span className="ml-1.5 text-sm font-medium tracking-normal text-[#8b98a9]">units/day</span></p></div><div className="p-5"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#95a1b0]">Model / confidence</p><p className="mt-2 text-lg font-bold tracking-[-0.03em] text-[#2d6aca]">{result.model}</p><p className="mt-1 text-xs text-[#8290a1]">{result.confidence}% confidence indicator</p></div></div></Panel><Panel className="p-5 sm:p-6"><SectionHeading eyebrow="Forecast curve" title="Demand forecast" description="Expected units by day for the selected blood group." action={<span className="rounded-lg bg-[#eaf2ff] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#2d6aca]">Demo output</span>} /><div className="h-[270px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={result.forecast} margin={{ top: 10, right: 5, left: -22, bottom: 0 }}><defs><linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2d6aca" stopOpacity={0.2} /><stop offset="100%" stopColor="#2d6aca" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#eef2f7" /><XAxis dataKey="label" tick={{ fill: "#8b98a9", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#8b98a9", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip content={<ChartTooltip />} /><Area type="monotone" dataKey="demand" name="Demand" stroke="#2d6aca" strokeWidth={2.5} fill="url(#forecastFill)" /></AreaChart></ResponsiveContainer></div></Panel></div>; }

export function LegacyShortagePage({ onToast }: { onToast: (message: string) => void }) {
  const [group, setGroup] = useState<BloodGroup>("O-"); const [month] = useState(10); const [dayOfWeek] = useState(4); const [season] = useState<Season>("Summer"); const [stock, setStock] = useState(15); const [demand, setDemand] = useState(28); const [previousWeek] = useState(28); const [previousMonth] = useState(112); const [donations, setDonations] = useState(3); const [usage, setUsage] = useState(5); const [days, setDays] = useState(3); const [requests] = useState(18); const [emergency, setEmergency] = useState(5); const [loading, setLoading] = useState(false); const [result, setResult] = useState<RiskResult | null>({ group: "O-", risk: "High", stock: 15, demand: 28, gap: 13, coverage: 3, message: "Current projected stock may be insufficient to meet expected demand during the selected forecast period." });
  const runAnalysis = async () => {
    setLoading(true);
    setResult(null);
    try {
      const next = await predictShortage({ blood_group: group, month, day_of_week: dayOfWeek, season, current_blood_stock: stock, previous_demand: demand, average_daily_usage: usage, number_of_donations: donations, incoming_blood_units: donations, hospital_requests: requests, emergency_cases: emergency, previous_week_demand: previousWeek, previous_month_demand: previousMonth, days_of_stock_remaining: days });
      setResult(next);
      onToast("Shortage risk analysis completed");
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Shortage prediction failed");
    } finally {
      setLoading(false);
    }
  };
  return <div className="page-enter space-y-6"><div className="grid gap-6 xl:grid-cols-[minmax(320px,0.82fr)_minmax(0,1.18fr)]"><Panel className="p-5 sm:p-6"><div className="mb-6 flex items-start gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff0f0] text-[#e2515a]"><AlertTriangle size={19} /></span><div><h2 className="text-base font-bold text-[#12223b]">Risk inputs</h2><p className="mt-1 text-xs leading-5 text-[#8491a2]">Compare available inventory against forecasted requirements.</p></div></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Blood group"><SelectField value={group} onChange={(value) => setGroup(value as BloodGroup)}>{bloodGroups.map((bloodGroup) => <option key={bloodGroup}>{bloodGroup}</option>)}</SelectField></Field><Field label="Current stock"><NumberField value={stock} onChange={setStock} /></Field><Field label="Predicted demand"><NumberField value={demand} onChange={setDemand} /></Field><Field label="Incoming donations"><NumberField value={donations} onChange={setDonations} /></Field><Field label="Average daily usage"><NumberField value={usage} onChange={setUsage} suffix="units/day" /></Field><Field label="Days of stock remaining"><NumberField value={days} onChange={setDays} suffix="days" /></Field><Field label="Emergency requests"><NumberField value={emergency} onChange={setEmergency} /></Field></div><button disabled={loading} onClick={runAnalysis} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#12223b] px-4 py-3.5 text-sm font-bold text-white shadow-[0_8px_18px_rgba(18,34,59,0.18)] transition hover:bg-[#1c3557] disabled:opacity-60">{loading ? <><LoaderCircle size={17} className="animate-spin" /> Analyzing risk signals...</> : <><ShieldCheck size={16} /> Analyze shortage risk</>}</button><p className="mt-3 text-center text-[10px] text-[#9aa6b5]">Forecasting only. This output does not constitute medical advice.</p></Panel><div className="space-y-6">{loading ? <LoadingState label="Calculating shortage risk..." /> : result ? <RiskResultCard result={result} /> : <Panel className="p-6"><EmptyState title="No risk result yet" description="Submit the analysis form to classify stock coverage for this blood group." /></Panel>}</div></div><Panel className="p-5 sm:p-6"><SectionHeading eyebrow="Portfolio view" title="Blood shortage risk distribution" description="A quick classification snapshot across all 8 blood groups." /><div className="grid gap-7 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-center"><div className="relative mx-auto h-[210px] w-full max-w-[260px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={riskData} dataKey="value" innerRadius={65} outerRadius={86} paddingAngle={4} stroke="none">{riskData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-3xl font-bold tracking-[-0.06em] text-[#12223b]">50%</span><span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a98aa]">low risk</span></div></div><div className="grid gap-3 sm:grid-cols-3">{riskData.map((entry) => <div key={entry.name} className="rounded-xl border border-[#edf1f5] p-4"><span className="flex items-center gap-2 text-xs font-semibold text-[#64748b]"><i className="h-2 w-2 rounded-full" style={{ background: entry.color }} /> {entry.name}</span><p className="mt-3 text-2xl font-bold tracking-[-0.04em] text-[#12223b]">{entry.value}<span className="ml-1.5 text-xs font-medium tracking-normal text-[#9aa6b5]">groups</span></p><p className="mt-1 text-[11px] text-[#8b98a9]">{entry.value === 4 ? "Stock is currently sufficient" : entry.value === 2 ? "Keep under review" : "Immediate planning signal"}</p></div>)}</div></div></Panel></div>;
}

function RiskResultCard({ result }: { result: RiskResult }) { const high = result.risk === "High"; return <Panel className="overflow-hidden"><div className={`p-5 sm:p-6 ${high ? "bg-[#fff8f8]" : result.risk === "Medium" ? "bg-[#fffaf0]" : "bg-[#f4fcf8]"}`}><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-center gap-3"><span className={`flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold ${high ? "bg-[#ffe7e8] text-[#d7545c]" : result.risk === "Medium" ? "bg-[#fff0ce] text-[#c18325]" : "bg-[#dff5e9] text-[#208a62]"}`}>{result.group}</span><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8a98aa]">Shortage risk</p><h2 className={`mt-1 text-2xl font-bold tracking-[-0.04em] ${high ? "text-[#c9434d]" : "text-[#12223b]"}`}>{result.risk}</h2></div></div><RiskBadge risk={result.risk} /></div><div className="mt-7 grid gap-4 sm:grid-cols-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#95a1b0]">Current stock</p><p className="mt-1.5 text-2xl font-bold text-[#12223b]">{result.stock}<span className="ml-1 text-xs font-medium text-[#8b98a9]">units</span></p></div><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#95a1b0]">Predicted demand</p><p className="mt-1.5 text-2xl font-bold text-[#12223b]">{result.demand}<span className="ml-1 text-xs font-medium text-[#8b98a9]">units</span></p></div><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#95a1b0]">Expected gap</p><p className={`mt-1.5 text-2xl font-bold ${result.gap ? "text-[#d7545c]" : "text-[#208a62]"}`}>{result.gap}<span className="ml-1 text-xs font-medium text-[#8b98a9]">units</span></p></div></div></div><div className="space-y-3 p-5 sm:p-6"><StatusMessage type={result.gap ? "error" : "success"}>{result.message}</StatusMessage><div className="flex items-start gap-3 rounded-xl bg-[#f7f9fc] p-3.5"><ClipboardCheck size={16} className="mt-0.5 shrink-0 text-[#2d6aca]" /><p className="text-xs leading-5 text-[#718096]"><span className="font-bold text-[#52657e]">Suggested action:</span> Review inventory and consider additional donor outreach or stock coordination. This is an operational prompt, not medical advice.</p></div></div></Panel>; }

export function LegacyInventoryPage() {
  const [query, setQuery] = useState(""); const [risk, setRisk] = useState<"All risks" | RiskLevel>("All risks"); const [group, setGroup] = useState("All groups"); const [sort, setSort] = useState("group"); const [currentPage, setCurrentPage] = useState(1); const pageSize = 5;
  const filtered = useMemo(() => inventory.filter((item) => item.group.toLowerCase().includes(query.toLowerCase()) && (risk === "All risks" || item.risk === risk) && (group === "All groups" || item.group === group)).sort((a, b) => sort === "stock" ? b.stock - a.stock : sort === "risk" ? ({ High: 0, Medium: 1, Low: 2 }[a.risk] - { High: 0, Medium: 1, Low: 2 }[b.risk]) : a.group.localeCompare(b.group)), [query, risk, group, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize)); const shown = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  return <div className="page-enter space-y-6"><Panel className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf1f5] p-5 sm:p-6"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#e2515a]">Operations console</p><h2 className="mt-1.5 text-lg font-bold tracking-[-0.025em] text-[#12223b]">Inventory levels</h2></div><button className="inline-flex items-center gap-2 rounded-xl border border-[#dfe6ef] bg-white px-3.5 py-2.5 text-xs font-semibold text-[#52657e] transition hover:border-[#cdd8e5]"><Download size={14} /> Export view</button></div><div className="flex flex-col gap-3 border-b border-[#edf1f5] bg-[#fbfcfe] p-4 sm:flex-row sm:flex-wrap"><div className="relative min-w-[210px] flex-1"><Search size={16} className="absolute left-3.5 top-3 text-[#98a5b5]" /><input value={query} onChange={(event) => { setQuery(event.target.value); setCurrentPage(1); }} placeholder="Search blood group..." className="w-full rounded-xl border border-[#dfe6ef] bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#2d6aca] focus:ring-4 focus:ring-[#2d6aca]/10" /></div><div className="flex flex-wrap gap-2"><div className="relative"><select value={group} onChange={(event) => { setGroup(event.target.value); setCurrentPage(1); }} className="h-full appearance-none rounded-xl border border-[#dfe6ef] bg-white py-2.5 pl-3 pr-9 text-xs font-semibold text-[#52657e] outline-none"><option>All groups</option>{bloodGroups.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={14} className="pointer-events-none absolute right-3 top-3 text-[#8b98a9]" /></div><div className="relative"><select value={risk} onChange={(event) => { setRisk(event.target.value as "All risks" | RiskLevel); setCurrentPage(1); }} className="h-full appearance-none rounded-xl border border-[#dfe6ef] bg-white py-2.5 pl-3 pr-9 text-xs font-semibold text-[#52657e] outline-none"><option>All risks</option><option>Low</option><option>Medium</option><option>High</option></select><ChevronDown size={14} className="pointer-events-none absolute right-3 top-3 text-[#8b98a9]" /></div><div className="relative"><select value={sort} onChange={(event) => setSort(event.target.value)} className="h-full appearance-none rounded-xl border border-[#dfe6ef] bg-white py-2.5 pl-3 pr-9 text-xs font-semibold text-[#52657e] outline-none"><option value="group">Sort: A-Z</option><option value="stock">Sort: stock</option><option value="risk">Sort: risk</option></select><ChevronDown size={14} className="pointer-events-none absolute right-3 top-3 text-[#8b98a9]" /></div></div></div><div className="custom-scrollbar overflow-x-auto"><table className="w-full min-w-[850px] text-left"><thead><tr className="border-b border-[#edf1f5] bg-white text-[10px] font-bold uppercase tracking-[0.14em] text-[#94a0b0]"><th className="px-5 py-4 sm:px-6">Blood group</th><th className="px-4 py-4">Current stock</th><th className="px-4 py-4">Daily usage</th><th className="px-4 py-4">Incoming</th><th className="px-4 py-4">Predicted demand</th><th className="px-4 py-4">Coverage</th><th className="px-4 py-4">Risk</th><th className="px-4 py-4" /></tr></thead><tbody>{shown.map((item) => <tr key={item.group} className="border-b border-[#f0f3f7] last:border-0 hover:bg-[#fbfcfe]"><td className="px-5 py-4 sm:px-6"><div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#edf3fc] text-xs font-bold text-[#2d6aca]">{item.group}</span><div><p className="text-xs font-bold text-[#344862]">{item.group} positive</p><p className="mt-0.5 text-[10px] text-[#9aa6b5]">Updated 18 min ago</p></div></div></td><td className="px-4 py-4 text-sm font-bold text-[#263852]">{item.stock} <span className="text-[10px] font-medium text-[#9aa6b5]">units</span></td><td className="px-4 py-4 text-sm text-[#52657e]">{item.dailyUsage} <span className="text-[10px] text-[#9aa6b5]">/ day</span></td><td className="px-4 py-4 text-sm font-semibold text-[#208a62]">+{item.incoming}</td><td className="px-4 py-4 text-sm font-semibold text-[#52657e]">{item.demand}</td><td className="px-4 py-4 text-sm text-[#52657e]">{item.coverage} days</td><td className="px-4 py-4"><RiskBadge risk={item.risk} compact /></td><td className="px-4 py-4 text-right"><button aria-label={`More actions for ${item.group}`} className="rounded-lg p-1.5 text-[#9aa6b5] hover:bg-[#f1f5f9] hover:text-[#52657e]"><MoreHorizontal size={17} /></button></td></tr>)}</tbody></table></div>{shown.length === 0 ? <div className="p-5"><EmptyState title="No inventory matches" description="Try changing your search or filters to see other blood groups." /></div> : null}<div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edf1f5] px-5 py-4 text-xs sm:px-6"><span className="text-[#8b98a9]">Showing <b className="text-[#52657e]">{filtered.length ? (currentPage - 1) * pageSize + 1 : 0}-{Math.min(currentPage * pageSize, filtered.length)}</b> of <b className="text-[#52657e]">{filtered.length}</b> groups</span><div className="flex items-center gap-1.5"><button disabled={currentPage === 1} onClick={() => setCurrentPage((page) => page - 1)} className="rounded-lg border border-[#e1e7ef] p-1.5 text-[#718096] disabled:opacity-40"><ChevronLeft size={15} /></button>{Array.from({ length: pages }, (_, index) => index + 1).map((number) => <button key={number} onClick={() => setCurrentPage(number)} className={`h-7 min-w-7 rounded-lg px-2 text-xs font-semibold ${number === currentPage ? "bg-[#12223b] text-white" : "text-[#718096] hover:bg-[#f1f5f9]"}`}>{number}</button>)}<button disabled={currentPage === pages} onClick={() => setCurrentPage((page) => page + 1)} className="rounded-lg border border-[#e1e7ef] p-1.5 text-[#718096] disabled:opacity-40"><ChevronRight size={15} /></button></div></div></Panel></div>;
}

export function LegacyAnalyticsPage() {
  const [range, setRange] = useState("Last 30 days");
  return <div className="page-enter space-y-6"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-[#8290a1]">A cross-functional view of demand and inventory movement.</p><div className="flex items-center gap-2 rounded-xl border border-[#dfe6ef] bg-white px-3 py-2"><CalendarDays size={14} className="text-[#8b98a9]" /><select value={range} onChange={(event) => setRange(event.target.value)} className="bg-transparent text-xs font-semibold text-[#52657e] outline-none"><option>Last 7 days</option><option>Last 30 days</option><option>Last 90 days</option></select></div></div><div className="grid gap-6 xl:grid-cols-2"><Panel className="p-5 sm:p-6"><SectionHeading title="Historical blood demand" description={`Daily units requested · ${range.toLowerCase()}`} /><div className="h-[250px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={demandForecast} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}><CartesianGrid vertical={false} stroke="#eef2f7" /><XAxis dataKey="label" tick={{ fill: "#8b98a9", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#8b98a9", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip content={<ChartTooltip />} /><Line type="monotone" dataKey="demand" name="Demand" stroke="#e2515a" strokeWidth={2.5} dot={false} /></LineChart></ResponsiveContainer></div></Panel><Panel className="p-5 sm:p-6"><SectionHeading title="Blood stock trend" description="Available units compared with demand over time." /><div className="h-[250px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={stockTrend} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}><defs><linearGradient id="stockFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#35a879" stopOpacity={0.22} /><stop offset="100%" stopColor="#35a879" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#eef2f7" /><XAxis dataKey="label" tick={{ fill: "#8b98a9", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#8b98a9", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip content={<ChartTooltip />} /><Area type="monotone" dataKey="stock" name="Available" stroke="#35a879" fill="url(#stockFill)" strokeWidth={2} /><Line type="monotone" dataKey="demand" name="Demand" stroke="#e4a23b" strokeWidth={2} dot={false} /></AreaChart></ResponsiveContainer></div></Panel><Panel className="p-5 sm:p-6"><SectionHeading title="Demand vs available stock" description="Aggregated units by day." /><div className="h-[250px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={stockTrend} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}><CartesianGrid vertical={false} stroke="#eef2f7" /><XAxis dataKey="label" tick={{ fill: "#8b98a9", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#8b98a9", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip content={<ChartTooltip />} /><Bar dataKey="stock" name="Available" fill="#2d6aca" radius={[4, 4, 0, 0]} /><Bar dataKey="demand" name="Demand" fill="#e5a340" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></Panel><Panel className="p-5 sm:p-6"><SectionHeading title="Blood group demand distribution" description="Expected 7-day demand by group." /><div className="h-[250px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={demandMix} layout="vertical" margin={{ top: 8, right: 12, left: -4, bottom: 0 }}><CartesianGrid horizontal={false} stroke="#eef2f7" /><XAxis type="number" tick={{ fill: "#8b98a9", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="group" tick={{ fill: "#52657e", fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} width={34} /><Tooltip content={<ChartTooltip />} /><Bar dataKey="demand" name="Demand" fill="#e2515a" radius={[0, 5, 5, 0]} barSize={16} /></BarChart></ResponsiveContainer></div></Panel></div><Panel className="p-5 sm:p-6"><SectionHeading title="Shortage risk distribution" description="Risk classification for the current inventory snapshot." /><div className="flex flex-col items-center gap-7 md:flex-row"><div className="relative h-[210px] w-full max-w-[270px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={riskData} dataKey="value" innerRadius={62} outerRadius={86} paddingAngle={4} stroke="none">{riskData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip content={<ChartTooltip />} /></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-3xl font-bold tracking-[-0.06em] text-[#12223b]">8</span><span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a98aa]">groups</span></div></div><div className="grid w-full gap-3 sm:grid-cols-3">{riskData.map((entry) => <div key={entry.name} className="border-l-2 pl-4" style={{ borderColor: entry.color }}><p className="text-xs font-semibold text-[#64748b]">{entry.name}</p><p className="mt-2 text-2xl font-bold text-[#12223b]">{entry.value}</p><p className="mt-1 text-[11px] text-[#8b98a9]">{Math.round((entry.value / 8) * 100)}% of groups</p></div>)}</div></div></Panel></div>;
}

export function LegacyModelsPage() {
  const [demandMetric, setDemandMetric] = useState<"mae" | "rmse" | "r2">("mae"); const [classMetric, setClassMetric] = useState<"accuracy" | "precision" | "recall" | "f1">("accuracy"); const demandMetricLabel = { mae: "MAE", rmse: "RMSE", r2: "R²" }[demandMetric]; const classMetricLabel = { accuracy: "Accuracy", precision: "Precision", recall: "Recall", f1: "F1 Score" }[classMetric];
  return <div className="page-enter space-y-6"><div className="rounded-2xl border border-[#dbe6f3] bg-[#f1f6fd] p-4 sm:p-5"><div className="flex items-start gap-3"><Info size={17} className="mt-0.5 shrink-0 text-[#2d6aca]" /><div><p className="text-sm font-bold text-[#244e86]">Demo values — replace with actual experimental results.</p><p className="mt-1 text-xs leading-5 text-[#597495]">The metrics below are illustrative UI data for the project presentation and are not a claim about production model performance.</p></div></div></div><div className="grid gap-6 xl:grid-cols-2"><ModelTable title="Demand prediction models" columns={["Model", "MAE", "RMSE", "R²"]} rows={demandModels.map((model) => [model.model, model.mae.toFixed(1), model.rmse.toFixed(1), model.r2.toFixed(2)])} highlight="XGBoost" /><ModelTable title="Shortage classification models" columns={["Model", "Accuracy", "Precision", "Recall", "F1-Score"]} rows={classificationModels.map((model) => [model.model, `${model.accuracy}%`, `${model.precision}%`, `${model.recall}%`, `${model.f1}%`])} highlight="XGBoost" /></div><div className="grid gap-6 xl:grid-cols-2"><Panel className="p-5 sm:p-6"><SectionHeading title="Demand model comparison" description="Switch the metric to compare demo regression results." action={<MetricSelect value={demandMetric} onChange={(value) => setDemandMetric(value as "mae" | "rmse" | "r2")} options={[["mae", "MAE"], ["rmse", "RMSE"], ["r2", "R²"]]} />} /><div className="h-[250px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={demandModels.map((item) => ({ name: item.model.replace("Linear Regression", "Linear Reg."), value: item[demandMetric] }))} layout="vertical" margin={{ top: 5, right: 10, left: 6, bottom: 0 }}><CartesianGrid horizontal={false} stroke="#eef2f7" /><XAxis type="number" domain={demandMetric === "r2" ? [0, 1] : [0, "auto"]} tick={{ fill: "#8b98a9", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="name" tick={{ fill: "#52657e", fontSize: 11 }} axisLine={false} tickLine={false} width={76} /><Tooltip content={<ChartTooltip />} /><Bar dataKey="value" name={demandMetricLabel} fill="#2d6aca" radius={[0, 5, 5, 0]} barSize={22} /></BarChart></ResponsiveContainer></div></Panel><Panel className="p-5 sm:p-6"><SectionHeading title="Classification model comparison" description="Switch the metric to compare demo classification results." action={<MetricSelect value={classMetric} onChange={(value) => setClassMetric(value as "accuracy" | "precision" | "recall" | "f1")} options={[["accuracy", "Accuracy"], ["precision", "Precision"], ["recall", "Recall"], ["f1", "F1 Score"]]} />} /><div className="h-[250px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={classificationModels.map((item) => ({ name: item.model, value: item[classMetric] }))} margin={{ top: 8, right: 10, left: -22, bottom: 0 }}><CartesianGrid vertical={false} stroke="#eef2f7" /><XAxis dataKey="name" tick={{ fill: "#52657e", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} tick={{ fill: "#8b98a9", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip content={<ChartTooltip />} /><ReferenceLine y={90} stroke="#d8e1ec" strokeDasharray="4 4" /><Bar dataKey="value" name={classMetricLabel} fill="#e2515a" radius={[5, 5, 0, 0]} barSize={34} /></BarChart></ResponsiveContainer></div></Panel></div><XGBoostSection /></div>;
}

function MetricSelect({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: [string, string][] }) { return <div className="relative"><select value={value} onChange={(event) => onChange(event.target.value)} className="appearance-none rounded-lg border border-[#dfe6ef] bg-white py-2 pl-2.5 pr-7 text-[11px] font-bold text-[#52657e] outline-none">{options.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><ChevronDown size={12} className="pointer-events-none absolute right-2 top-2.5 text-[#8b98a9]" /></div>; }
function ModelTable({ title, columns, rows, highlight }: { title: string; columns: string[]; rows: string[][]; highlight: string }) { return <Panel className="overflow-hidden"><div className="border-b border-[#edf1f5] px-5 py-5 sm:px-6"><h2 className="text-base font-bold text-[#12223b]">{title}</h2><p className="mt-1 text-xs text-[#8a98aa]">Illustrative benchmark comparison</p></div><div className="custom-scrollbar overflow-x-auto"><table className="w-full min-w-[440px] text-left"><thead><tr className="bg-[#fbfcfe] text-[10px] font-bold uppercase tracking-[0.12em] text-[#95a1b0]">{columns.map((column) => <th key={column} className="px-5 py-3.5 first:px-5 sm:first:px-6">{column}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row[0]} className="border-t border-[#f0f3f7] text-sm"><td className="px-5 py-4 font-semibold text-[#344862] sm:px-6">{row[0]} {row[0] === highlight ? <span className="ml-1 rounded bg-[#eaf2ff] px-1.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-[#2d6aca]">Proposed</span> : null}</td>{row.slice(1).map((cell, index) => <td key={`${row[0]}-${index}`} className={`px-5 py-4 font-semibold ${row[0] === highlight ? "text-[#2d6aca]" : "text-[#52657e]"}`}>{cell}</td>)}</tr>)}</tbody></table></div></Panel>; }

function XGBoostSection() { const features = [{ icon: Database, title: "Structured data", text: "Excellent for tabular blood-bank datasets." }, { icon: GitBranch, title: "Nonlinear relationships", text: "Learns complex relationships across stock, demand and emergency cases." }, { icon: Layers3, title: "Feature interactions", text: "Captures how multiple operational variables influence each other." }, { icon: TrendingUp, title: "Predictive performance", text: "A strong candidate for structured-data regression and classification." }]; return <Panel className="overflow-hidden"><div className="grid gap-0 lg:grid-cols-[0.8fr_1.2fr]"><div className="bg-[#12223b] p-6 text-white sm:p-8"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e2515a]"><BrainCircuit size={22} /></div><p className="mt-8 text-[10px] font-bold uppercase tracking-[0.2em] text-[#8fa7c8]">Model rationale</p><h2 className="mt-2 text-2xl font-bold tracking-[-0.04em]">Why XGBoost?</h2><p className="mt-4 max-w-sm text-sm leading-6 text-[#b1bfd2]">It is the proposed primary model for BloodSight, selected as a strong candidate for the mixed operational signals in this project.</p><div className="mt-8 flex flex-wrap items-center gap-2 text-[11px] font-semibold"><span className="rounded-lg border border-white/15 px-2.5 py-2 text-[#b1bfd2]">Linear Regression</span><ArrowRight size={14} className="text-[#778eae" /><span className="rounded-lg border border-white/15 px-2.5 py-2 text-[#b1bfd2]">Random Forest</span><ArrowRight size={14} className="text-[#778eae" /><span className="rounded-lg border border-[#e2515a]/50 bg-[#e2515a]/15 px-2.5 py-2 text-[#f3b9bb]">XGBoost</span></div><p className="mt-5 text-[11px] leading-5 text-[#8fa0b8]">Performance comparison <span className="mx-1">→</span> final model selection</p></div><div className="grid gap-0 sm:grid-cols-2">{features.map((feature) => { const Icon = feature.icon; return <div key={feature.title} className="border-b border-[#edf1f5] p-6 last:border-0 sm:border-r sm:p-7 lg:border-b-0"><Icon size={19} className="text-[#2d6aca]" /><h3 className="mt-5 text-sm font-bold text-[#344862]">{feature.title}</h3><p className="mt-2 text-xs leading-5 text-[#8391a3]">{feature.text}</p></div>; })}</div></div><div className="border-t border-[#edf1f5] bg-[#fbfcfe] px-6 py-4 sm:px-8"><p className="text-xs font-semibold text-[#52657e]"><span className="text-[#e2515a]">Important:</span> XGBoost is the proposed primary model. Final model selection will be based on actual experimental evaluation.</p></div></Panel>; }

function AboutPage({ onNavigate }: { onNavigate: (page: PageKey) => void }) { return <div className="page-enter space-y-6"><div className="overflow-hidden rounded-2xl bg-[#12223b] p-6 text-white sm:p-9"><div className="max-w-3xl"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e2515a]"><Droplets size={20} /></span><span className="text-lg font-bold tracking-[-0.03em]">BloodSight</span></div><p className="mt-9 text-[10px] font-bold uppercase tracking-[0.22em] text-[#8fa7c8]">Full project name</p><h1 className="mt-2 text-3xl font-bold tracking-[-0.05em] sm:text-4xl">Blood Bank Demand &amp; Shortage Prediction Using Machine Learning</h1><p className="mt-4 max-w-2xl text-base leading-7 text-[#b6c4d6]">A forecasting and decision-support interface that helps blood-bank teams anticipate requirements, spot possible shortages and plan with more confidence.</p><p className="mt-7 text-sm font-semibold text-[#f0b0b2]">“Predict Demand. Detect Shortages. Plan Better.”</p></div></div><div className="grid gap-6 lg:grid-cols-2"><Panel className="p-6 sm:p-7"><SectionHeading eyebrow="Project brief" title="Objective" /><p className="text-sm leading-7 text-[#718096]">Predict future blood requirements and identify potential blood-stock shortages using machine learning. The system is designed for forecasting and operational decision support only, not clinical decision-making.</p><div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-[#f7f9fc] p-4"><TrendingUp size={18} className="text-[#2d6aca]" /><p className="mt-4 text-sm font-bold text-[#344862]">Demand prediction</p><p className="mt-1 text-xs text-[#8491a2]">Regression task</p></div><div className="rounded-xl bg-[#fff7f7] p-4"><AlertTriangle size={18} className="text-[#e2515a]" /><p className="mt-4 text-sm font-bold text-[#344862]">Shortage prediction</p><p className="mt-1 text-xs text-[#8491a2]">Multi-class classification</p></div></div></Panel><Panel className="p-6 sm:p-7"><SectionHeading eyebrow="Technical foundation" title="Algorithms & evaluation" /><div className="space-y-4"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#9aa6b5]">Algorithms</p><p className="mt-2 text-sm font-semibold text-[#52657e]">Linear Regression <span className="mx-1.5 text-[#cbd5e1]">•</span> Random Forest <span className="mx-1.5 text-[#cbd5e1]">•</span> XGBoost</p></div><div className="border-t border-[#edf1f5] pt-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#9aa6b5]">Demand metrics</p><p className="mt-2 text-sm font-semibold text-[#52657e]">MAE <span className="mx-1.5 text-[#cbd5e1]">•</span> RMSE <span className="mx-1.5 text-[#cbd5e1]">•</span> R²</p></div><div className="border-t border-[#edf1f5] pt-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#9aa6b5]">Shortage metrics</p><p className="mt-2 text-sm font-semibold text-[#52657e]">Accuracy <span className="mx-1.5 text-[#cbd5e1]">•</span> Precision <span className="mx-1.5 text-[#cbd5e1]">•</span> Recall <span className="mx-1.5 text-[#cbd5e1]">•</span> F1-score</p></div></div></Panel></div><Panel className="p-6 sm:p-7"><SectionHeading eyebrow="Implementation path" title="Ready for a FastAPI backend" description="The frontend already separates presentation from prediction services." action={<button onClick={() => onNavigate("models")} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2d6aca]">View model performance <ArrowRight size={14} /></button>} /><div className="grid gap-3 md:grid-cols-4">{[{ icon: Database, label: "Python / Pandas", detail: "Data pipeline" }, { icon: BrainCircuit, label: "Scikit-learn / XGBoost", detail: "ML models" }, { icon: Zap, label: "FastAPI", detail: "Prediction API" }, { icon: Activity, label: "React / TypeScript", detail: "This interface" }].map((item, index) => { const Icon = item.icon; return <div key={item.label} className="relative flex items-center gap-3 rounded-xl border border-[#edf1f5] p-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#edf3fc] text-[#2d6aca]"><Icon size={17} /></span><span><span className="block text-xs font-bold text-[#344862]">{item.label}</span><span className="mt-1 block text-[10px] text-[#8b98a9]">{item.detail}</span></span>{index < 3 ? <ArrowRight size={14} className="absolute -right-2.5 z-10 hidden bg-white text-[#aab6c4] md:block" /> : null}</div>; })}</div><div className="mt-6 flex items-start gap-3 rounded-xl bg-[#f7f9fc] p-4"><Settings2 size={16} className="mt-0.5 shrink-0 text-[#2d6aca]" /><p className="text-xs leading-5 text-[#718096]"><span className="font-bold text-[#52657e]">API contract:</span> <code className="rounded bg-white px-1.5 py-0.5 text-[11px] text-[#2d6aca]">POST /api/predict/demand</code> <code className="ml-1 rounded bg-white px-1.5 py-0.5 text-[11px] text-[#2d6aca]">POST /api/predict/shortage</code> <code className="ml-1 rounded bg-white px-1.5 py-0.5 text-[11px] text-[#2d6aca]">GET /api/inventory</code></p></div></Panel></div>; }

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(() => getStoredAuthSession());
  const [resetToken, setResetToken] = useState<string | null>(() => {
    const queryToken = new URLSearchParams(window.location.search).get("reset_token");
    if (queryToken) {
      sessionStorage.setItem(RESET_TOKEN_STORAGE_KEY, queryToken);
      return queryToken;
    }
    return sessionStorage.getItem(RESET_TOKEN_STORAGE_KEY);
  });
  const [page, setPage] = useState<PageKey>(() => pageFromLocation(session));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const toastTimer = useRef<number | null>(null);
  const navigate = useCallback((requestedPage: PageKey) => {
    let nextPage = requestedPage;
    const isAuthenticated = Boolean(session && session.expires_at > Date.now());
    if (protectedPages.has(nextPage) && !isAuthenticated) {
      if (session) {
        clearAuthSession();
        setSession(null);
      }
      nextPage = "login";
    }
    if (isAuthenticated && ["login", "register", "forgotPassword"].includes(nextPage)) nextPage = "dashboard";
    window.history.pushState(null, "", pagePaths[nextPage]);
    setPage(nextPage);
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [session]);
  const showToast = useCallback((message: string) => { setToast(message); if (toastTimer.current !== null) window.clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setToast(null), 2800); }, []);
  useEffect(() => () => { if (toastTimer.current !== null) window.clearTimeout(toastTimer.current); }, []);
  useEffect(() => {
    const syncLocation = () => {
      const queryToken = new URLSearchParams(window.location.search).get("reset_token");
      if (queryToken) {
        sessionStorage.setItem(RESET_TOKEN_STORAGE_KEY, queryToken);
        setResetToken(queryToken);
      }
      const nextPage = pageFromLocation(session);
      setPage(nextPage);
      const currentUrl = new URL(window.location.href);
      const targetSearch = nextPage === "resetPassword" && queryToken
        ? `?reset_token=${encodeURIComponent(queryToken)}`
        : "";
      if (currentUrl.pathname !== pagePaths[nextPage] || currentUrl.search !== targetSearch) {
        window.history.replaceState(null, "", `${pagePaths[nextPage]}${targetSearch}`);
      }
      setMobileOpen(false);
    };
    syncLocation();
    window.addEventListener("popstate", syncLocation);
    return () => window.removeEventListener("popstate", syncLocation);
  }, [session]);
  useEffect(() => {
    const resetUrl = new URL(window.location.href);
    if (resetUrl.searchParams.has("reset_token")) {
      resetUrl.searchParams.delete("reset_token");
      window.history.replaceState(null, "", resetUrl);
    }
  }, []);
  const expireSession = useCallback(() => {
    clearAuthSession();
    setSession(null);
    setPage("login");
    setMobileOpen(false);
    window.history.replaceState(null, "", pagePaths.login);
    showToast("Your session expired. Please sign in again.");
  }, [showToast]);
  useEffect(() => {
    if (!session) return;
    const remainingMs = session.expires_at - Date.now();
    if (remainingMs <= 0) {
      expireSession();
      return;
    }
    const timer = window.setTimeout(expireSession, remainingMs);
    return () => window.clearTimeout(timer);
  }, [session, expireSession]);
  const handleAuthenticated = (nextSession: AuthSession) => {
    setSession(nextSession);
    setPage("dashboard");
    setMobileOpen(false);
    window.history.pushState(null, "", pagePaths.dashboard);
    showToast("Signed in successfully");
  };
  const handleLogout = async () => {
    if (!session) return;
    setIsSigningOut(true);
    try {
      await logoutAccount(session.access_token);
      showToast("Signed out successfully");
    } catch {
      showToast("Signed out on this device; the server could not revoke the session.");
    } finally {
      clearAuthSession();
      setSession(null);
      setIsSigningOut(false);
      setPage("login");
      setMobileOpen(false);
      window.history.replaceState(null, "", pagePaths.login);
    }
  };
  const renderPage = () => {
    switch (page) {
      case "dashboard": return <Dashboard onNavigate={navigate} onToast={showToast} />;
      case "demand": return <DemandPage onToast={showToast} />;
      case "shortage": return <ShortagePage onToast={showToast} />;
      case "inventory": return <InventoryPage />;
      case "analytics": return <AnalyticsPage />;
      case "models": return <ModelsPage />;
      case "about": return <AboutPage onNavigate={navigate} />;
      case "register":
      case "login": return <AuthPage mode={page} onModeChange={navigate} onForgotPassword={() => navigate("forgotPassword")} onClose={() => navigate(session ? "dashboard" : "login")} onAuthenticated={handleAuthenticated} />;
      case "forgotPassword": return <PasswordRecoveryPage mode="forgot" token={null} onBack={() => navigate("login")} onClose={() => navigate(session ? "dashboard" : "login")} />;
      case "resetPassword": return <PasswordRecoveryPage mode="reset" token={resetToken} onBack={() => { sessionStorage.removeItem(RESET_TOKEN_STORAGE_KEY); setResetToken(null); navigate("forgotPassword"); }} onClose={() => navigate(session ? "dashboard" : "login")} onResetComplete={() => { sessionStorage.removeItem(RESET_TOKEN_STORAGE_KEY); setResetToken(null); clearAuthSession(); setSession(null); showToast("Password reset. Sign in with your new password."); setPage("login"); window.history.replaceState(null, "", pagePaths.login); }} />;
      case "notFound": return <AuthShell mode="login" onClose={() => navigate(session ? "dashboard" : "login")}><div className="space-y-4 text-center"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d71918]">404 error</p><h2 className="text-2xl font-bold text-[#171b20]">Page not found</h2><p className="text-sm leading-6 text-[#70777d]">That address doesn’t match a BloodSight page.</p><button onClick={() => navigate(session ? "dashboard" : "login")} className="w-full rounded-xl bg-[#d71918] px-4 py-3.5 text-base font-bold text-white transition hover:bg-[#bd1515]">{session ? "Return to dashboard" : "Go to login"}</button></div></AuthShell>;
    }
  };
  const isAuthPage = page === "login" || page === "register" || page === "forgotPassword" || page === "resetPassword" || page === "notFound";
  if (isAuthPage) return <div className="auth-app"><Suspense fallback={<LoadingState label="Loading account page" />}>{renderPage()}</Suspense>{toast ? <div className="fixed bottom-5 right-5 z-[70] flex max-w-[310px] items-center gap-2.5 rounded-xl border border-[#f2d1d0] bg-white px-4 py-3 text-xs font-semibold text-[#723d3c] shadow-[0_15px_38px_rgba(25,47,80,0.17)]"><Check size={15} className="text-[#d71918" />{toast}</div> : null}</div>;
  return <div className="app-shell"><Sidebar page={page} onNavigate={navigate} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} user={session?.user ?? null} onLogout={() => void handleLogout()} isSigningOut={isSigningOut} /><div className="lg:pl-[260px]"><TopNavbar page={page} onMenu={() => setMobileOpen(true)} onToast={showToast} /><main className="mx-auto max-w-[1720px] p-5 sm:p-8 lg:p-10"><Suspense fallback={<LoadingState label="Loading view" />}>{renderPage()}</Suspense><footer className="mt-10 flex flex-col gap-2 border-t border-[#e5eaf1] pt-5 text-[10px] text-[#93a0af] sm:flex-row sm:items-center sm:justify-between"><span>BloodSight · Live backend data</span><span>Forecasting only, not medical advice</span></footer></main></div>{toast ? <div className="fixed bottom-5 right-5 z-[70] flex max-w-[310px] items-center gap-2.5 rounded-xl border border-[#d5e6dd] bg-white px-4 py-3 text-xs font-semibold text-[#355e4b] shadow-[0_15px_38px_rgba(25,47,80,0.17)]"><Check size={15} className="text-[#35a879" />{toast}</div> : null}</div>;
}