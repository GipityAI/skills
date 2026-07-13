---
name: 3d-world
description: "Use when the user wants a 3D browser game or a multiplayer game - obby, tycoon, simulator, PvP arena, shooter, racing - live on the web. Three.js + physics + multiplayer template on Gipity, with genre recipes, assets, and networking built in."
---

<!-- GENERATED from platform/docs/skills/3d-world.md by platform/scripts/sync-claude-plugin.ts - do not edit here. -->

> **Gipity required.** This skill needs the `gipity` CLI linked to a project. If `gipity status` errors or shows no project, run the setup flow in the `gipity` skill first (in Claude Code or Grok: `/gipity:setup`).
>
> This doc is shared across Gipity surfaces; where it names an agent tool, use the CLI equivalent: `add` → `gipity add <name>`, `file_write`/`file_read`/`file_delete` → edit files in the project directory directly (they auto-sync), `project_deploy` → `gipity deploy dev`, `code_execute` → `gipity sandbox run`. The live version of this doc: `gipity skill read 3d-world`.

# 3D World - 3D Multiplayer Starter

**3D World** is a playable starter app on Gipity - a multiplayer rocket-launcher demo built on the `3d-engine` template. Use it when you want a working reference or a fun playground. All 3D World games share the same visual style, physics, and multiplayer backend.

**When to use this:** When the user asks for a 3D World game, a playable 3D reference, or a multiplayer shooter. For a fresh build without rocket-launcher / demo-scene content to strip out, add `3d-engine` instead and build your own features. For 2D games (platformer, puzzle, arcade) add `2d-game`. For non-game web apps (wordle, quiz, card games), use `web-simple` or `web-fullstack`.

## Quick Start - Start Here

**STRONGLY RECOMMENDED:** Begin every 3D World game by adding the `3d-world` template with `add`. It sets up Three.js, Rapier physics, Gipity Realtime multiplayer, player controls, and the full engine layer for you. Only hand-roll files if the user explicitly tells you to skip the template.

```
add name=3d-world title="<Game Name>"
```

**Starting over in an existing project:** If `src/` already exists and the user wants a clean rebuild, call `file_delete` on `src` first, then run `add` normally. Or pass `force=true` to `add` to overwrite in one step - destructive, so confirm with the user first. Unrelated content (media, data, notes) is preserved either way.

**Naming:** Use the user's name verbatim if given. If they didn't specify, blend "Gip" or "Gipity" into the name (e.g. "Gipity World", "GipCraft") - be creative but don't force it.

This creates a playable game immediately - ground, player character, physics, camera, mobile controls. Then edit `config.js` and `game.js` to build your game.

## Project Structure

After installing the template, list all files with `file_list` and read them to understand the project. All files are in `src/` and fully editable. Key files:

- `game.js` - Main orchestrator. Start here.
- `config.js` - Project metadata (title, room, features).
- `settings.js` - Tunable gameplay values (colors, speeds, sizes, camera).
- `strings.js` - User-facing display text.
- `scene.js` - Demo scene setup. Replace with your own world.
- `core.js` - Engine entry point. Exports all engine modules.

The engine source ships in `src/` too. Every engine file opens with a header comment listing its exports and invariants - read the source when you need a detail this doc doesn't cover:

- `primitives.js` - Part system + `workspace`. `PART_DEFAULTS` at the top lists every Part property with its exact default.
- `assets.js` - models, sounds, and `MATERIAL_PRESETS` (per-material friction/elasticity + visual settings).
- `player.js` - character controller and camera (physics model in its header).
- `physics.js` - Rapier world, raycasting, triggers.
- `world.js` - Three.js scene, camera, renderer, lighting.
- `ui.js` - HUD, loading screen, message overlays.
- `shapes.js` - voxel shape library. `constraints.js` - joints. `features.js` - feature registry. `network.js` + `packages/realtime/` - multiplayer.

Read the files before making changes - the comments explain what each one does.

## Engine API

All engine modules are available via a single import:

```js
import { world, assets, physics, player, network, ui, THREE, onInit, onUpdate, setConfig, primitives, constraints, workspace, features, advance, whenReady } from './core.js';
```

### Verifying it headlessly

