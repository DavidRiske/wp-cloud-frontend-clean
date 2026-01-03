"use client";

console.log("LOGIN PAGE LOADED ✅", process.env.NEXT_PUBLIC_WP_CLOUD_API_BASE_URL);


import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type AuthMode = "login" | "register";

type AuthResponse = {
  token: string;
  user?: {
    user_id: string;
    email: string;
    display_name?: string;
  };
};

const sanitizeError = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export default function LoginPage() {
  const router = useRouter();

  // ENV (passt jetzt zu Azure)
  const apiBase = "https://func-apkevq.azurewebsites.net/api";
  const debugEnv = "HARDCODED";

  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const performAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setInfo(null);

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setError("Email and password are required.");
      setIsSubmitting(false);
      return;
    }

    if (!apiBase) {
      setError("API base URL is not configured.");
      setIsSubmitting(false);
      return;
    }

    const endpoint =
      mode === "login"
        ? `${apiBase}/auth/login`
        : `${apiBase}/auth/register`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          password: trimmedPassword,
          name: name.trim() || undefined,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error ?? `Unable to ${mode}`);
      }

      // Nach Register nur Info anzeigen
      if (mode === "register") {
        setInfo("Account created. You can now log in.");
        setMode("login");
        return;
      }

      // Login erfolgreich
      const authPayload = payload as AuthResponse;

      if (typeof window !== "undefined") {
        sessionStorage.setItem("wpcloud_token", authPayload.token);
        if (authPayload.user) {
          sessionStorage.setItem(
            "wpcloud_user",
            JSON.stringify(authPayload.user),
          );
        }
      }

      // ✅ WICHTIG: weiter zu /app (nicht mehr /vault)
      router.push("/app");
    } catch (authError) {
      setError(
        sanitizeError(authError, "Unexpected error during authentication"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center px-6 pb-16 pt-24">
        <div className="w-full rounded-3xl border border-white/10 bg-slate-900/70 p-8 shadow-xl shadow-emerald-500/10 md:max-w-2xl">
          <div className="mb-8 space-y-2 text-center">
            <p className="text-sm uppercase tracking-[0.4em] text-emerald-400">
              Console Access
            </p>
            <h1 className="text-3xl font-semibold text-white">
              {mode === "login" ? "Sign in to WP Cloud" : "Create your account"}
            </h1>
            <p className="text-sm text-slate-400">
              {mode === "login"
                ? "Authenticate to access your cloud file vault."
                : "Register a new account."}
            </p>
          </div>

          <form className="space-y-6" onSubmit={performAuth}>
            {mode === "register" && (
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                  Display name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/40"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/40"
              />
            </div>

            {error && (
              <p className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </p>
            )}

            {info && (
              <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                {info}
              </p>
            )}

                <p className="text-xs text-slate-500 break-all">
                     ENV DEBUG: {String(debugEnv)} | apiBase: {String(apiBase)}
                </p>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-70"
            >
              {isSubmitting
                ? mode === "login"
                  ? "Authenticating..."
                  : "Creating account..."
                : mode === "login"
                ? "Authenticate"
                : "Create account"}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-400">
            {mode === "login" ? (
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setError(null);
                  setInfo(null);
                }}
                className="font-semibold text-emerald-300 hover:text-emerald-200"
              >
                Need an account? Register here.
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError(null);
                  setInfo(null);
                }}
                className="font-semibold text-emerald-300 hover:text-emerald-200"
              >
                Already have an account? Sign in.
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
