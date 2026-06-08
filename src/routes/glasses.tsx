import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Glasses, Loader2, Pause, Play, Volume2 } from "lucide-react";
import { loadSession, runDetection, speak, summarize, type Detection } from "../lib/yolo";
import { drawDetections } from "../lib/draw";

export const Route = createFileRoute("/glasses")({
  component: GlassesPage,
  head: () => ({ meta: [{ title: "Meta Glasses input — Edge AI (beta)" }] }),
});

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  META GLASSES INTEGRATION — BOILERPLATE
 * ─────────────────────────────────────────────────────────────────────────────
 *  Meta Ray-Ban / Quest smart glasses don't yet expose a public real-time
 *  video API to arbitrary web apps. This page is the integration shell ready
 *  for whichever bridge the user wants to plug in. Drop one of these into
 *  `attachGlassesStream` and the rest (YOLO inference + overlay + voice) is
 *  already wired:
 *
 *    1. WebRTC bridge   — companion app on the phone publishes the glasses
 *                         feed via getUserMedia/RTCPeerConnection; we set
 *                         that MediaStream as `video.srcObject`.
 *    2. MediaSource     — receive H.264 chunks (e.g. over WebSocket) and
 *                         append to a MediaSource attached to `video.src`.
 *    3. HLS / DASH      — `video.src = "https://…/stream.m3u8"` once the
 *                         glasses upload to a relay you control.
 *    4. WebUSB / WebBLE — pair directly when/if Meta exposes it.
 *
 *  For now: pasting an HLS / MP4 / WebRTC stream URL works as a stand-in,
 *  and the "Use this device camera as glasses" button mirrors the live
 *  capture path so you can validate the pipeline end-to-end on iOS/Android.
 * ─────────────────────────────────────────────────────────────────────────────
 */

function GlassesPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const lastSpokenRef = useRef("");

  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(false);
  const [paused, setPaused] = useState(false);
  const [labels, setLabels] = useState<Detection[]>([]);
  const [streamUrl, setStreamUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [voiceOn, setVoiceOn] = useState(false);

  useEffect(() => {
    loadSession().then(() => setReady(true)).catch((e) => setError(String(e)));
    return () => stop();
  }, []);

  function stop() {
    runningRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
      videoRef.current.removeAttribute("src");
      videoRef.current.load();
    }
    setActive(false);
    setPaused(false);
  }

  /**
   * Hook point for a real Meta Glasses bridge. Return a MediaStream OR set
   * `video.src` to an HLS / MP4 / WebRTC URL yourself before resolving.
   */
  async function attachGlassesStream(v: HTMLVideoElement): Promise<MediaStream | null> {
    // TODO: replace with real WebRTC / MediaSource / Bluetooth bridge.
    if (streamUrl) {
      v.crossOrigin = "anonymous";
      v.src = streamUrl;
      return null;
    }
    // Fallback: use this device's rear camera so the demo works today.
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    v.srcObject = stream;
    return stream;
  }

  async function start() {
    setError(null);
    try {
      const v = videoRef.current!;
      v.setAttribute("playsinline", "true");
      v.muted = true;
      const stream = await attachGlassesStream(v);
      streamRef.current = stream;
      await v.play();
      setActive(true);
      setPaused(false);
      runningRef.current = true;
      loop();
    } catch (e) {
      console.error(e);
      setError(
        "Couldn't open the input stream. For Meta Glasses, you currently need a companion bridge (WebRTC/HLS). The button above falls back to this device's camera so you can test the pipeline.",
      );
    }
  }

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
    if (now - lastTsRef.current < 180) return;
    lastTsRef.current = now;
    inFlightRef.current = true;
    runDetection(v, 0.45)
      .then((dets) => {
        setLabels(dets);
        drawDetections(c, dets, v.videoWidth, v.videoHeight);
        if (voiceOn) {
          const s = summarize(dets);
          if (s !== lastSpokenRef.current) { lastSpokenRef.current = s; speak(s); }
        }
      })
      .catch(console.error)
      .finally(() => { inFlightRef.current = false; });
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-900 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-300 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10 px-3 py-1.5 text-xs font-medium text-fuchsia-300">
            <Glasses className="h-3.5 w-3.5" /> Meta Glasses · Beta
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 text-sm">
          <h2 className="text-base font-semibold text-white">Smart-glasses video as input</h2>
          <p className="mt-2 text-zinc-400">
            Paste a stream URL (HLS / MP4 / WebRTC SDP via your companion app) or
            tap “Start” to fall back to this device's rear camera while the
            real bridge is being wired up. All frames are processed locally.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={streamUrl}
              onChange={(e) => setStreamUrl(e.target.value)}
              placeholder="https://your-bridge.example/glasses.m3u8"
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-fuchsia-400"
            />
            <button
              onClick={() => setStreamUrl("")}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800"
            >
              Use device camera instead
            </button>
          </div>
        </section>

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
          {!active && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 px-6 text-center">
              <Glasses className="h-10 w-10 text-zinc-400" />
              <p className="text-sm text-zinc-300">
                {streamUrl
                  ? "Ready to open your glasses stream"
                  : "No glasses connected — will use this device's camera as a stand-in"}
              </p>
            </div>
          )}
          {error && (
            <div className="absolute inset-x-4 bottom-4 rounded-lg bg-red-500/90 px-3 py-2 text-xs text-white">
              {error}
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {!active ? (
            <button
              onClick={start}
              disabled={!ready}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-zinc-900 shadow hover:bg-zinc-100 disabled:opacity-50"
            >
              {!ready ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Start
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
                onClick={stop}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
              >
                Disconnect
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