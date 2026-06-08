import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, Loader2, Pause, Play, RefreshCw, Volume2 } from "lucide-react";
import { loadSession, runDetection, speak, summarize, type Detection } from "../lib/yolo";
import { drawDetections } from "../lib/draw";

export const Route = createFileRoute("/camera")({
  component: CameraPage,
  head: () => ({ meta: [{ title: "Live camera — Edge AI" }] }),
});

function CameraPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [paused, setPaused] = useState(false);
  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [error, setError] = useState<string | null>(null);
  const [labels, setLabels] = useState<Detection[]>([]);
  const [fps, setFps] = useState(0);
  const [voiceOn, setVoiceOn] = useState(false);
  const lastSpokenRef = useRef<string>("");

  // Boot ONNX
  useEffect(() => {
    loadSession().then(() => setReady(true)).catch((e) => setError(String(e)));
  }, []);

  async function startCamera(targetFacing = facing) {
    setError(null);
    try {
      stopStream();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: targetFacing }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current!;
      v.srcObject = stream;
      v.setAttribute("playsinline", "true");
      await v.play();
      setStreaming(true);
      setPaused(false);
      runningRef.current = true;
      loop();
    } catch (e) {
      setError("Camera access denied. Please allow camera permission and reload.");
      console.error(e);
    }
  }

  function stopStream() {
    runningRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStreaming(false);
  }

  async function flipCamera() {
    const next = facing === "user" ? "environment" : "user";
    setFacing(next);
    if (streaming) await startCamera(next);
  }

  useEffect(() => () => stopStream(), []);

  const lastTsRef = useRef(0);
  const inFlightRef = useRef(false);
  function loop() {
    if (!runningRef.current) return;
    rafRef.current = requestAnimationFrame(loop);
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c || v.videoWidth === 0) return;
    if (paused || inFlightRef.current) return;
    const now = performance.now();
    // throttle to ~6 FPS to keep WASM responsive on mobile
    if (now - lastTsRef.current < 160) return;
    lastTsRef.current = now;
    inFlightRef.current = true;
    runDetection(v, 0.45)
      .then((dets) => {
        setLabels(dets);
        drawDetections(c, dets, v.videoWidth, v.videoHeight);
        const ms = performance.now() - now;
        setFps(Math.round(1000 / ms));
        if (voiceOn) {
          const summary = summarize(dets);
          if (summary !== lastSpokenRef.current) {
            lastSpokenRef.current = summary;
            speak(summary);
          }
        }
      })
      .catch((e) => console.error(e))
      .finally(() => { inFlightRef.current = false; });
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-900 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-300 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5">
            <span className={`h-2 w-2 rounded-full ${ready ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`} />
            <span className="text-xs font-medium text-zinc-300">
              {ready ? `Live · ${fps || 0} fps` : "Booting engine…"}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl bg-black ring-1 ring-zinc-800" style={{ aspectRatio: "16/9" }}>
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-contain"
            muted
            playsInline
          />
          <canvas
            ref={canvasRef}
            className="pointer-events-none absolute inset-0 h-full w-full object-contain"
          />
          {!streaming && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 px-6 text-center">
              <Camera className="h-10 w-10 text-zinc-400" />
              <p className="text-sm text-zinc-300">Tap “Start camera” to begin live detection</p>
              <p className="text-xs text-zinc-500">Camera and inference run entirely on this device.</p>
            </div>
          )}
          {error && (
            <div className="absolute inset-x-4 bottom-4 rounded-lg bg-red-500/90 px-3 py-2 text-xs text-white">
              {error}
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {!streaming ? (
            <button
              onClick={() => startCamera()}
              disabled={!ready}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-zinc-900 shadow hover:bg-zinc-100 disabled:opacity-50"
            >
              {!ready ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Start camera
            </button>
          ) : (
            <>
              <button
                onClick={() => setPaused((p) => !p)}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
              >
                {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                {paused ? "Resume" : "Pause"}
              </button>
              <button
                onClick={flipCamera}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
              >
                <RefreshCw className="h-4 w-4" /> Flip
              </button>
              <button
                onClick={stopStream}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
              >
                Stop
              </button>
              <button
                onClick={() => setVoiceOn((v) => !v)}
                className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium ${
                  voiceOn
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                    : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                }`}
              >
                <Volume2 className="h-4 w-4" /> {voiceOn ? "Voice on" : "Voice off"}
              </button>
            </>
          )}
        </div>

        {labels.length > 0 && (
          <div className="mt-5 rounded-xl bg-zinc-900/70 px-4 py-3 text-sm text-zinc-200 ring-1 ring-zinc-800">
            <span className="font-semibold text-white">Detected:</span>{" "}
            {labels.map((d) => `${d.label} (${Math.round(d.score * 100)}%)`).join(", ")}
          </div>
        )}
      </main>
    </div>
  );
}