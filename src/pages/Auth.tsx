import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Loader2, Lock, Mail, RefreshCw, User as UserIcon } from "lucide-react";
import { useGoogleLogin } from "@react-oauth/google";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { googleLogin, loginUser, logout, registerUser } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { safeAppRedirect } from "@/lib/routing";

const AUTH_TIMEOUT_MS = 10000;
const AUTH_TIMEOUT_MESSAGE = "Auth service is not reachable. Check your API URL and network connection.";
const DEFAULT_AUTH_REDIRECT = "/dashboard";
const OTP_LENGTH = 6;

type AuthMode = "signin" | "signup";
type AuthStep = "form" | "verify";
type FormField = "displayName" | "email" | "password";
type AuthForm = Record<FormField, string>;
type FormErrors = Partial<Record<FormField, string>>;
type TouchedFields = Partial<Record<FormField, boolean>>;

const initialForm: AuthForm = { displayName: "", email: "", password: "" };
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getSignupFieldError = (field: FormField, value: string) => {
  if (field === "displayName") {
    if (!value.trim()) return "Player name is required";
    if (value.trim().length < 2) return "Use at least 2 characters";
  }

  if (field === "email") {
    if (!value.trim()) return "Email is required";
    if (!emailPattern.test(value.trim())) return "Enter a valid email";
  }

  if (field === "password") {
    if (!value) return "Password is required";
    if (value.length < 8) return "Use at least 8 characters";
    if (!/[A-Z]/.test(value)) return "Add an uppercase letter";
    if (!/[a-z]/.test(value)) return "Add a lowercase letter";
    if (!/\d/.test(value)) return "Add a number";
  }

  return "";
};

const getSigninFieldError = (field: FormField, value: string) => {
  if (field === "email") {
    if (!value.trim()) return "Email is required";
    if (!emailPattern.test(value.trim())) return "Enter a valid email";
  }

  if (field === "password") {
    if (!value) return "Password is required";
    if (value.length < 8) return "Use at least 8 characters";
  }

  return "";
};

const validateForm = (form: AuthForm, mode: AuthMode) => {
  const fields: FormField[] = mode === "signup" ? ["displayName", "email", "password"] : ["email", "password"];

  return fields.reduce<FormErrors>((errors, field) => {
    const message = mode === "signup" ? getSignupFieldError(field, form[field]) : getSigninFieldError(field, form[field]);
    if (message) errors[field] = message;
    return errors;
  }, {});
};

const withAuthTimeout = <T,>(request: PromiseLike<T>) =>
  Promise.race([
    request,
    new Promise<never>((_, reject) =>
      window.setTimeout(() => reject(new Error(AUTH_TIMEOUT_MESSAGE)), AUTH_TIMEOUT_MS),
    ),
  ]);

