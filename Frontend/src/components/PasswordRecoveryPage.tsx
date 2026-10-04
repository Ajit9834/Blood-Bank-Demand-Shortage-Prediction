import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { requestPasswordReset, resetAccountPassword } from "../services/api";
import { AuthShell } from "./AuthShell";
import { StatusMessage } from "./ui";

export function PasswordRecoveryPage({
  mode,
  token,
  onBack,
  onClose,
  onResetComplete,
}: {
  mode: "forgot" | "reset";
  token: string | null;
  onBack: () => void;
  onClose: () => void;
  onResetComplete?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const resetting = mode === "reset";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (resetting) {
        if (!token) {
          setError("This reset link is missing or invalid. Request a new one.");
          return;
        }
        await resetAccountPassword(token, password);
        onResetComplete?.();
      } else {
        await requestPasswordReset(email);
        setSent(true);
      }
    } catch (requestError) {
      const detail = (requestError as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Unable to complete the password reset request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell mode={mode} onClose={onClose}>
      <form onSubmit={submit} className="w-full space-y-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#d71918]">{resetting ? "New credentials" : "Email recovery"}</p>
            <h2 className="mt-2 text-[23px] font-bold text-[#171b20]">{resetting ? "Reset password" : "Forgot Password?"}</h2>
            <p className="mt-1 text-sm text-[#70777d]">
              {resetting ? "Enter a new password for your account." : "Enter your account email to request a reset link."}
            </p>
          </div>

          {error ? <StatusMessage type="error">{error}</StatusMessage> : null}
          {sent ? <StatusMessage type="success">If an account exists for that email, a reset link will be sent.</StatusMessage> : null}

          {resetting ? token ? <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[#25292d]">New password</span>
            <span className="relative block">
              <LockKeyhole size={17} className="pointer-events-none absolute left-4 top-[15px] text-[#77818a]" />
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
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
            <span className="mt-1.5 block text-[11px] text-[#8b98a9]">Use 4 to 128 characters.</span>
          </label> : <StatusMessage type="error">This reset link is missing or invalid. Request a new one.</StatusMessage> : <label className="block">
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
          </label>}

          {(!resetting || token) && !sent ? <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#d71918] px-4 py-3.5 text-base font-bold text-white shadow-[0_7px_16px_rgba(215,25,24,0.18)] transition hover:bg-[#bd1515] disabled:cursor-wait disabled:opacity-65"
          >
            {submitting ? <LoaderCircle size={17} className="animate-spin" /> : <>{resetting ? "Save new password" : "Send reset link"}<ArrowRight size={16} /></>}
          </button> : null}

          <button type="button" onClick={onBack} className="mx-auto flex items-center gap-2 text-sm font-semibold text-[#626a70] hover:text-[#d71918]">
            <ArrowLeft size={15} /> Back to Login
          </button>
      </form>
    </AuthShell>
  );
}