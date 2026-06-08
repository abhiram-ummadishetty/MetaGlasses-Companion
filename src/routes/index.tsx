import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Camera, Glasses, ImageIcon, LogOut, Volume2 } from "lucide-react";
import { clearSession, getSession, setSession, type SessionUser } from "../lib/session";
import { loadSession } from "../lib/yolo";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [engineReady, setEngineReady] = useState(false);

  useEffect(() => {
    const sync = () => setUser(getSession());
    sync();
    window.addEventListener("edge-ai.session", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("edge-ai.session", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      const bypass = import.meta.env.VITE_BYPASS_AUTH === 'true';
      if (bypass) {
        const devUser: SessionUser = {
          id: 'dev-user',
          firstName: 'Dev',
          lastName: 'User',
          username: 'dev.user',
        };
        setSession(devUser);
        setUser(devUser);
        return;
      }
      navigate({ to: "/auth" });
      return;
    }
    loadSession().then(() => setEngineReady(true)).catch(() => setEngineReady(false));
  }, [user, navigate]);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 text-sm text-zinc-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-white">
              <Volume2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight">Edge AI Analyzer</h1>
              <p className="text-xs text-zinc-500">
                {engineReady ? "ONNX Core ready" : "Booting on-device engine…"}
              </p>
            </div>
          </div>
          <button
            onClick={() => { clearSession(); navigate({ to: "/auth" }); }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
          >
            <LogOut className="h-3.5 w-3.5" /> Log out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <section className="mb-8 text-center sm:text-left">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Hi <span className="bg-gradient-to-r from-indigo-500 to-fuchsia-500 bg-clip-text text-transparent">{user.firstName}</span> 👋
          </h2>
          <p className="mt-2 text-base text-zinc-600">What are we analysing today?</p>
        </section>

        <div className="grid gap-4 sm:grid-cols-3">
          <ModeCard
            to="/camera"
            title="Live camera"
            description="Stream from this phone's camera and detect objects in real time."
            icon={<Camera className="h-6 w-6" />}
            accent="from-emerald-400 to-cyan-500"
          />
          <ModeCard
            to="/photo"
            title="From gallery"
            description="Pick a photo and run YOLOv8 inference instantly."
            icon={<ImageIcon className="h-6 w-6" />}
            accent="from-amber-400 to-orange-500"
          />
          <ModeCard
            to="/glasses"
            title="Meta Glasses"
            description="Beta — connect a smart-glasses video stream as input."
            icon={<Glasses className="h-6 w-6" />}
            accent="from-fuchsia-400 to-indigo-500"
          />
        </div>

        <p className="mt-10 text-center text-xs text-zinc-400">
          All inference runs locally on your device. Nothing is uploaded.
        </p>
      </main>
    </div>
  );
}

function ModeCard({
  to, title, description, icon, accent,
}: {
  to: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <Link
      to={to}
      className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${accent} text-white shadow`}>
        {icon}
      </div>
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      </div>
      <span className="mt-auto text-xs font-medium text-zinc-400 transition group-hover:text-zinc-900">
        Open →
      </span>
    </Link>
  );
}
