# Edge AI Image Analyzer & Talkback Studio

A client-side Edge AI PWA that runs real-time object detection using YOLOv8 via ONNX Runtime Web — entirely in your browser. No cloud, no API calls, 100% local inference. Upload a photo and watch bounding boxes appear with spoken audio summaries.

## Features

- **Client-Side Object Detection** — Runs YOLOv8n ONNX model locally via ONNX Runtime Web
- **Instant Audio Talkback** — Uses Web Speech API to read detection results aloud
- **Zero External Dependencies** — No API keys, no cloud processing, fully private
- **PWA Ready** — Progressive Web App support for mobile and desktop install
- **Responsive Design** — Works on desktop browsers, tablets, and phones
- **Drag & Drop or Click** — Upload images via file picker or drag-and-drop

## Tech Stack

- **Framework:** [TanStack Start](https://tanstack.com/start) (React + Vite + SSR/SSG)
- **Styling:** Tailwind CSS v4 + shadcn/ui components
- **AI Engine:** ONNX Runtime Web 1.26.0 + YOLOv8n (COCO dataset, 80 classes)
- **Speech:** Web Speech API (`window.speechSynthesis`)

## Prerequisites

- [Node.js](https://nodejs.org/) **v18+** (or v20+ recommended)
- [Bun](https://bun.sh/) **v1.1+** (preferred) — or use npm/pnpm
- A modern browser with WebAssembly support (Chrome, Firefox, Safari, Edge)

> **Note:** This app uses ONNX Runtime Web which requires WASM support. Safari on iOS may need the model loaded over HTTPS for WASM to work.

## Local Setup

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd <repo-folder>
```

### 2. Install Dependencies

With Bun (recommended):
```bash
bun install
```

Or with npm:
```bash
npm install
```

### 3. Start Development Server

```bash
bun dev
# or
npm run dev
```

The app will be available at **`http://localhost:3000`**.

### 4. Build for Production

```bash
bun run build
# or
npm run build
```

Preview the production build:
```bash
bun preview
# or
npm run preview
```

## Running on Your Phone

Since the app uses ONNX Runtime Web with WebAssembly, **HTTPS is strongly recommended** for mobile browsers (especially iOS Safari). Here are a few ways to access the local dev server from your phone:

### Option A: Same Wi-Fi Network (Local IP)

1. Make sure your phone and computer are on the **same Wi-Fi network**
2. Find your computer's local IP address:
   - **macOS/Linux:** `ifconfig` or `ip addr show` → look for `192.168.x.x` or `10.x.x.x`
   - **Windows:** `ipconfig` → look for `IPv4 Address`
3. Start the dev server with the host flag to allow external connections:
   ```bash
   bun dev --host
   # or
   npx vite --host
   ```
4. On your phone, open:
   ```
   http://<your-computer-ip>:3000
   ```
   Example: `http://192.168.1.42:3000`

> ⚠️ **Limitation:** Some mobile browsers block WASM over HTTP. If detection fails, try Option B or C.

### Option B: ngrok (HTTPS Tunnel — Recommended)

[ngrok](https://ngrok.com/) creates a public HTTPS URL that tunnels to your local server — works perfectly for mobile testing.

1. Install ngrok:
   ```bash
   # macOS
   brew install ngrok
   
   # or download from https://ngrok.com/download
   ```
2. Authenticate (one-time):
   ```bash
   ngrok config add-authtoken <your-token>
   ```
3. Start your dev server:
   ```bash
   bun dev
   ```
4. In a new terminal, tunnel port 3000:
   ```bash
   ngrok http 3000
   ```
5. Copy the HTTPS URL (e.g., `https://abc123.ngrok-free.app`) and open it on your phone

> ✅ **Best for:** Sharing with others, testing on iOS Safari, stable HTTPS for WASM

### Option C: Cloudflare Tunnel (Free Alternative)

```bash
# Install cloudflared
brew install cloudflared

# Run tunnel to localhost:3000
cloudflared tunnel --url http://localhost:3000
```

Copy the generated `https://` URL to your phone.

### Option D: Deploy and Access Anywhere

You can publish this app via Lovable or deploy to Vercel/Netlify for a permanent public URL:

```bash
# Build first
bun run build

# Deploy to Vercel (if you have the CLI)
npx vercel --prod
```

## How It Works

1. **Image Upload** — User selects or drops an image onto the canvas
2. **Preprocessing** — Image is resized to 640×640 via letterbox padding and normalized to a Float32 tensor
3. **Inference** — ONNX Runtime Web runs the YOLOv8n model in the browser using WebAssembly
4. **Post-Processing** — Non-Maximum Suppression (NMS) filters overlapping detections
5. **Visualization** — Bounding boxes and class labels are drawn on a canvas overlay
6. **Audio Summary** — Web Speech API reads a natural-language summary of detected objects

### Model Details

| Property | Value |
|----------|-------|
| Model | YOLOv8n (Nano) |
| Format | ONNX |
| Input Size | 640 × 640 |
| Classes | 80 (COCO dataset) |
| Backend | ONNX Runtime Web (WASM SIMD) |
| Size | ~6.3 MB |

The model and WASM runtime are served from the `public/` folder and loaded entirely client-side.

## Project Structure

```
├── public/
│   ├── models/
│   │   └── yolov8n.onnx          # YOLOv8n ONNX model
│   └── ort/                       # ONNX Runtime Web WASM files
│       └── (ort-wasm-simd-threaded.*)
├── src/
│   ├── components/ui/            # shadcn/ui components
│   ├── lib/
│   │   ├── coco.ts               # 80 COCO class labels
│   │   ├── yolo.ts               # ONNX inference, NMS, speech
│   │   └── utils.ts              # Utility helpers
│   ├── routes/
│   │   ├── __root.tsx            # Root layout & meta tags
│   │   └── index.tsx             # Main app page (detection UI)
│   ├── router.tsx                # TanStack Router config
│   ├── start.ts                  # Start server config
│   └── styles.css                # Tailwind CSS + design tokens
├── vite.config.ts                # Vite configuration
├── wrangler.jsonc                # Cloudflare Workers config
└── package.json
```

## Scripts

| Command | Description |
|---------|-------------|
| `bun dev` | Start dev server at localhost:3000 |
| `bun run build` | Build for production |
| `bun run build:dev` | Build in development mode |
| `bun preview` | Preview production build locally |
| `bun run lint` | Run ESLint |
| `bun run format` | Format code with Prettier |

## Browser Compatibility

| Browser | Status | Notes |
|---------|--------|-------|
| Chrome/Edge | ✅ Fully Supported | Best performance with WASM SIMD |
| Firefox | ✅ Supported | May be slightly slower |
| Safari (macOS) | ✅ Supported | WASM works well |
| Safari (iOS) | ⚠️ Requires HTTPS | Use ngrok or deploy for HTTPS |
| Chrome (Android) | ✅ Supported | Works great |

## Troubleshooting

### "Inference failed" / WASM won't load
- **Cause:** The browser blocked WASM loading over HTTP or the WASM files aren't found
- **Fix:** Use HTTPS (ngrok, deployed URL) or check that `public/ort/` contains the WASM files

### Model loads slowly on first visit
- **Cause:** The ~6MB ONNX model needs to download
- **Fix:** Normal — it caches after the first load. Consider adding a loading progress indicator

### Speech doesn't work
- **Cause:** Web Speech API may be disabled or unsupported
- **Fix:** Check browser permissions for audio/speech. Safari requires user interaction before speech

### Bounding boxes are misaligned
- **Cause:** Canvas and image display sizes are out of sync (usually after resize)
- **Fix:** Resize the window or re-upload the image — the `onResize` handler will recalculate

## License

This project is open source. Feel free to modify and extend it.

The YOLOv8n ONNX model is provided by the [Ultralytics](https://github.com/ultralytics/ultralytics) community.
