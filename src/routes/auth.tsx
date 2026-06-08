import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, Volume2 } from "lucide-react";
import { loginUser, signupUser } from "../lib/auth.functions";
import { setSession } from "../lib/session";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign in — Edge AI Analyzer" },
      { name: "description", content: "Create an account or sign in to use the on-device Edge AI Analyzer." },
    ],
  }),
});

function AuthPage() {
  const navigate = useNavigate();
  const signup = useServerFn(signupUser);
  const login = useServerFn(loginUser);
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    console.log('[auth][client] submit start', { mode, firstName, lastName });
    try {
      const user = mode === "signup"
        ? await signup({ data: { firstName, lastName, password } })
        : await login({ data: { firstName, lastName, password } });
      console.log('[auth][client] submit result', user);
      setSession(user);
      console.log('[auth][client] session set', { stored: (() => { try { return window.localStorage.getItem('edge-ai.session-user'); } catch { return null; } })() });
      // Try router navigation first, then force a full-page replacement if it doesn't take.
      try {
        navigate({ to: "/", replace: true });
        console.log('[auth][client] navigate called to / (router)');
      } catch (e) {
        console.warn('[auth][client] router navigate failed, falling back', e);
      }
      setTimeout(() => {
        if (typeof window !== 'undefined' && window.location.pathname === '/auth') {
          console.log('[auth][client] navigate fallback to window.location.replace(/)');
          try {
            window.location.replace('/');
          } catch (err) {
            console.error('[auth][client] navigate fallback failed', err);
          }
        }
      }, 200);
    } catch (e) {
      console.error('[auth][client] submit error', e);
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setErr(msg.replace(/^Error:\s*/, ""));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 px-4 py-10 text-zinc-900">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-white">
            <Volume2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Edge AI Analyzer</h1>
            <p className="text-xs text-zinc-500">100% on-device · YOLOv8</p>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
          <div className="mb-5 flex rounded-lg bg-zinc-100 p-1">
            {(["signup", "login"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                  mode === m ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
                }`}
              >
                {m === "signup" ? "Create account" : "Log in"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name" value={firstName} onChange={setFirstName} autoComplete="given-name" />
              <Field label="Last name" value={lastName} onChange={setLastName} autoComplete="family-name" />
            </div>
            <Field
              label="Password"
              value={password}
              onChange={setPassword}
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />

            {err && (
              <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
                {err}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signup" ? "Create account" : "Log in"}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-zinc-500">
            Your photos and camera feed never leave this device.
          </p>
        </div>
      </div>
    </div>
  );
}

// If bypass flag is set, immediately create a dev session and redirect.
if (typeof window !== 'undefined' && import.meta.env.VITE_BYPASS_AUTH === 'true') {
  // Delay to ensure client runtime is ready
  setTimeout(() => {
    try {
      const existing = window.localStorage.getItem('edge-ai.session-user');
      if (!existing) {
        const dev = { id: 'dev-user', firstName: 'Dev', lastName: 'User', username: 'dev.user' };
        try { window.localStorage.setItem('edge-ai.session-user', JSON.stringify(dev)); } catch {}
      }
      if (window.location.pathname === '/auth') window.location.replace('/');
    } catch (e) {
      // ignore
    }
  }, 50);
}

function Field({
  label, value, onChange, type = "text", autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-600">{label}</span>
      <input
        type={type}
        autoComplete={autoComplete}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
      />
    </label>
  );
}