`advance(seconds)` steps the world at a fixed timestep with rendering skipped, and `whenReady()` resolves once boot finishes. Drive them from `gipity page eval` instead of waiting on real time: the headless browser paints at ~2-3 fps and the loop caps its frame delta, so a wall-clock wait advances the simulation ~12x slower than it looks and reports collisions that never happened.

```js
const core = await import('./js/core.js');
await core.whenReady();
core.advance(3);   // 3s of world time, ~110ms real, bit-identical every run
```

Both are exported from `core.js`. See the `app-debugging` skill.

### Lifecycle

```js
// settings.js - tunable values
export const settings = {
  colors: { player: 0xf26522, ground: 0x4CAF50, objects: 0x2196F3 },
  world: { groundSize: 30 },
  gameplay: { objectCount: 5, spawnRange: 20, messageDuration: 3000 },
};

// strings.js - user-facing text
export const strings = { welcome: 'My Game' };

// objects.js - entity factories
import { world, assets, physics } from './core.js';
import { settings } from './settings.js';
export function createBlock(x, y, z, color = settings.colors.objects) { ... }

// game.js - orchestrator
import { setConfig, onInit, onUpdate, world, assets, physics, player, ui, THREE } from './core.js';
import { config } from './config.js';
import { settings } from './settings.js';
import { strings } from './strings.js';
import { createBlock } from './objects.js';

setConfig(config);

onInit(async () => {
  player.initPlayer({ color: settings.colors.player });

  const { groundSize } = settings.world;
  const ground = assets.createVoxelGround(groundSize, groundSize, settings.colors.ground);
  world.scene.add(ground);
  physics.addStaticBox({ x: 0, y: -0.5, z: 0 }, { x: groundSize / 2, y: 0.5, z: groundSize / 2 });

  const { objectCount, spawnRange } = settings.gameplay;
  for (let i = 0; i < objectCount; i++) {
    createBlock(Math.random() * spawnRange - spawnRange / 2, 0.5, Math.random() * spawnRange - spawnRange / 2);
  }

  ui.showMessage(strings.welcome, settings.gameplay.messageDuration);
});

onUpdate((dt) => {
  // Game update loop - runs every frame
});
```

### World (`world`)
- `world.scene` - Three.js Scene (add objects here)
- `world.camera` - PerspectiveCamera (auto-follows player)
- `world.renderer` - WebGLRenderer
- `world.clock` - Three.js Clock

### Assets (`assets`)
- `assets.spawn(name, {x,y,z}, scale)` - Load and add a model to the scene
- `assets.despawn(model)` - Remove a model
- `assets.loadModel(name)` - Load a model (returns clone)
- `assets.createVoxelBox(color, size)` - Simple colored cube
- `assets.createVoxelGround(width, depth, color)` - Instanced voxel ground plane
- `assets.playSound(name, {volume})` - Play a sound effect
- `assets.getTexture(name)` - Load a texture

### Physics (`physics`)
- `physics.addStaticBox(pos, halfExtents)` - Static collider (floor, wall)
- `physics.addDynamicBox(pos, halfExtents, mass)` - Dynamic physics body
- `physics.addKinematicBody(pos, halfExtents)` - Kinematic controller
- `physics.addTrigger(pos, halfExtents, {onEnter, onExit})` - Sensor zone
- `physics.removeBody(body)` - Remove a body
- `physics.castRay(origin, dir, maxDist, excludeBody?)` - Raycast; returns `{ point, distance, collider }` or `null`. Pass the shooter's own body as `excludeBody` so a shot doesn't hit itself.
- `physics.applyImpulse(body, {x,y,z})` - Shove a body (pure translation, no spin). Use `part._body` for a Part.
- `physics.applyImpulseAtPoint(body, {x,y,z}, worldPoint)` - Shove with torque from the offset, so edge hits spin realistically.
- `physics.queryNearby(pos, radius)` - Broadphase proximity; returns `[{ collider, body }]` (explosions, area effects).

### World Primitives (`primitives`) - v13+

Parts are the universal 3D building block. **Dynamic (gravity-on) by default.** Each Part is a 3x3x3 sub-voxel grid for detailed shapes.

