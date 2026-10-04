import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, LogIn, Mail } from "lucide-react";
import type { AuthSession } from "../types";
import { loginAccount, registerAccount } from "../services/api";
import { AuthShell } from "./AuthShell";
import { StatusMessage } from "./ui";

type AuthMode = "login" | "register";

export function AuthPage({
  mode,
  onModeChange,
  onForgotPassword,
  onClose,
  onAuthenticated,
}: {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  onForgotPassword: () => void;
  onClose: () => void;
  onAuthenticated: (session: AuthSession) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const registering = mode === "register";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const session = registering
        ? await registerAccount(email, password)
        : await loginAccount(email, password);
      onAuthenticated(session);
    } catch (requestError) {
      const detail = (requestError as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Unable to connect to the authentication service.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell mode={mode} onClose={onClose}>
      <form onSubmit={submit} className="w-full space-y-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#d71918]">{registering ? "New account" : "Sign in"}</p>
            <h2 className="mt-2 text-[23px] font-bold text-[#171b20]">{registering ? "Create your account" : "Login"}</h2>
            <p className="mt-1 text-sm text-[#70777d]">{registering ? "Register to continue to BloodSight." : "Use your email and password to continue."}</p>
          </div>

          {error ? <StatusMessage type="error">{error}</StatusMessage> : null}

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[#25292d]">Email address</span>
            <span className="relative block">
              <Mail size={17} className="pointer-events-none absolute left-4 top-[15px] text-[#77818a]" />
              <input
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-[#d9dce0] bg-white py-3.5 pl-12 pr-4 text-sm text-[#26313a] outline-none transition placeholder:text-[#8a9198] focus:border-[#e85a55] focus:ring-4 focus:ring-[#e85a55]/10"
                placeholder="Enter your email address"
              />
            </span>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[#25292d]">Password</span>
            <span className="relative block">
              <LockKeyhole size={17} className="pointer-events-none absolute left-4 top-[15px] text-[#77818a]" />
              <input
                type={showPassword ? "text" : "password"}
                autoComplete={registering ? "new-password" : "current-password"}
                required
                minLength={4}
                maxLength={128}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-[#d9dce0] bg-white py-3.5 pl-12 pr-12 text-sm text-[#26313a] outline-none transition placeholder:text-[#8a9198] focus:border-[#e85a55] focus:ring-4 focus:ring-[#e85a55]/10"
                placeholder="At least 4 characters"
              />
              <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((visible) => !visible)} className="absolute right-3.5 top-3.5 grid h-7 w-7 place-items-center rounded-md text-[#70777d] hover:bg-[#f5f6f7]">
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </span>
            {registering ? <span className="mt-1.5 block text-[11px] text-[#8b98a9]">Use 4 to 128 characters.</span> : null}
          </label>

          {!registering ? <div className="-mt-1 flex justify-end"><button type="button" onClick={onForgotPassword} className="text-sm font-semibold text-[#d71918] underline-offset-4 hover:underline">Forgot Password?</button></div> : null}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#d71918] px-4 py-3.5 text-base font-bold text-white shadow-[0_7px_16px_rgba(215,25,24,0.18)] transition hover:bg-[#bd1515] disabled:cursor-wait disabled:opacity-65"
          >
            {submitting ? <LoaderCircle size={19} className="animate-spin" /> : <>{registering ? "Register" : <><LogIn size={19} />Login</>}<ArrowRight size={16} /></>}
          </button>

          <p className="border-t border-[#e7e8ea] pt-5 text-center text-sm text-[#70777d]">
            {registering ? "Already have an account?" : "Don’t have an account?"}{" "}
            <button
              type="button"
              onClick={() => onModeChange(registering ? "login" : "register")}
              className="font-semibold text-[#d71918] underline-offset-4 hover:underline"
            >
              {registering ? "Login" : "Register Now"}
            </button>
          </p>
      </form>
    </AuthShell>
  );
}