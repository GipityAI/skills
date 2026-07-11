---
name: web-vision-detect
description: "Use when the user wants real-time object detection in a web app - boxing, labeling, or counting things from the camera or a photo, or deploying a custom-trained YOLO/YOLOX model - running on-device in the browser with no server and no API keys. The Gipity web-vision-detect kit and object-spotter starter app."
---

<!-- GENERATED from platform/docs/skills/web-vision-detect.md by platform/scripts/sync-claude-plugin.ts - do not edit here. -->

> **Gipity required.** This skill needs the `gipity` CLI linked to a project. If `gipity status` errors or shows no project, run the setup flow in the `gipity` skill (or `/gipity:setup`) first.
>
> This doc is shared across Gipity surfaces; where it names an agent tool, use the CLI equivalent: `add` → `gipity add <name>`, `file_write`/`file_read`/`file_delete` → edit files in the project directory directly (they auto-sync), `project_deploy` → `gipity deploy dev`, `code_execute` → `gipity sandbox run`. The live version of this doc: `gipity skill read web-vision-detect`.

# Browser Object Detection (YOLOX)

`web-vision-detect` is a **kit** - a reusable building block added into an existing web app. It runs [YOLOX](https://github.com/Megvii-BaseDetection/YOLOX) (Apache-2.0) on ONNX Runtime Web so an app can read the camera (or a still image) and do **real-time object detection** entirely in the browser - boxes, labels, and confidence for the 80 COCO classes, or for a custom-trained model the user brings.

On-device: no server, no upload, the camera stream never leaves the device. Inference runs on **WebGPU** where the browser has it, with automatic **WASM (SIMD)** fallback. **Web only** - it needs `getUserMedia` (for camera use), WASM, and a canvas, so it runs only on HTTPS or `localhost`.

This kit is the high-accuracy sibling of `web-vision-mediapipe`: use that one for gesture and pose, this one when detection is the product - counting, labeling, inventory, custom classes.

## Two ways in

**Start a fresh detection app** - add the `object-spotter` starter, a fullscreen camera app with the kit pre-installed that boxes, labels, and counts objects live, detects picked photos, and switches between three speed/accuracy presets:

```
add name=object-spotter title="..."
```

**Add detection to an existing web app** - install the kit into it:

```
add name=web-vision-detect
```

This copies the kit to `src/packages/web-vision-detect/` and wires the import map in `src/index.html` (the kit specifier plus `onnxruntime-web`). There is no deploy phase - it is pure client-side, so a plain static app needs nothing else.

## Using the kit

The whole job is two elements - a `<video>` for the camera and a `<canvas>` overlaying it - plus one call:

```js
import { mountDetect } from '@gipity/web-vision-detect';

const vision = await mountDetect({
  video:  document.querySelector('video'),
  canvas: document.querySelector('canvas'),
  model:  'nano',                             // 'nano' | 'tiny' | 's' | custom spec
  camera: { facingMode: 'environment' },      // rear camera is the default here
  onFps:  (fps) => { hud.textContent = `${fps} FPS`; },
  onResult: ({ detections }) => { /* app logic - shape below */ },
});

await vision.switchModel('s');     // trade frame rate for accuracy
const r = await vision.detect(img); // one-off detection on an <img> or canvas
vision.stop();                      // release camera + free model memory
```

Each detection is `{ label, classId, score, box: { x, y, width, height } }` in source-frame pixels - drawing on a canvas sized to the frame lines up 1:1 (`mountDetect` already draws boxes; `onResult` is for app logic like counting).

Detections arrive sorted by descending `score`, and suppression is **class-aware** - a box only suppresses an overlapping box of the *same* `classId`. So one real-world object can surface as several overlapping detections with different labels: an ambiguous animal yields both a `cat` box and a `dog` box. Don't assume one detection per object. When a class must not fire for a look-alike (`dog` but never `cat`), compare the overlapping boxes' scores and require a margin, rather than acting on the first matching label you find.

For a custom loop, compose the low-level exports instead: `createDetector`, `startCamera`, `createLoop`, `drawDetections`, plus pure-math `decodeYolox` / `decodeYolo` / `nms`. See `src/packages/web-vision-detect/examples/` and its `README.md`.

## Models

| `model` | Download | COCO mAP | Use when |
|----------|----------|----------|----------|
| `nano` (default) | 3.7 MB | 25.8 | Instant start, phones, casual demos |
| `tiny` | 20 MB | 32.8 | Noticeably better accuracy, still fast |
| `s` | 36 MB | 40.5 | Accuracy is the point; fine on WebGPU |

Presets are official YOLOX exports hosted on the Gipity CDN, fetched on first use and browser-cached. **Custom models:** pass `model: { url, format, inputSize, labels }` - `format: 'yolox'` for YOLOX exports, `format: 'yolo'` for Ultralytics YOLOv8/v11 `model.export(format='onnx')`. This is the deploy path for "I trained a detector on Roboflow/Ultralytics and want it in an app".

## Notes and common mistakes

- **Pick the right vision kit.** Gesture or body pose -> `web-vision-mediapipe`. Detection accuracy, counting, or custom classes -> this kit. The MediaPipe kit's EfficientDet-Lite detector is demo-grade; this kit's `tiny`/`s` presets are meaningfully stronger.
- **The canvas must overlay the video** at the same on-screen size. The kit sizes the canvas backing store to the camera frame; CSS `object-fit: cover` on *both* keeps the overlay aligned. A front camera reads naturally with `transform: scaleX(-1)` on the video only - pass `mirror` and the kit flips box geometry while captions stay upright.
- **Camera needs a user gesture and a secure origin.** Call `mountDetect` from a click handler, not on page load, and deploy over HTTPS.
- **Verify counting/labeling logic without a camera - the live-camera path can't be tested headlessly.** A headless `gipity page eval` browser has no webcam, so it only hits the "camera unavailable" gate. Keep your `onResult` consumer in a plain function exposed on `window` and feed it synthetic detections (`{ detections:[{ label:'person', score:0.9, box:{x:0,y:0,width:10,height:10} }] }`) from `page eval`; the picked-photo path you can drive by setting the file input directly. See [app-debugging](https://docs.gipity.ai/skills/app-debugging.html).
- **Inference is async - never run it per rAF tick yourself.** Use the kit's `createLoop` (or `mountDetect`), which skips camera frames while an inference is in flight.
- **First use downloads the runtime + model** (~13-26 MB of ONNX Runtime WASM shared across models, plus the model file), then everything is browser-cached. Expect a pause on the very first frame; tell users.
- **Frame rate varies a lot by backend.** WebGPU runs `nano` at camera speed on most laptops and recent phones; plain WASM is several times slower. `result.backend` / `vision.currentBackend()` says which one loaded - stay on `nano` when it reports `wasm`.
- **License:** YOLOX and the bundled presets are Apache-2.0, ONNX Runtime is MIT - free for commercial use, no copyleft obligation on the app. Ultralytics YOLO models are **AGPL-3.0** - the kit can load one as a custom model, but never bundle one into an app by default; flag the license to the user instead.