```js
// Create parts - they fall with gravity by default
const crate = primitives.createPart({ position: {x:0, y:10, z:0}, color: 0x8B4513, material: 'wood' });

// Anchored = no gravity, stays in place
const floor = primitives.createPart({ position: {x:0, y:0, z:0}, size: {x:20, y:1, z:20}, anchored: true, material: 'metal' });

// Sub-voxel shapes: FULL, SLAB, HALF, STAIR, SLOPE, CORNER, PILLAR, ARCH
const stair = primitives.createPart({ position: {x:3, y:1, z:0}, shape: primitives.SHAPES.STAIR, color: 0x4CAF50 });

// Runtime property changes
primitives.setProperty(crate, 'anchored', true);   // freeze in place
primitives.setProperty(crate, 'material', 'ice');   // change material (updates physics + visual)
primitives.setProperty(crate, 'color', 0xff0000);

// Query and remove
const redParts = primitives.queryParts({ color: 0xff0000 });
primitives.removePart(crate);
```

**Part properties:** position, rotation (quaternion), size, anchored, canCollide, massless, mass, friction, elasticity, linearDamping, angularDamping, color, material, transparency, shape, castShadow, receiveShadow. Exact defaults: `PART_DEFAULTS` at the top of `primitives.js`. Setting `material` overrides friction+elasticity from its preset in `assets.js`.

**Materials:** plastic (default), metal, wood, glass, neon, ice, grass, sand, concrete - each sets visual + physics defaults. An unknown name warns in the console and falls back to plastic.

**Spawn points:**
```js
primitives.createSpawnPoint({ position: {x:0, y:2, z:0}, teamColor: 0xff0000 });
```

### Compound Blocks (`primitives.createCompoundBlock`)

Destructible blocks - a grid of welded sub-blocks that shatter on impact:

```js
// 3x3x3 destructible block (27 welded 1x1x1 parts)
const block = primitives.createCompoundBlock({
  position: { x: 5, y: 1.5, z: 0 },
  color: 0xff0000,
  breakForce: 8,         // velocity delta threshold (higher = harder to break)
  gridSize: 3,           // blocks per axis (default 3 → 27 blocks)
  blockSize: 1,          // size of each sub-block (default 1)
  material: 'wood',      // material preset
  colorVariation: true,  // slight brightness variation per block (default true)
});

block.break(block.parts[0]);  // free a specific sub-block
block.breakAll();              // shatter everything
block.isIntact();              // any welds remaining?
block.parts;                   // array of all sub-block Parts
```

### Constraints (`constraints`) - v13+

Connect Parts with physical joints:

```js
// Weld - rigid lock (structures, attached parts)
constraints.weld(partA, partB);

// Hinge - rotation on one axis (doors, wheels, levers)
constraints.hinge(frame, door, { axis: {x:0,y:1,z:0}, limits: [-90, 90] });

// Spring - elastic (suspension, ropes, bouncy platforms)
constraints.spring(partA, partB, { stiffness: 100, damping: 10 });

// Management
constraints.getAll(part);     // all constraints on a part
constraints.remove(c);        // remove one
constraints.removeAll(part);  // remove all
```

### Workspace (`workspace`) - v13+

World-level settings:

```js
workspace.gravity = {x: 0, y: -30, z: 0};
workspace.snapEnabled = false;       // DEFAULT IS true: any two dynamic Parts within snapDistance auto-WELD into one rigid body. Great for snap-together building, but it fuses a hand-stacked tower solid so it can't topple. Set false for free-tumbling physics.
workspace.snapDistance = 0.15;       // weld radius when snap is on
workspace.lighting.timeOfDay = 18;   // sunset (0-24)
workspace.lighting.fogEnabled = true;
workspace.lighting.fogNear = 40;
workspace.onSnap((a, b) => console.log('snapped'));
```

### Camera Modes - v13+

```js
player.cameraControl.mode = 'orbit';       // default third-person
player.cameraControl.mode = 'firstPerson'; // FPS
player.cameraControl.mode = 'topDown';     // birds-eye
player.cameraControl.mode = 'fixed';       // scriptable
player.cameraControl.setFixedPosition({x:10, y:8, z:10});
player.cameraControl.setFixedLookAt({x:0, y:0, z:0});
```

### Player (`player`)
- `player.initPlayer({color, x, y, z})` - Create the player character
- `player.getPosition()` - Get {x, y, z}
- `player.setPosition(x, y, z)` - Teleport player
- `player.inputState` - Current input: {forward, right, jump, action}
- `player.cameraControl` - Camera mode and settings (see above)

