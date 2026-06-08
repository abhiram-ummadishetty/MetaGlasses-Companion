import * as ort from "onnxruntime-web";
import { COCO_CLASSES } from "./coco";

// Serve WASM artifacts from jsDelivr — Vite's dev server rewrites `.mjs`
// imports in /public with `?import`, which breaks ORT's dynamic loader.
ort.env.wasm.wasmPaths =
  "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/";
ort.env.wasm.numThreads = 1;

const MODEL_URL = "/models/yolov8n.onnx";
const INPUT_SIZE = 640;

let sessionPromise: Promise<ort.InferenceSession> | null = null;

export function loadSession(): Promise<ort.InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = ort.InferenceSession.create(MODEL_URL, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    });
  }
  return sessionPromise;
}

export interface Detection {
  label: string;
  classId: number;
  score: number;
  // box in original image pixels
  x: number;
  y: number;
  w: number;
  h: number;
}

function preprocess(
  img: CanvasImageSource,
  imgW: number,
  imgH: number,
): { tensor: ort.Tensor; xRatio: number; yRatio: number } {
  const canvas = document.createElement("canvas");
  canvas.width = INPUT_SIZE;
  canvas.height = INPUT_SIZE;
  const ctx = canvas.getContext("2d")!;
  // letterbox-ish: scale to fit while preserving aspect, pad with gray
  const scale = Math.min(INPUT_SIZE / imgW, INPUT_SIZE / imgH);
  const newW = imgW * scale;
  const newH = imgH * scale;
  ctx.fillStyle = "#727272";
  ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
  ctx.drawImage(img, (INPUT_SIZE - newW) / 2, (INPUT_SIZE - newH) / 2, newW, newH);
  const { data } = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);

  const float = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);
  const plane = INPUT_SIZE * INPUT_SIZE;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    float[p] = data[i] / 255;
    float[p + plane] = data[i + 1] / 255;
    float[p + 2 * plane] = data[i + 2] / 255;
  }
  return {
    tensor: new ort.Tensor("float32", float, [1, 3, INPUT_SIZE, INPUT_SIZE]),
    xRatio: scale,
    yRatio: scale,
  };
}

function iou(a: Detection, b: Detection): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.w * a.h + b.w * b.h - inter;
  return union <= 0 ? 0 : inter / union;
}

function nms(dets: Detection[], iouThresh = 0.45): Detection[] {
  const sorted = [...dets].sort((a, b) => b.score - a.score);
  const keep: Detection[] = [];
  while (sorted.length) {
    const d = sorted.shift()!;
    keep.push(d);
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i].classId === d.classId && iou(d, sorted[i]) > iouThresh) {
        sorted.splice(i, 1);
      }
    }
  }
  return keep;
}

export async function runDetection(
  source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  confThreshold = 0.5
): Promise<Detection[]> {
  const session = await loadSession();
  const srcW =
    source instanceof HTMLVideoElement ? source.videoWidth : source.width;
  const srcH =
    source instanceof HTMLVideoElement ? source.videoHeight : source.height;
  if (!srcW || !srcH) return [];
  const { tensor, xRatio } = preprocess(source, srcW, srcH);
  const inputName = session.inputNames[0];
  const outputs = await session.run({ [inputName]: tensor });
  const output = outputs[session.outputNames[0]];
  // shape [1, 84, 8400]
  const data = output.data as Float32Array;
  const [, channels, anchors] = output.dims as number[];
  const numClasses = channels - 4;

  const dets: Detection[] = [];
  const padX = (INPUT_SIZE - srcW * xRatio) / 2;
  const padY = (INPUT_SIZE - srcH * xRatio) / 2;

  for (let i = 0; i < anchors; i++) {
    let maxScore = 0;
    let maxIdx = -1;
    for (let c = 0; c < numClasses; c++) {
      const s = data[(4 + c) * anchors + i];
      if (s > maxScore) {
        maxScore = s;
        maxIdx = c;
      }
    }
    if (maxScore < confThreshold) continue;
    const cx = data[0 * anchors + i];
    const cy = data[1 * anchors + i];
    const w = data[2 * anchors + i];
    const h = data[3 * anchors + i];
    // remove letterbox padding, rescale to original
    const x = (cx - w / 2 - padX) / xRatio;
    const y = (cy - h / 2 - padY) / xRatio;
    const bw = w / xRatio;
    const bh = h / xRatio;
    dets.push({
      label: COCO_CLASSES[maxIdx] ?? `class_${maxIdx}`,
      classId: maxIdx,
      score: maxScore,
      x,
      y,
      w: bw,
      h: bh,
    });
  }
  return nms(dets);
}

export function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1;
    utter.pitch = 1;
    window.speechSynthesis.speak(utter);
  } catch {
    /* ignore */
  }
}

export function summarize(dets: Detection[]): string {
  if (!dets.length) return "I don't see anything I recognize.";
  const counts = new Map<string, number>();
  for (const d of dets) counts.set(d.label, (counts.get(d.label) ?? 0) + 1);
  const parts: string[] = [];
  for (const [label, n] of counts) {
    parts.push(n > 1 ? `${n} ${label}s` : `a ${label}`);
  }
  if (parts.length === 1) return `I see ${parts[0]}.`;
  const last = parts.pop();
  return `I see ${parts.join(", ")} and ${last}.`;
}