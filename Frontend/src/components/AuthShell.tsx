import { Activity, AlertTriangle, BarChart3, Droplets, Package, Plus, Users, X } from "lucide-react";
import type { ReactNode } from "react";

const features = [
  { label: "Demand prediction", icon: BarChart3 },
  { label: "Inventory management", icon: Droplets },
  { label: "Shortage alerts", icon: AlertTriangle },
  { label: "Emergency response", icon: Users },
];

export function AuthShell({
  mode,
  onClose,
  children,
}: {
  mode: "login" | "register" | "forgot" | "reset";
  onClose: () => void;
  children: ReactNode;
}) {
  const recovery = mode === "forgot" || mode === "reset";

  return (
    <main className="auth-art relative grid min-h-[100svh] overflow-hidden text-[#171b20] lg:grid-cols-[1.08fr_0.92fr]">
      <button
        type="button"
        aria-label="Close sign in"
        onClick={onClose}
        className="absolute right-5 top-5 z-20 grid h-11 w-11 place-items-center rounded-full text-[#d71918] transition hover:bg-[#ffe8e7] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e52622]/20 sm:right-8 sm:top-7"
      >
        <X size={31} strokeWidth={2.1} />
      </button>

      <section className="relative flex min-h-[370px] items-center justify-center px-6 pb-10 pt-16 sm:px-12 lg:min-h-[100svh] lg:px-12 lg:py-14 xl:px-[8vw]">
        <div className="relative z-10 w-full max-w-[670px] text-center">
          <div className="relative mx-auto mb-5 grid h-[138px] w-[148px] place-items-center sm:h-[172px] sm:w-[184px]">
            <div className="absolute inset-2 rounded-full bg-white/65" />
            <Droplets className="relative h-[98px] w-[98px] fill-[#ed211c] text-[#ed211c] sm:h-[124px] sm:w-[124px]" strokeWidth={1.5} />
            <Plus className="absolute left-[43px] top-[52px] h-[45px] w-[45px] text-white sm:left-[55px] sm:top-[65px] sm:h-[52px] sm:w-[52px]" strokeWidth={5} />
            <div className="absolute bottom-3 right-1 flex items-end gap-1 text-[#d91d19] sm:bottom-4 sm:right-2">
              <span className="h-5 w-3 rounded-t bg-current sm:h-7 sm:w-4" />
              <span className="h-8 w-3 rounded-t bg-current sm:h-10 sm:w-4" />
              <Activity className="mb-7 h-11 w-11 -rotate-12 sm:mb-9 sm:h-14 sm:w-14" strokeWidth={3} />
            </div>
          </div>

          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.24em] text-[#c63734]">BloodSight</p>
          <h1 className="text-[30px] font-extrabold leading-tight sm:text-[40px]">Blood Bank <span className="text-[#d71918]">Prediction</span></h1>
          <p className="mt-2 text-base font-medium text-[#626a70] sm:text-[21px]">AI-Based Blood Demand Forecasting</p>
          <p className="mx-auto mt-5 w-fit rounded-full bg-[#fce9e8] px-6 py-2 text-sm font-bold text-[#ac211e] sm:text-base">Predict <span className="mx-2 text-[#ed625d]">·</span> Plan <span className="mx-2 text-[#ed625d]">·</span> Save Lives</p>

          <div className="mx-auto mt-8 grid max-w-[620px] grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-4 sm:gap-3">
            {features.map(({ label, icon: Icon }) => (
              <div key={label} className="flex flex-col items-center gap-2 text-center">
                <span className="grid h-14 w-14 place-items-center rounded-[17px] bg-[#ffe3e2] text-[#d71918] sm:h-16 sm:w-16">
                  <Icon size={29} strokeWidth={2.3} />
                </span>
                <span className="max-w-[112px] text-[11px] font-semibold leading-[1.25] text-[#272b2f] sm:text-xs">{label}</span>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-8 hidden h-7 max-w-[540px] items-center justify-center gap-1 opacity-35 lg:flex" aria-hidden="true">
            {[14, 8, 25, 13, 31, 12, 19, 9, 27, 12, 20, 8, 28, 13, 22, 9, 16, 7, 24, 12, 18, 8, 25].map((height, index) => (
              <span key={index} className="w-[3px] rounded-full bg-[#ef7c79]" style={{ height }} />
            ))}
          </div>
          <p className="mt-5 hidden items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8c6665] lg:flex">
            <Package size={13} /> {recovery ? "Secure account recovery" : "Smarter blood-bank planning"}
          </p>
        </div>
      </section>

      <section className="relative flex min-h-[430px] items-center justify-center px-4 pb-8 sm:px-10 sm:pb-12 lg:min-h-[100svh] lg:px-10 lg:py-16 xl:px-[5vw]">
        <div className="w-full max-w-[590px] rounded-[22px] border border-white bg-white/90 px-6 py-7 shadow-[0_20px_70px_rgba(146,48,45,0.09)] sm:px-10 sm:py-10 lg:px-11 lg:py-12">
          {children}
        </div>
      </section>
    </main>
  );
}