**Camera comfort (ship it by default).** Mouse-look tuning is the #1 source of "the controls feel wrong" feedback, so the player module bakes in **Invert-Y** and adjustable **sensitivity**, both persisted per-browser in `localStorage`:
- `player.setInvertY(bool)` / `player.getInvertY()` — invert vertical look. Players can also toggle it live with the **I** key.
- `player.setSensitivity(number)` / `player.getSensitivity()` — mouse-look speed.
- Config defaults: `initPlayer({ camera: { invertY: false, sensitivity: 0.003 } })`. A stored user choice wins over the config default on reload.

For any first-person app, **wire a visible control** (a toggle button + a sensitivity slider in a settings/pause panel) to `setInvertY`/`setSensitivity` — don't rely on the hidden `I` key alone. This is a default expectation, not a nice-to-have.

The player is a **dynamic rigid body** (added mass 2): it shoves and knocks over dynamic Parts on contact for free. Its rotation is locked, so it stays upright and never topples.

### Network (`network`)

Multiplayer rides on the engine-agnostic `@gipity/realtime` kit (`packages/realtime/`). The `network` module is a thin 3D facade over it:

- `network.avatars` - presence channel of remote players. `.peers()` returns a Map of `{position, rotation}`; `.onJoin(cb)` / `.onLeave(cb)` fire on membership changes. The `multiplayer` feature already spawns and moves a mesh per peer.
- `network.channel(name, { sync })` - open a custom channel. `sync: 'messages'` gives pub/sub (`.send(type, data)` / `.on(type, cb)`) for game events.
- `network.enableWorldSync()` - host-authoritative shared-world sync (or just set `sync.worldState` on the multiplayer feature).
- `network.rt` - the underlying realtime instance: `.on(event)`, `.metrics()`.

The room is already declared in the template's `gipity.yaml` (a `realtime` deploy phase), so `gipity deploy` provisions it automatically - no separate step. To add or manage rooms: `gipity realtime room create|list|info|delete`, or the `realtime_room` tool. See the `app-realtime` skill.

### UI (`ui`)
- `ui.setHud(slot, html)` - Set HUD content. Slots: top-left, top-right, bottom-left, bottom-right, center
- `ui.clearHud(slot)` - Clear a slot
- `ui.showMessage(text, duration)` - Centered message (0 = sticky)
- `ui.debug(msg)` - Log to the in-game debug panel

### InfoPanel (`ui.InfoPanel`) - v13+

Reusable 3D World-styled info display. Use for stats, inventories, leaderboards, dialogs, etc.

```js
// Create a panel
const stats = new ui.InfoPanel({ title: 'Player Stats', position: 'top-right' });
stats.addRow('Health', '100', { color: '#0f0' });
stats.addRow('Score', '0', { bold: true });
stats.addRow('Ammo', '30');

// Update values (call in onUpdate or on events)
stats.setRow('Health', '75', { color: '#ff0' });
stats.setRow('Score', '1500');

// Remove a row
stats.removeRow('Ammo');

// Toggle with a key
const inv = new ui.InfoPanel({ title: 'Inventory', position: 'bottom-right', toggleKey: 'KeyI', visible: false });

// Custom position
const custom = new ui.InfoPanel({ position: 'custom', top: 100, right: 20, width: 200 });

// Raw HTML content
stats.setContent('<table>...</table>');

// Cleanup
stats.destroy();
```

**Options:** title, position (top-left/top-right/bottom-left/bottom-right/custom), width, visible, compact, toggleKey

**Built-in debug panel:** F3 toggles version info + FPS + console logs (ON by default)

