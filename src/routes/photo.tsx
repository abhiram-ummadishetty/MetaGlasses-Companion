import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ImageIcon, Loader2, Upload, Volume2 } from "lucide-react";
import { loadSession, runDetection, speak, summarize, type Detection } from "../lib/yolo";
import { drawDetections } from "../lib/draw";

export const Route = createFileRoute("/photo")({
  component: PhotoPage,
  head: () => ({ meta: [{ title: "Gallery analyzer — Edge AI" }] }),
});

type EngineStatus = "loading" | "ready" | "processing" | "error";

function PhotoPage() {
  const [status, setStatus] = useState<EngineStatus>("loading");
  const [statusMsg, setStatusMsg] = useState("Booting ONNX core…");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [summary, setSummary] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let alive = true;
    loadSession()
      .then(() => { if (alive) { setStatus("ready"); setStatusMsg("ONNX Core: Ready"); } })
      .catch(() => { if (alive) { setStatus("error"); setStatusMsg("ONNX Core: Failed"); } });
    return () => { alive = false; };
  }, []);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    setDetections([]); setSummary("");
    setImageUrl(URL.createObjectURL(file));
  }

  async function onImageLoad() {
    const img = imgRef.current;
    if (!img) return;
    setStatus("processing"); setStatusMsg("Running inference…");
    try {
      const dets = await runDetection(img, 0.5);
      setDetections(dets);
      if (canvasRef.current) drawDetections(canvasRef.current, dets, img.naturalWidth, img.naturalHeight);
      const text = summarize(dets);
      setSummary(text);
      speak(text);
      setStatus("ready"); setStatusMsg("ONNX Core: Ready");
    } catch (err) {
      console.error(err);
      setStatus("error"); setStatusMsg("Inference failed");
    }
  }

  const dotClass =
    status === "ready" ? "bg-emerald-500"
    : status === "processing" || status === "loading" ? "bg-amber-500 animate-pulse"
    : "bg-red-500";

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-900">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5">
            <span className={`h-2 w-2 rounded-full ${dotClass}`} />
            <span className="text-xs font-medium text-zinc-700">{statusMsg}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div
          onClick={() => fileInputRef.current?.click()}
          className="relative mx-auto flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-zinc-300 bg-white transition hover:border-zinc-400"
          style={{ height: "min(70vh, 450px)", minHeight: 300 }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
        >
          {imageUrl ? (
            <div className="relative inline-block max-h-full max-w-full">
              <img
                ref={imgRef}
                src={imageUrl}
                alt="Selected"
                className="block max-h-[min(70vh,450px)] max-w-full object-contain"
                onLoad={onImageLoad}
              />
              <canvas
                ref={canvasRef}
                className="pointer-events-none absolute inset-0 h-full w-full"
              />
              {status === "processing" && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-sm">
                  <Loader2 className="h-8 w-8 animate-spin text-zinc-900" />
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 px-6 text-center text-zinc-500">
              <ImageIcon className="h-12 w-12 text-zinc-400" />
              <p className="text-sm font-medium">Tap or drag an image here to scan</p>
              <p className="text-xs text-zinc-400">JPG · PNG · WEBP — never leaves your device</p>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
        />

        <div className="mt-5 flex flex-col items-center gap-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={status === "loading"}
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            Select Image from Gallery
          </button>

          <div className="min-h-[2.5rem] w-full max-w-2xl rounded-xl bg-white px-4 py-3 text-center text-sm shadow-sm ring-1 ring-zinc-200">
            {detections.length > 0 ? (
              <>
                <span className="font-semibold text-zinc-900">Detected:</span>{" "}
                <span className="text-zinc-700">
                  {detections.map((d) => `${d.label} (${Math.round(d.score * 100)}%)`).join(", ")}
                </span>
              </>
            ) : summary ? (
              <span className="text-zinc-500">{summary}</span>
            ) : (
              <span className="text-zinc-400">Detected objects will appear here</span>
            )}
          </div>

          {summary && (
            <button
              onClick={() => speak(summary)}
              className="inline-flex items-center gap-2 text-xs font-medium text-zinc-500 hover:text-zinc-900"
            >
              <Volume2 className="h-3.5 w-3.5" /> Replay audio
            </button>
          )}
        </div>
      </main>
    </div>
  );
}