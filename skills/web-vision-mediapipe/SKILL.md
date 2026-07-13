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

**Start a fresh camera app** - add the `web-vision-cam` starter: a fullscreen camera app that already switches between gesture, object, and pose detection with a live FPS readout, kit pre-installed:

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
  onGesture: (name) => playRound(name),       // gesture task: one event per deliberate throw
  onResult: (result, kind) => { /* raw per-frame result - see shapes below */ },
});

vision.gesture();                  // ...or ASK what the hand is holding right now (or null)
await vision.switchTask('pose');   // swap model, camera keeps running
await vision.flipCamera();         // front <-> rear
vision.stop();                     // release camera + free GPU memory
```

`mountVision` runs the camera, the inference loop, and the overlay drawing. Also on the handle: `resetGesture()`, `detectFrom(source)`, `setCamera()`, `hasMultipleCameras()`, `currentTask()`, `currentFacingMode()`, `currentMirror()`.

For a custom loop, compose the low-level exports instead: `createTask`, `startCamera`, `createLoop`, `draw`, `fitCanvas`, `clearCanvas`. See `src/packages/web-vision-mediapipe/examples/` and its `README.md`.

## Reading gestures - push or pull

Don't act on the raw per-frame label. The model re-classifies ~30x a second and a hand mid-throw passes through several labels, so an app built straight on `onResult` fires on noise. The kit ships a commit gate that settles it, readable two ways:

**Push - `onGesture(name)`** fires once, on the frame the pose settles, and not again until the hand *changes*. Right for "do a thing when the user throws a gesture": a shortcut, a menu pick, a shutter.

**Pull - `vision.gesture()`** returns what the hand is holding right now, once it has been held steady for `holdMs` - or `null`. Right for anything on the app's own clock; a "3, 2, 1, shoot!" countdown samples it at shoot:

```js
const thrown = vision.gesture();   // 'Closed_Fist' | 'Open_Palm' | 'Victory' | ... | null
vision.resetGesture();             // drop the hold before the next round
```

**Don't cache push events and read them as pull.** `onGesture` deliberately won't re-fire while the hand is unchanged, so a player who throws rock two rounds running would score round two off a stale event. On a clock, pull.

Tune both with `gestureHold: { holdMs = 500, minScore = 0.5, hand = 0 }`. For a custom loop, `GESTURES` (the recognised list) and `gestureName(result)` (dig the label out of one raw result, `None` and sub-threshold scores included) are exported too.

## Tasks and result shapes

`kind` selects the model. Each `onResult` / `task.detect()` value is the native MediaPipe result:

| `kind`    | Detects | Key fields |
|-----------|---------|------------|
| `gesture` | Hands + recognised gesture | `result.gestures[hand][0]` → `{ categoryName, score }`; `result.landmarks[hand]` → 21 points |
| `detect`  | The 80 COCO object classes | `result.detections[]` → `{ boundingBox, categories: [{ categoryName, score }] }` |
| `pose`    | Body skeleton | `result.landmarks[person]` → 33 points `{ x, y, z, visibility }` |

Recognised gestures: `Thumb_Up`, `Thumb_Down`, `Open_Palm`, `Closed_Fist`, `Victory`, `Pointing_Up`, `ILoveYou`. An unrecognised pose is reported as the literal category `None`, *not* an empty list - the gesture API above already turns that (and anything under `minScore`) into `null`, so only raw `onResult` consumers need to handle it. For a game: rock = `Closed_Fist`, paper = `Open_Palm`, scissors = `Victory`.

## Notes and common mistakes

- **Gesture is the strong task.** Object detection uses EfficientDet-Lite - fast but modest accuracy. Good for a demo; do not promise production-grade detection. For high-accuracy detection, counting, or custom classes, use the `web-vision-detect` kit (YOLOX) instead.
- **The canvas must overlay the video** at the same on-screen size. The kit sizes the canvas backing store to the camera frame; CSS `object-fit: cover` on *both* keeps the overlay aligned. A front camera reads naturally with `transform: scaleX(-1)` on both.
- **Mount on page load, not behind a click.** The WASM runtime and the model start downloading the moment the module is imported, so that multi-MB fetch finishes while the user is still looking at the camera permission prompt. Keep an "Enable camera" button as the *retry* path for a browser that insists on a tap first - it simply rejects, and the gate stays up (this is what the `web-vision-cam` starter does). Gating the first mount behind a click throws away the overlap and blocks the headless check below. A secure origin is non-negotiable, though: `getUserMedia` fails on plain HTTP, so deploy over HTTPS.
- **Verify it with a real camera - `--camera` plays a picture as the webcam.** The kit publishes its own state for exactly this: `<html data-vision="loading|ready|error|stopped">` and the live handle on `window.__vision`. So a headless check reads the deployed app's real camera → inference → gesture path with no webcam, no click, and no app-specific test hook:

```
gipity page eval <url> --camera ./fist.jpg --wait-for '[data-vision="ready"]' --wait-timeout 20000 "window.__vision.gesture()"   # -> 'Closed_Fist'
gipity page screenshot <url> --camera ./fist.jpg --wait-for '[data-vision="ready"]'                                              # see the round play out
```

  Wait on `[data-vision="ready"]` (first frame drawn) rather than guessing a fixed `--wait`. Give it room on a cold load - the model download lands on that first frame, and `page eval`'s `--wait-timeout` defaults to only 5s (max 30s; `page screenshot` already defaults to 15s). **A plain page load with no `--camera` lands on `data-vision="error"` - that is the app working, not a bug.** Don't add your own debug hooks on `window` to test this ([app-debugging](https://docs.gipity.ai/skills/app-debugging.html)) - `window.__vision` is the kit's own API surface, already there, and it's all you need. No hand photo around? `gipity generate image "photo of a closed fist, plain background"`. To ask whether the *model* sees a fist in a picture, with no camera and no app wiring in the way: `await vision.detectFrom('/fixtures/rock.png')`.
- **One `detect()` per frame.** Timestamps must strictly increase; `mountVision`/`createLoop` already handle this. Do not call `task.detect()` twice for the same frame.
- **First use downloads the model** (~3-8 MB) from Google's CDN, then it is browser-cached - expect a short delay on the first frame of each task.
- **License:** MediaPipe and its default models are Apache-2.0 - free for commercial use, no copyleft obligation on the app.