### Debug Panel
Press **`** (backtick) to toggle the built-in debug panel. Shows:
- FPS counter
- All `console.log`, `console.warn`, `console.error` output
- Use `ui.debug('message')` to log from game code

## Asset Catalog

Models, sounds, and textures are loaded by name from the shared CDN. Use `assets.spawn('name')` for models, `assets.playSound('name')` for sounds, `assets.getTexture('name')` for textures.

**Note:** The asset pack is being built. For now, use the built-in helpers:
- `assets.createVoxelBox(color, size)` - colored cube for any object
- `assets.createVoxelGround(width, depth, color)` - terrain plane
- Create custom geometry with THREE.js directly

## Genre Recipes

### Obby / Parkour
- Platforms at varying heights with physics.addStaticBox
- Checkpoints as triggers (save spawn point)
- Kill zones below platforms (trigger → respawn at last checkpoint)
- Timer in HUD (top-right)
- Finish trigger → show completion time

### Tycoon
- Resource nodes (triggers that give currency on proximity)
- Shop system (ui.setHud for buy menu)
- Upgrades stored in game state
- Auto-generation timer
- Persist progress with App API functions: write save/load functions in `functions/`

### Simulator (Collect & Sell)
- Collectibles scattered as voxel boxes with triggers
- Inventory count in HUD
- Sell zone (trigger → convert items to currency)
- Upgrade tiers (speed, capacity, multiplier)
- Leaderboard via App API

### PvP Combat
- Health bar in HUD
- Weapon hitbox via raycast (physics.castRay)
- Damage events via a `network.channel('combat', { sync: 'messages' })` channel
- Respawn timer + invincibility frames
- Score tracking

### Shooter (FPS/TPS)
- Camera mode: set in config.js
- Crosshair in HUD center
- Projectile: spawn small box, apply velocity, raycast for hit detection
- Ammo count in HUD
- Network: broadcast shots, validate hits server-side

### Tower Defense
- Path defined as waypoint array
- Enemy spawner on interval
- Tower placement on grid (snap to voxel)
- Projectile system (tower → nearest enemy)
- Wave counter + health in HUD

### Horror
- Override world lighting: dim the sun, add fog closer
- Flashlight: spotlight attached to camera
- Jump scare: trigger zones that play sounds + show images
- Inventory: key-item tracking
- Narrative: text messages via ui.showMessage

### Racing
- Checkpoints as triggers around a track
- Lap counter + timer in HUD
- Speed boost zones (triggers that increase velocity)
- Vehicle: replace player model, adjust move speed
- Multiplayer: position sync shows other racers

## Multiplayer Patterns

### Custom game events
Open a `messages` channel and send/receive typed events. Each channel namespaces its own wire types, so use as many as you like:
```js
import { network } from './core.js';

const events = network.channel('events', { sync: 'messages' });
events.send('item_collected', { itemId: 'coin-3', points: 10 });
events.on('item_collected', (data) => {
  removeItem(data.itemId);
  updateScore(data.points);
});
```

### Remote players
The `multiplayer` feature already renders remote-player avatars for you, driven by the `network.avatars` presence channel. To react to joins/leaves yourself:
```js
network.avatars.onJoin((sid) => console.log('joined', sid));
network.avatars.onLeave((sid) => console.log('left', sid));
for (const [sid, peer] of network.avatars.peers()) {
  // peer.position {x,y,z}, peer.rotation (y radians)
}
```

## Persistence

Use App API functions to save/load player data:

```js
// functions/save-progress.js
export default async function (ctx, { db }) {
  const { data } = ctx.body;
  await db.execute(
    'INSERT INTO saves (user_guid, data) VALUES ($1, $2) ON CONFLICT (user_guid) DO UPDATE SET data = $2',
    [ctx.auth.userGuid, data]
  );
  return { ok: true };
}

// functions/load-progress.js
export default async function (ctx, { db }) {
  const row = await db.findOne('saves', { user_guid: ctx.auth.userGuid });
  return { data: row?.data ?? null };
}
```

Declare in `gipity.yaml`:
```yaml
functions:
  save-progress:
    auth_level: user
    tables: [saves]
  load-progress:
    auth_level: user
    tables: [saves]
