---
name: web-vision-mediapipe
description: "Use when the user wants an app that sees through the camera - gesture recognition, body/pose tracking, object detection - running on-device in the browser, including on phones, with no server and no API keys. The Gipity web-vision kit and camera starter app."
---

<!-- GENERATED from platform/docs/skills/web-vision-mediapipe.md by platform/scripts/sync-claude-plugin.ts - do not edit here. -->

> **Gipity required.** This skill needs the `gipity` CLI linked to a project. If `gipity status` errors or shows no project, run the setup flow in the `gipity` skill (or `/gipity:setup`) first.
>
> This doc is shared across Gipity surfaces; where it names an agent tool, use the CLI equivalent: `add` → `gipity add <name>`, `file_write`/`file_read`/`file_delete` → edit files in the project directory directly (they auto-sync), `project_deploy` → `gipity deploy dev`, `code_execute` → `gipity sandbox run`. The live version of this doc: `gipity skill read web-vision-mediapipe`.

# Browser Vision (MediaPipe)

`web-vision-mediapipe` is a **kit** - a reusable building block added into an existing web app. It wraps Google [MediaPipe Tasks](https://ai.google.dev/edge/mediapipe) so an app can read the camera and run **gesture recognition**, **body pose**, or **object detection** entirely in the browser.

On-device: no server, no upload, the camera stream never leaves the device. Inference is WASM + WebGL-accelerated. **Web only** - it needs `getUserMedia`, WASM, and a canvas, so it runs only on HTTPS or `localhost`.

## Two ways in

**Start a fresh camera app** - add the `web-vision-cam` starter. It is a fullscreen camera app that already switches between gesture, object, and pose detection with a live FPS readout, and ships the kit pre-installed:

```
add name=web-vision-cam title="..."
```

**Add vision to an existing web app** - install the kit into it:

```
add name=web-vision-mediapipe
```

This copies the kit to `src/packages/web-vision-mediapipe/` and wires the import map in `src/index.html` (the kit specifier plus `@mediapipe/tasks-vision`). There is no deploy phase - it is pure client-side, so a plain static app needs nothing else.

## Using the kit

The whole job is two elements - a `<video>` for the camera and a `<canvas>` overlaying it - plus one call:

```js
import { mountVision } from '@gipity/web-vision-mediapipe';

const vision = await mountVision({
  video:  document.querySelector('video'),
  canvas: document.querySelector('canvas'),
  kind:   'gesture',                          // 'gesture' | 'detect' | 'pose'
  camera: { facingMode: 'user' },             // 'user' (front) | 'environment' (rear)
  onFps:  (fps) => { hud.textContent = `${fps} FPS`; },
  onResult: (result, kind) => { /* app logic - see result shapes below */ },
});

await vision.switchTask('pose');   // swap model, camera keeps running
vision.stop();                     // release camera + free GPU memory
```

`mountVision` runs the camera, the inference loop, and the overlay drawing. For a custom loop, compose the low-level exports instead: `createTask`, `startCamera`, `createLoop`, `draw`, `fitCanvas`, `clearCanvas`. See `src/packages/web-vision-mediapipe/examples/` and its `README.md`.

## Tasks and result shapes

`kind` selects the model. Each `onResult` / `task.detect()` value is the native MediaPipe result:

| `kind`    | Detects | Key fields |
|-----------|---------|------------|
| `gesture` | Hands + recognised gesture | `result.gestures[hand][0]` → `{ categoryName, score }`; `result.landmarks[hand]` → 21 points |
| `detect`  | The 80 COCO object classes | `result.detections[]` → `{ boundingBox, categories: [{ categoryName, score }] }` |
| `pose`    | Body skeleton | `result.landmarks[person]` → 33 points `{ x, y, z, visibility }` |

Recognised gestures: `Thumb_Up`, `Thumb_Down`, `Open_Palm`, `Closed_Fist`, `Victory`, `Pointing_Up`, `ILoveYou` (and `None`).

## Notes and common mistakes

- **Gesture is the strong task.** Object detection uses EfficientDet-Lite - fast but modest accuracy. Good for a demo; do not promise production-grade detection. If a project needs high-accuracy detection, counting, or custom classes, use the `web-vision-detect` kit (YOLOX) instead.
- **The canvas must overlay the video** at the same on-screen size. The kit sizes the canvas backing store to the camera frame; CSS `object-fit: cover` on *both* keeps the overlay aligned. A front camera reads naturally with `transform: scaleX(-1)` on both.
- **Camera needs a user gesture and a secure origin.** Call `mountVision` from a click handler, not on page load, and deploy over HTTPS - `getUserMedia` fails on plain HTTP.
- **One `detect()` per frame.** Timestamps must strictly increase; `mountVision`/`createLoop` already handle this. Do not call `task.detect()` twice for the same frame.
- **First use downloads the model** (~3-8 MB) from Google's CDN, then it is browser-cached. Expect a short delay on the first frame of each task.
- **License:** MediaPipe and its default models are Apache-2.0 - free for commercial use, no copyleft obligation on the app.
