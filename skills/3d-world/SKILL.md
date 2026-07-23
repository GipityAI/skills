---
name: 3d-world
description: "Use when the user wants a 3D browser game or a multiplayer game - obby, tycoon, simulator, PvP arena, shooter, racing - live on the web. Three.js + physics + multiplayer template on Gipity, with genre recipes, assets, and networking built in."
---

<!-- GENERATED from platform/docs/skills/3d-world.md by platform/scripts/sync-claude-plugin.ts - do not edit here. -->

> **Gipity required.** This skill needs the `gipity` CLI linked to a project. If `gipity status` errors or shows no project, run the setup flow in the `gipity` skill first (in Claude Code or Grok: `/gipity:setup`; in Codex or any other agent, follow the `gipity` skill's setup steps directly).
>
> This doc is shared across Gipity surfaces; where it names an agent tool, use the CLI equivalent: `add` → `gipity add <name>`, `file_write`/`file_read`/`file_delete` → edit files in the project directory directly (they auto-sync), `project_deploy` → `gipity deploy dev`, `code_execute` → `gipity sandbox run`. The live version of this doc: `gipity skill read 3d-world`.

# 3D World - 3D Multiplayer Starter

**3D World** is a playable starter app on Gipity - a multiplayer rocket-launcher demo built on the `3d-engine` template. Use it when you want a working reference or a fun playground. All 3D World games share the same visual style, physics, and multiplayer backend.

**Read [3d-engine](https://docs.gipity.ai/skills/3d-engine.html) for the engine API.** 3D World *is* the 3d-engine template plus a demo, so every call you'll make - Parts, physics, constraints, workspace, player, camera modes, assets, UI/HUD - is documented once, there. This skill covers only what the starter adds on top: the demo it ships, the rocket-launcher feature, genre recipes, multiplayer patterns, and persistence.

**When to use this:** When the user asks for a 3D World game, a playable 3D reference, or a multiplayer shooter. For a fresh build without rocket-launcher / demo-scene content to strip out, add `3d-engine` instead and build your own features. For 2D games (platformer, puzzle, arcade) add `2d-game`. For non-game web apps (wordle, quiz, card games), use `web-simple` or `web-fullstack`.

## Quick Start - Start Here

**STRONGLY RECOMMENDED:** Begin every 3D World game by adding the `3d-world` template with `add`. It sets up Three.js, Rapier physics, Gipity Realtime multiplayer, player controls, and the full engine layer for you. Only hand-roll files if the user explicitly tells you to skip the template.

```
add name=3d-world title="<Game Name>"
```

**Starting over in an existing project:** If `src/` already exists and the user wants a clean rebuild, call `file_delete` on `src` first, then run `add` normally. Or pass `force=true` to `add` to overwrite in one step - destructive, so confirm with the user first. Unrelated content (media, data, notes) is preserved either way.

**Naming:** Use the user's name verbatim if given. If they didn't specify, blend "Gip" or "Gipity" into the name (e.g. "Gipity World", "GipCraft") - be creative but don't force it.

This creates a playable game immediately - ground, player character, physics, camera, mobile controls. Then edit `config.js` and `game.js` to build your game.

## What the starter ships

All files are in `src/` and fully editable. The engine layer is identical to `3d-engine` (see its "Project Structure"). What 3D World adds on top:

- `game.js` - main orchestrator, already wired to the demo. **Start here.**
- `scene.js` - the demo scene (voxel structures in two rings). Replace with your own world.
- `config.js` - project metadata + `features` flags. `settings.js` - tunable gameplay values. `strings.js` - display text.
- A `rocket-launcher` feature (projectile + explosion + audio) and block-collision tick sounds.
- A player controller wired with an orbit + aim camera.

Read the files before changing them - each opens with a header comment listing its exports and invariants.

Press **`** (backtick) or **U** to toggle the built-in debug panel: FPS, version line, and all `console.log`/`warn`/`error` output. Log to it from game code with `ui.debug('message')`.

## Features (Opt-in Gameplay Modules)

Enable built-in gameplay features via `config.features`. Features are template-level modules that auto-initialize during boot.

```js
// config.js
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
    maxDistance: 300, // max range (default: 150)
    size: 3.0,        // rocket model scale (default: 2.0)
  },
}
```

Hook a feature's events from `game.js`:

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

| Feature | Key | Description |
|---------|-----|-------------|
| Multiplayer | `multiplayer` | `@gipity/realtime` transport + remote-player avatars rendered automatically. Optional host-authoritative world-state sync via `sync.worldState: true`. Disable with `'multiplayer': false` for solo games. |
| Rocket Launcher | `rocket-launcher` | Projectile weapon with physics explosions. Left-click to fire, B for debug traces. |

To write your own feature, see "Features" in [3d-engine](https://docs.gipity.ai/skills/3d-engine.html).

## Genre Recipes

### Obby / Parkour
- Platforms at varying heights with anchored Parts
- Checkpoints as triggers (save spawn point)
- Kill zones below platforms (trigger → respawn at last checkpoint)
- Timer in HUD (top-right)
- Finish trigger → show completion time

### Tycoon
- Resource nodes (triggers that give currency on proximity)
- Shop system (`ui.setHud` for buy menu)
- Upgrades stored in game state
- Auto-generation timer
- Persist progress with App API functions (below)

### Simulator (Collect & Sell)
- Collectibles scattered as voxel boxes with triggers
- Inventory count in HUD
- Sell zone (trigger → convert items to currency)
- Upgrade tiers (speed, capacity, multiplier)
- Leaderboard via App API

### PvP Combat
- Health bar in HUD
- Weapon hitbox via raycast (`physics.castRay`)
- Damage events via a `network.channel('combat', { sync: 'messages' })` channel
- Respawn timer + invincibility frames
- Score tracking

### Shooter (FPS/TPS)
- Camera mode: `player.cameraControl.mode = 'firstPerson'`
- Crosshair in HUD center
- Projectile: spawn small Part, apply impulse, raycast for hit detection
- Ammo count in HUD
- Network: broadcast shots, validate hits server-side

### Tower Defense
- Path defined as waypoint array
- Enemy spawner on interval
- Tower placement on grid (snap to voxel)
- Projectile system (tower → nearest enemy)
- Wave counter + health in HUD

### Horror
- Override world lighting: dim the sun (`workspace.lighting.timeOfDay`), pull fog closer
- Flashlight: spotlight attached to camera
- Jump scare: trigger zones that play sounds + show images
- Inventory: key-item tracking
- Narrative: text messages via `ui.showMessage`

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
The `multiplayer` feature already renders remote-player avatars, driven by the `network.avatars` presence channel. To react to joins/leaves yourself:

```js
network.avatars.onJoin((sid) => console.log('joined', sid));
network.avatars.onLeave((sid) => console.log('left', sid));
for (const [sid, peer] of network.avatars.peers()) {
  // peer.position {x,y,z}, peer.rotation (y radians)
}
```

### Solo, basic, and authoritative world state

Multiplayer is a feature like rocket-launcher - flip it on or off in `config.js`:

```js
features: { 'multiplayer': false }                                   // solo game
features: { 'multiplayer': { room: 'my-arena' } }                    // default: presence + avatars
features: { 'multiplayer': { room: 'lobby', sync: { worldState: true } } }  // host-authoritative world
```

Solo is that one line and nothing else: **leave `gipity.yaml` as shipped.** Its `realtime` phase only registers a room name (no server, no cost, no plan limit) and an unconnected room does nothing, so there is no manifest to strip out.

Use `sync.worldState` when every client must see the same blocks/objects in the same place - a shared sandbox or a destructible level. The feature creates a host-authoritative `world` entities channel; the 3D adapter (`js/network/adapter-3d.js`) already knows how to serialize and apply Parts, so there's no game-side registration. The first client to join becomes host (3-phase claim election); if the host drops, another takes over automatically (a client holding world data is promoted instantly, else alphabetical tiebreaker).

The room is declared in the template's `gipity.yaml` (a `realtime` deploy phase), so `gipity deploy` provisions it - no separate step. To sync your own non-Part state, open an `entities` channel and supply an adapter - see `packages/realtime/contracts/adapter.contract.md` and the worked `examples/`. Room management and advanced config: the `app-realtime` skill.

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

## Mobile and Performance

Touch controls are automatic - floating joystick, Jump/Action buttons, camera drag, fullscreen toggle (details in [3d-engine](https://docs.gipity.ai/skills/3d-engine.html)). To stay playable on both inputs, read movement from `player.inputState` and trigger actions from `inputState.action` / `inputState.jump` rather than raw key events.

- Use `assets.createVoxelGround()` for terrain - it's an InstancedMesh (one draw call for the whole ground)
- For many identical objects, use `THREE.InstancedMesh` instead of individual meshes
- Keep total triangle count under 100K for mobile
- Limit shadow-casting objects (player + key objects only)
- Use fog to hide pop-in at draw distance

## Deploy Verification

Verify a deploy when it matters - the first deploy, structural changes (new pages, new frameworks, changed imports), or anything that might have broken. Skip it for trivial changes (copy tweaks, style values).

`gipity deploy dev --inspect` deploys and reports the live page in one step: console errors, failed resources, timing, layout overflow. A clean console is necessary but NOT sufficient for Canvas/WebGL - also capture `gipity page screenshot <url>` and look at it, because render failures are silent. A blank page, black canvas, or wrong-looking UI with a clean console is a real failure, not a pass.

Full loop - reading function logs, calling a function directly, driving the page: the `app-debugging` skill.

**The version line** `[3D World] Game Title v1.0 (build 2026-...)` appears in the console on every boot - use it to confirm the correct build is deployed.

## Related Skills

- **3d-engine** - the engine API this starter is built on: Parts, physics, constraints, workspace, player, camera, assets, UI. **Read it first.**
- **app-debugging** - verifying a 3D app headlessly: `advance(seconds)` instead of wall-clock waits, `page inspect`, screenshots
- **app-development** - functions, database & API for persistence and leaderboards
- **app-realtime** - advanced Gipity Realtime room configuration
- **app-auth** - Sign in with Gipity for user identity
- **app-llm** - AI-powered NPCs using the LLM service