```

## Mobile Support

Touch controls are automatic (built by the engine's `js/mobile.js`, wired in `player.js`):
- Left half: **floating virtual joystick** - the pad appears wherever the thumb lands; analog movement
- Bottom-right: **Jump** (primary, bigger) + **Action** buttons; Action drives `inputState.action` (same as the E key - the rocket-launcher feature fires from it)
- Drag anywhere else on the canvas: orbit the camera
- Top-right: **fullscreen toggle** (auto-hidden where the Fullscreen API is unavailable, e.g. iPhone Safari - there "Add to Home Screen" runs fullscreen via the template's PWA meta tags)
- Detection is by pointer type (`pointer: coarse`), so phones AND tablets get controls in both portrait and landscape; hybrid touchscreen laptops get them on first touch. Nothing renders on mouse-only desktops.
- Buttons respect notch/home-bar safe areas; multi-touch is tracked per pointer so joystick + button + camera drag work simultaneously

Keep custom games working on both inputs: read movement from `player.inputState` (fed by keyboard and joystick alike) and trigger actions from `inputState.action` / `inputState.jump` rather than raw key events.

## Features (Opt-in Gameplay Modules)

Enable built-in gameplay features via `config.features`. Features are template-level modules that auto-initialize during boot.

### Enabling a Feature

In `config.js`:
```js
export const config = {
  title: 'My Game',
  features: {
    'rocket-launcher': true,  // enable with defaults
  },
};
```

With custom settings:
```js
features: {
  'rocket-launcher': {
    speed: 200,       // projectile speed (default: 120)
    cooldown: 1.0,    // seconds between shots (default: 0.15)
    blastRadius: 5,   // explosion radius (default: 10)
    blastForce: 60,   // knockback strength (default: 40)
    maxDistance: 300,  // max range (default: 150)
    size: 3.0,        // rocket model scale (default: 2.0)
  },
}
```

### Interacting with Features in game.js

```js
import { features } from './core.js';

onInit(() => {
  const rl = features.get('rocket-launcher');
  if (rl) {
    rl.onHit((pos) => { /* rocket hit something at pos */ });
    rl.onExplode((pos) => { /* explosion at pos */ });
    rl.onFire((origin, dir) => { /* rocket fired */ });
  }
});
```

### Available Features

| Feature | Key | Description |
|---------|-----|-------------|
| Multiplayer | `multiplayer` | `@gipity/realtime` transport + remote-player avatars rendered automatically. Optional host-authoritative world-state sync via `sync.worldState: true`. Disable with `'multiplayer': false` for solo games. |
| Rocket Launcher | `rocket-launcher` | Projectile weapon with physics explosions. Left-click to fire, B for debug traces. |

### Multiplayer in Depth

Multiplayer is a feature like rocket-launcher - flip it on or off. It runs on the engine-agnostic `@gipity/realtime` kit in `packages/realtime/` (that package's `README.md` and `examples/` show non-game uses too). By default it connects, broadcasts the local player at ~20 Hz on the `avatars` presence channel, and renders a mesh for every remote peer.

Solo / single-player game:
```js
features: { 'multiplayer': false }
```

Basic multiplayer (default):
```js
features: { 'multiplayer': { room: 'my-arena' } }
```

Authoritative world state (host-elected, drift-corrected). Use when every client must see the same blocks/objects in the same place - e.g. shared sandbox or destructible level:
```js
features: { 'multiplayer': { room: 'lobby', sync: { worldState: true } } }
```

With `sync.worldState` on, the feature creates a host-authoritative `world` entities channel. The 3D adapter (`js/network/adapter-3d.js`) already knows how to serialize and apply Parts - no game-side registration needed. The first client to join becomes host (3-phase claim election); if the host drops, another client takes over automatically (a client holding world data is promoted instantly, else alphabetical tiebreaker).

To sync your own non-Part state, open an `entities` channel directly and supply an adapter - see `packages/realtime/contracts/adapter.contract.md` and the worked `examples/`.

## Performance Tips

- Use `assets.createVoxelGround()` - it uses InstancedMesh (one draw call for entire ground)
- For many identical objects, use THREE.InstancedMesh instead of individual meshes
- Keep total triangle count under 100K for mobile
- Limit shadow-casting objects (only player + key objects)
- Use fog to hide pop-in at draw distance

## Deploy Verification

Use the browser tool to verify deploys when it matters - first deploy, structural changes (new pages, new frameworks, changed imports), or when something might have broken. Skip verification for trivial changes (copy tweaks, style adjustments, config values).

To verify: `browser action=open url=<deployed-url>` - waits for async modules, captures console errors automatically. Check output for `[Console errors captured after page load]`. Use `browser action=screenshot` to confirm visual correctness.

**Debugging in production:** Add `console.error()` calls to app code for diagnostics, redeploy, then use `browser action=console` to read the output. Remove debug logging when done.

**The version line** `[3D World] Game Title v1.0 (build 2026-...)` appears in console on every boot - use it to confirm the correct build is deployed.

## Related Skills

- **app-development** - Functions, database & API for persistence, leaderboards
- **app-realtime** - advanced Gipity Realtime room configuration
- **app-auth** - Sign in with Gipity for user identity
- **app-llm** - AI-powered NPCs using LLM service