export default function Auth() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirectTo = safeAppRedirect(params.get("redirect"), DEFAULT_AUTH_REDIRECT);
  const { user, loading: authLoading, setAuthUser } = useAuth();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [step, setStep] = useState<AuthStep>("form");
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [form, setForm] = useState<AuthForm>(initialForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<TouchedFields>({});
  const [pendingSignup, setPendingSignup] = useState<AuthForm | null>(null);
  const [otpValues, setOtpValues] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [otpError, setOtpError] = useState("");
  const [resendSeconds, setResendSeconds] = useState(30);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  const otpCode = otpValues.join("");
  const otpComplete = otpCode.length === OTP_LENGTH;
  const visibleErrors = useMemo(
    () =>
      Object.entries(errors).reduce<FormErrors>((current, [field, message]) => {
        if (touched[field as FormField]) current[field as FormField] = message;
        return current;
      }, {}),
    [errors, touched],
  );

  useEffect(() => {
    if (!authLoading && user) navigate(redirectTo, { replace: true });
  }, [user, authLoading, navigate, redirectTo]);

  useEffect(() => {
    if (step !== "verify" || resendSeconds <= 0) return undefined;

    const timer = window.setInterval(() => {
      setResendSeconds((seconds) => Math.max(seconds - 1, 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendSeconds, step]);

  const updateField = (field: FormField, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));

    if (touched[field]) {
      setErrors((current) => ({
        ...current,
        [field]: mode === "signup" ? getSignupFieldError(field, value) : getSigninFieldError(field, value),
      }));
    }
  };

  const markTouched = (field: FormField) => {
    setTouched((current) => ({ ...current, [field]: true }));
    setErrors((current) => ({
      ...current,
      [field]: mode === "signup" ? getSignupFieldError(field, form[field]) : getSigninFieldError(field, form[field]),
    }));
  };

  const inputClassName = (field: FormField) => {
    const hasError = Boolean(visibleErrors[field]);
    const isValid = Boolean(touched[field] && form[field] && !errors[field]);

    if (hasError) {
      return "h-12 pl-11 rounded-2xl bg-card border-destructive/70 shadow-[0_0_0_1px_hsl(var(--destructive)/0.25)] focus-visible:ring-destructive/40";
    }

    if (isValid) {
      return "h-12 pl-11 rounded-2xl bg-card border-emerald-400/55 shadow-[0_0_0_1px_rgba(52,211,153,0.12)]";
    }

    return "h-12 pl-11 rounded-2xl bg-card border-border";
  };

  const showMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setStep("form");
    setAuthError(null);
    setSuccessMessage(null);
    setErrors({});
    setTouched({});
    setOtpError("");
    setOtpValues(Array(OTP_LENGTH).fill(""));
    setPendingSignup(null);
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setSuccessMessage(null);

    const nextErrors = validateForm(form, mode);
    setErrors(nextErrors);
    setTouched(mode === "signup" ? { displayName: true, email: true, password: true } : { email: true, password: true });

    if (Object.keys(nextErrors).length > 0) return;

    if (mode === "signup") {
      setPendingSignup({
        displayName: form.displayName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
      setStep("verify");
      setOtpValues(Array(OTP_LENGTH).fill(""));
      setOtpError("");
      setResendSeconds(30);
      window.setTimeout(() => otpRefs.current[0]?.focus(), 0);
      return;
    }

    setLoading(true);
    try {
      const data = await withAuthTimeout(loginUser({
        email: form.email.trim().toLowerCase(),
        password: form.password,
      }));
      setAuthUser(data.user);
      toast.success("Welcome back!");
      navigate(redirectTo, { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Authentication failed";
      setAuthError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const nextOtp = [...otpValues];
    nextOtp[index] = digit;
    setOtpValues(nextOtp);
    setOtpError("");

    if (digit && index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;

    const nextOtp = Array(OTP_LENGTH)
      .fill("")
      .map((_, index) => pasted[index] || "");
    setOtpValues(nextOtp);
    setOtpError("");
    otpRefs.current[Math.min(pasted.length, OTP_LENGTH) - 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpValues[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const verifyCode = async () => {
    if (!pendingSignup) {
      setStep("form");
      return;
    }

    if (!otpCode) {
      setOtpError("Enter the code");
      return;
    }

    if (!otpComplete) {
      setOtpError("Enter all 6 digits");
      return;
    }

    setLoading(true);
    setAuthError(null);
    try {
      const data = await withAuthTimeout(registerUser({
        name: pendingSignup.displayName,
        email: pendingSignup.email,
        password: pendingSignup.password,
      }));
      logout();
      setMode("signin");
      setStep("form");
      setPendingSignup(null);
      setOtpValues(Array(OTP_LENGTH).fill(""));
      setOtpError("");
      setErrors({});
      setTouched({});
      setForm({ displayName: "", email: data.user.email || pendingSignup.email, password: "" });
      setSuccessMessage("Account created successfully. Please sign in.");
      toast.success("Account created successfully. Please sign in.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Signup failed";
      setOtpError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const resendCode = () => {
    if (resendSeconds > 0) return;
    setOtpValues(Array(OTP_LENGTH).fill(""));
    setOtpError("");
    setResendSeconds(30);
    otpRefs.current[0]?.focus();
    toast.success("New code sent");
  };

  const backToSignup = () => {
    setStep("form");
    setMode("signup");
    setOtpError("");
    setOtpValues(Array(OTP_LENGTH).fill(""));
  };

  const startGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      setAuthError(null);
      try {
        const data = await withAuthTimeout(googleLogin({ accessToken: tokenResponse.access_token }));
        setAuthUser(data.user);
        toast.success("Welcome back!");
        navigate(redirectTo, { replace: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Google sign-in failed";
        setAuthError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    },
    onError: () => {
      const message = "Google sign-in failed";
      setAuthError(message);
      toast.error(message);
    },
  });

  const handleGoogle = async () => {
    setAuthError(null);
    setSuccessMessage(null);
    try {
      startGoogleLogin();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Google sign-in failed";
      setAuthError(message);
      toast.error(message);
    }
  };

  if (step === "verify") {
    return (
      <div className="min-h-screen bg-background flex justify-center">
        <div className="w-full max-w-[440px] px-5 pt-8 pb-12 space-y-7">
          <header className="flex items-center justify-between">
            <button
              type="button"
              onClick={backToSignup}
              className="h-10 w-10 rounded-full bg-card border border-border grid place-items-center"
              aria-label="Back to signup"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="w-10" />
          </header>

          <div className="space-y-3 text-center">
            <img
              src="/logo.png"
              alt="CrickPulse"
              className="mx-auto h-16 w-16 rounded-2xl border border-primary/25 object-cover glow-primary"
            />
            <div>
              <h1 className="text-2xl font-black">Verify your email</h1>
              <p className="text-sm text-muted-foreground mt-1">We sent a 6-digit code to your email</p>
            </div>
            <p className="mx-auto max-w-full truncate rounded-full border border-border bg-card/80 px-4 py-2 text-xs font-semibold text-foreground/90">
              {pendingSignup?.email}
            </p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-6 gap-2">
              {otpValues.map((digit, index) => (
                <Input
                  key={`otp-${index}`}
                  ref={(element) => {
                    otpRefs.current[index] = element;
                  }}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  onPaste={handleOtpPaste}
                  inputMode="numeric"
                  maxLength={1}
                  aria-label={`Verification digit ${index + 1}`}
                  className={`h-12 rounded-2xl bg-card px-0 text-center text-lg font-black border-border ${
                    otpError
                      ? "border-destructive/70 shadow-[0_0_0_1px_hsl(var(--destructive)/0.25)]"
                      : digit
                        ? "border-emerald-400/55 shadow-[0_0_0_1px_rgba(52,211,153,0.12)]"
                        : ""
                  }`}
                />
              ))}
            </div>

            {otpError && <p className="px-1 text-xs font-medium text-destructive">{otpError}</p>}
            {otpComplete && !otpError && (
              <p className="flex items-center gap-1.5 px-1 text-xs font-medium text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Code ready to verify
              </p>
            )}

            <Button type="button" variant="hero" size="xl" className="w-full" onClick={verifyCode} disabled={loading}>
              {loading && <Loader2 className="h-5 w-5 animate-spin" />}
              Verify code
            </Button>

            <div className="space-y-2 text-center">
              <button
                type="button"
                onClick={resendCode}
                disabled={resendSeconds > 0}
                className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-primary disabled:text-muted-foreground"
              >
                <RefreshCw className="h-4 w-4" />
                Resend code
              </button>
              <p className="text-xs text-muted-foreground">
                {resendSeconds > 0 ? `Resend available in ${resendSeconds}s` : "You can request a new code now"}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex justify-center">
      <div className="w-full max-w-[440px] px-5 pt-8 pb-12 space-y-7">
        <header className="flex items-center justify-between">
          <Link to="/" className="h-10 w-10 rounded-full bg-card border border-border grid place-items-center">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="w-10" />
        </header>

        <div className="space-y-3 text-center">
          <img
            src="/logo.png"
            alt="CrickPulse"
            className="mx-auto h-16 w-16 rounded-2xl border border-primary/25 object-cover glow-primary"
          />
          <div>
            <h1 className="text-2xl font-black">{mode === "signup" ? "CrickPulse" : "Welcome back"}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "signup" ? "Track. Play. Share your cricket." : "Sign in to keep playing"}
            </p>
          </div>
        </div>

        <Button
          variant="soft"
          size="xl"
          className="w-full bg-card border border-border"
          onClick={handleGoogle}
          disabled={loading}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </Button>

        {authError && (
          <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {authError}
          </p>
        )}

        {successMessage && (
          <p className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
            {successMessage}
          </p>
        )}

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground uppercase tracking-wider">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-3">
          {mode === "signup" && (
            <div className="space-y-1.5">
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Player name"
                  value={form.displayName}
                  onChange={(e) => updateField("displayName", e.target.value)}
                  onBlur={() => markTouched("displayName")}
                  className={inputClassName("displayName")}
                  autoComplete="name"
                  aria-invalid={Boolean(visibleErrors.displayName)}
                />
              </div>
              {visibleErrors.displayName && (
                <p className="px-1 text-xs font-medium text-destructive">{visibleErrors.displayName}</p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="Email address"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                onBlur={() => markTouched("email")}
                className={inputClassName("email")}
                autoComplete="email"
                aria-invalid={Boolean(visibleErrors.email)}
              />
            </div>
            {visibleErrors.email && <p className="px-1 text-xs font-medium text-destructive">{visibleErrors.email}</p>}
          </div>

          <div className="space-y-1.5">
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="password"
                placeholder={mode === "signup" ? "Create password" : "Password"}
                value={form.password}
                onChange={(e) => updateField("password", e.target.value)}
                onBlur={() => markTouched("password")}
                className={inputClassName("password")}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                aria-invalid={Boolean(visibleErrors.password)}
              />
            </div>
            {visibleErrors.password && (
              <p className="px-1 text-xs font-medium text-destructive">{visibleErrors.password}</p>
            )}
          </div>

          <Button type="submit" variant="hero" size="xl" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-5 w-5 animate-spin" />}
            {mode === "signup" ? "Create account" : "Sign in"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {mode === "signup" ? "Already have an account?" : "New to CrickPulse?"}{" "}
          <button onClick={() => showMode(mode === "signup" ? "signin" : "signup")} className="text-primary font-semibold">
            {mode === "signup" ? "Sign in" : "Create account"}
          </button>
        </p>

        <p className="text-center text-[11px] text-muted-foreground px-4">
          By continuing you agree to our Terms & Privacy Policy.
        </p>
      </div>
    </div>
  );
}
