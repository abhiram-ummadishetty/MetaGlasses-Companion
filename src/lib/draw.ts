import type { Detection } from "./yolo";

const PALETTE = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#a855f7", "#ec4899", "#14b8a6", "#f59e0b",
];

/**
 * Draws detections onto a canvas. Boxes are in source pixel space
 * (srcW × srcH). The canvas is rendered at the same on-screen size as the
 * source video/image and scaled accordingly.
 */
export function drawDetections(
  canvas: HTMLCanvasElement,
  dets: Detection[],
  srcW: number,
  srcH: number,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  if (canvas.width !== srcW) canvas.width = srcW;
  if (canvas.height !== srcH) canvas.height = srcH;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Stroke proportional to image size so it reads well on phones.
  const stroke = Math.max(2, Math.round(Math.min(srcW, srcH) / 250));
  const fontPx = Math.max(14, Math.round(Math.min(srcW, srcH) / 36));
  ctx.lineWidth = stroke;
  ctx.font = `600 ${fontPx}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textBaseline = "top";
  for (const d of dets) {
    const color = PALETTE[d.classId % PALETTE.length];
    ctx.strokeStyle = color;
    ctx.strokeRect(d.x, d.y, d.w, d.h);
    const label = `${d.label} ${Math.round(d.score * 100)}%`;
    const pad = Math.round(fontPx * 0.4);
    const tw = ctx.measureText(label).width + pad * 2;
    const th = fontPx + pad;
    const ty = Math.max(0, d.y - th);
    ctx.fillStyle = color;
    ctx.fillRect(d.x, ty, tw, th);
    ctx.fillStyle = "#fff";
    ctx.fillText(label, d.x + pad, ty + pad / 2);
  }
}