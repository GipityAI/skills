---
name: 2d-game
description: "Use when the user wants to build a 2D browser game - platformer, side-scroller, arcade, puzzle, endless runner - and share it at a live URL. Phaser 3 starter on Gipity with scenes, physics, input, sprites, and genre recipes."
---

<!-- GENERATED from platform/docs/skills/2d-game.md by platform/scripts/sync-claude-plugin.ts - do not edit here. -->

> **Gipity required.** This skill needs the `gipity` CLI linked to a project. If `gipity status` errors or shows no project, run the setup flow in the `gipity` skill first (in Claude Code or Grok: `/gipity:setup`; in Codex or any other agent, follow the `gipity` skill's setup steps directly).
>
> This doc is shared across Gipity surfaces; where it names an agent tool, use the CLI equivalent: `add` → `gipity add <name>`, `file_write`/`file_read`/`file_delete` → edit files in the project directory directly (they auto-sync), `project_deploy` → `gipity deploy dev`, `code_execute` → `gipity sandbox run`. The live version of this doc: `gipity skill read 2d-game`.

# 2D Game - Phaser 3 Games

**2D Game** is the Phaser-based game template on Gipity. All files are fully editable - no locked template layer. Uses Phaser 3.80.1 via CDN with arcade physics.

**When to use this:** When the user asks for a 2D game - platformer, side-scroller, arcade, puzzle, endless runner, top-down, shooter, or RPG. For simple games (wordle, quiz, card games), use `web-simple`. For 3D multiplayer apps, use `3d-engine` for a blank template or `3d-world` for a playable rocket-launcher starter.

## Quick Start - Start Here

**STRONGLY RECOMMENDED:** Begin every 2D game by adding the `2d-game` template with `add`. It sets up Phaser 3, boot/game scenes, config, settings, and favicons. Only hand-roll files if the user explicitly tells you to skip the template.

```
add name=2d-game title="<Game Name>"
```

**Starting over in an existing project:** If `src/` already exists and the user wants a clean rebuild, call `file_delete` on `src` first, then run `add` normally. Or pass `force=true` to `add` to overwrite in one step - destructive, so confirm with the user first. Unrelated content (media, data, notes) is preserved either way.

**Naming:** Use the user's name verbatim if given. If they didn't specify, blend "Gip" or "Gipity" into the name (e.g. "Gipity Racer", "Gip Tac Toe") - be creative but don't force it.

This creates a playable game immediately - colored rectangle player, arcade physics, ground platform, and controls that work on desktop AND mobile out of the box (WASD/arrows + Space on keyboard; a floating virtual joystick, Jump button, and fullscreen toggle on touch devices). Then edit `scenes/game.js` and `settings.js` to build your game.

## Project Structure

```
src/
  index.html            - Phaser CDN, game container, module entry
  js/
    config.js           - Phaser.Game config, scene registration
    controls.js         - Touch controls overlay (virtual joystick, buttons, fullscreen)
    settings.js         - Tunable values (canvas, colors, physics, player, gameplay)
    strings.js          - User-facing display text
    scenes/
      boot.js           - Preloader with progress bar
      game.js           - Main game scene (gameplay logic)
  css/
    styles.css          - Page layout, canvas styling
  images/
    favicon-192.png
    favicon.ico
```

## Phaser Essentials

### Scene Lifecycle
Every scene has three key methods:
- `preload()` - load assets (images, spritesheets, audio)
- `create()` - set up game objects, physics, input
- `update()` - runs every frame, game logic here

### Loading Assets
In `boot.js` preload():
```js
this.load.image('player', './images/player.png');
this.load.spritesheet('hero', './images/hero.png', { frameWidth: 32, frameHeight: 48 });
this.load.audio('jump', './audio/jump.mp3');
```

### Creating Game Objects
```js
// Sprite (from loaded image)
this.player = this.physics.add.sprite(400, 300, 'player');

// Rectangle (no image needed)
this.player = this.add.rectangle(400, 300, 32, 48, 0xf26522);
this.physics.add.existing(this.player);

// Static group (platforms)
this.platforms = this.physics.add.staticGroup();
this.platforms.create(400, 568, 'ground');
```

### Physics (Arcade)
```js
// Gravity is set in config.js via settings.physics.gravity
body.setVelocityX(speed);
body.setVelocityY(jumpForce);  // negative = up
body.setBounce(0.2);
body.setCollideWorldBounds(true);

// Collisions
this.physics.add.collider(player, platforms);
this.physics.add.overlap(player, coins, collectCoin, null, this);
```

### Input
```js
// Keyboard
this.cursors = this.input.keyboard.createCursorKeys();  // up, down, left, right
if (this.cursors.left.isDown) body.setVelocityX(-speed);

// Specific keys
this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

// Touch/pointer
this.input.on('pointerdown', (pointer) => { ... });
```

### Text
```js
this.add.text(400, 30, 'Score: 0', {
  fontSize: '24px', color: '#ffffff', fontStyle: 'bold',
}).setOrigin(0.5);
```

### Camera
```js
this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
```

## Common Phaser 3 Pitfalls

These are the failure modes that most often turn the whole screen black. Read before writing a game scene.

- **`Graphics.fillEllipse` does NOT exist.** Phaser 3 Graphics has `fillCircle(x, y, r)`, `fillRect`, `fillTriangle`, `fillRoundedRect`, and `beginPath` + `arc` + `fillPath` - but no ellipse drawcall. For an oval, use `fillCircle` and set `gfx.scaleX` / `gfx.scaleY`, or draw it with `beginPath`/`arc`/`fillPath`.
- **Don't attach physics to a raw `Graphics` object.** Graphics has no width/height for the body to size against, so the body ends up with `{0,0}` dimensions or drifts from the drawn shape. Use a `Sprite` (from a loaded image) or a `Rectangle` / `Zone` for the physics body, and draw a follower `Graphics` that tracks `body.x`/`body.y` each frame.
- **Set world bounds for scrolling worlds.** The default physics world is the canvas size. For a side-scroller or large map, call `this.physics.world.setBounds(0, 0, worldWidth, height)` in `create()` - otherwise platforms and objects beyond the canvas get ignored by physics.
- **Use object hashes, not sparse arrays, for spatial maps.** `this.segments = {}` with string/number keys works; `this.segments = []` with large indices becomes sparse and breaks `Object.keys`/`values` enumeration in subtle ways.
- **Don't double-create physics bodies.** Either call `this.physics.add.existing(obj)` OR add `obj` to a `staticGroup` with `group.add(obj)` - not both. Double-creation silently misplaces the body relative to the visual.
- **Always verify renders, not just console.** A missing API or a bad draw can throw once during init and leave a black canvas with nothing further to report. After deploying, capture a screenshot and look at it - `gipity page screenshot <url>` from the CLI, or the `browser` agent tool's `screenshot` action in chat - don't trust "clean console" as proof. If gameplay only starts after a "play" click, drive it in the same shot so you capture the game and not the menu: `gipity page screenshot <url> --action "document.getElementById('play').click()"` (use your start button's selector).

## Build Incrementally

For anything non-trivial, don't write the whole game in one `Write` call. Work in small, verified steps:

1. Add the template (`gipity add 2d-game`) and deploy - confirm the starter game renders.
2. Customize ONE element (e.g. replace the player rectangle with your sprite). Deploy, screenshot, confirm it renders.
3. Add the next element (ground, enemies, collectibles) one at a time, deploying and verifying between each.
4. Only after the core loop works, layer on polish (parallax, particles, HUD, touch controls).

A 500-line rewrite of `scenes/game.js` is very hard to debug when something breaks - a single bad API call turns the whole screen black with no useful error. Small steps keep the failure surface tiny.

## Verification After Deploy

After every `gipity deploy dev`:
- Run `gipity page inspect <deploy-url>` to surface console errors.
- **On the first deploy of a new game**, and any time you've made significant visual changes, also capture a screenshot and look at the image - `gipity page screenshot <url>` (CLI) or the `browser` agent tool's `screenshot` action (chat). To capture actual gameplay rather than the title screen, start the game in the same shot: `gipity page screenshot <url> --action "document.getElementById('play').click()"`. A clean console is NOT sufficient proof for Canvas/WebGL apps - render failures are often silent.
- If you see a black screen with a clean console: assume a sync error fired during Phaser init (most commonly a missing API like `fillEllipse`, or physics attached to a raw Graphics). Re-read the "Common Phaser 3 Pitfalls" section above before rewriting.

### Asserting on real game state (score, lives, collisions, win/lose)

A screenshot proves the game *renders*; it can't prove the ball bounces, the score increments, or the win screen ever fires. Drive the **live game object** instead. `js/config.js` exports the Phaser game, and `index.html` loads it as a module - so a dynamic `import()` from `gipity page eval` resolves out of the browser's module cache and hands you **the running instance** (relative specifiers resolve against the page URL). No second game boots.

**Never ship a `window.game` debug hook to do this.** That leaves instrumentation in your production bundle and costs an extra deploy.

```bash
gipity page eval "<deploy-url>" "
  const { game } = await import('./js/config.js');
  const s = game.scene.getScene('Game');
  s.startGame();                               // call your own scene methods
  return JSON.stringify({ score: s.score, lives: s.lives, state: s.state });
"
```

For a longer driver (play a full round, force a win, assert the game-over overlay), put the script in a file and pass `--file` - no shell quoting, and the body may use `await` and `return`:

```bash
gipity page eval "<deploy-url>" --file ./tests/drive-game.js --json
```

The eval body has a **~20s in-page budget**, so split a long sequence into one call per state you're verifying.

**Never wait wall-clock time for physics/animation to play out** - the headless browser can paint at ~15 fps, so `setTimeout(2000)` advances far less than 2s of game time and assertions report false negatives. `config.js` also exports `advance(seconds)`: it pauses the browser loop and ticks Phaser's TimeStep by hand, so N simulated seconds (physics, timers, collisions) run in milliseconds, deterministically:

```bash
gipity page eval "<deploy-url>" "
  const { game, advance } = await import('./js/config.js');
  const s = game.scene.getScene('Game');
  s.startGame();
  advance(5);                                  // 5s of game time, instantly
  return JSON.stringify({ score: s.score, bricks: s.bricks.countActive() });
"
```

To *capture* a driven state visually, `page screenshot --action "<js>"` runs the same kind of script before the shot - same async body, same app-relative `import()`. If the action throws, you still get the image, plus a `⚠ --action failed:` line telling you it shows the **undriven** page:

```bash
gipity page screenshot "<deploy-url>" -o win.png \
  --action "const { game } = await import('./js/config.js'); game.scene.getScene('Game').winGame();"
```

Write throwaway driver scripts and screenshots **outside the project directory** (e.g. `/tmp`) - the project auto-syncs to Gipity, so scratch files land in the user's storage. If they must live in the project, add the path to `.gipityignore`.

### Animations
```js
this.anims.create({
  key: 'walk',
  frames: this.anims.generateFrameNumbers('hero', { start: 0, end: 3 }),
  frameRate: 10,
  repeat: -1,
});
this.player.anims.play('walk', true);
```

## Adding a New Scene

1. Create `src/js/scenes/myScene.js`:
```js
export class MyScene extends Phaser.Scene {
  constructor() { super('MyScene'); }
  create() { /* ... */ }
  update() { /* ... */ }
}
```

2. Register in `config.js`:
```js
import { MyScene } from './scenes/myScene.js';
// Add to scene array: scene: [Boot, Game, MyScene],
```

3. Switch scenes: `this.scene.start('MyScene');`

## Genre Recipes

### Side-Scroller / Platformer
- Keep gravity enabled (default)
- Add platforms as static physics bodies
- Camera follows player: `this.cameras.main.startFollow(player)`
- Set world bounds larger than canvas: `this.physics.world.setBounds(0, 0, 3200, 600)`

### Top-Down (Zelda-style)
- Disable gravity: set `settings.physics.gravity = 0`
- Add 4-way movement (up/down/left/right)
- Use `body.setVelocity(x, y)` for diagonal movement

### Endless Runner
- Auto-scroll: move obstacles left each frame, spawn new ones off-screen right
- Single input: jump on tap/space
- Increase speed over time: `speed += dt * acceleration`

### Arcade / Shooter
- Bullets: `this.physics.add.group()` with `body.setVelocity()`
- Enemy spawning: `this.time.addEvent({ delay: 1000, callback: spawnEnemy, loop: true })`

### Puzzle
- Disable gravity, disable physics or use minimal physics
- Grid-based: snap positions to grid `Math.round(x / tileSize) * tileSize`
- Input: pointer clicks to select/move pieces

## Mobile / Touch

The template is mobile-ready by default via `js/controls.js` - a DOM overlay above the canvas that renders only on touch devices (nothing shows on desktop). It gives the standard mobile-game layout: a **floating virtual joystick** on the left half (the pad appears wherever the thumb lands), **round action buttons** bottom-right, and a **fullscreen toggle** top-right (auto-hidden where the Fullscreen API is unavailable, e.g. iPhone Safari - there, "Add to Home Screen" runs fullscreen via the template's PWA meta tags). Multi-touch is tracked per pointer, so joystick + buttons work simultaneously.

```js
import { touch, initTouchControls } from '../controls.js';

// create(): declare the buttons your game needs (first = primary, biggest)
initTouchControls({ buttons: [{ id: 'jump', label: 'Jump' }, { id: 'fire', label: 'Fire' }] });
// tap-only game? disable the joystick so it doesn't swallow lower-left taps:
// initTouchControls({ joystick: false, buttons: [...] });

// update(): merge with keyboard - joystick is analog (-1..1)
const keyX = (cursors.right.isDown ? 1 : 0) - (cursors.left.isDown ? 1 : 0);
const moveX = keyX !== 0 ? keyX : touch.x;            // touch.y for vertical
body.setVelocityX(moveX * speed);
if (touch.isDown('jump')) { /* held */ }
if (touch.justPressed('fire')) { /* once per press */ }
```

Always keep desktop AND touch input working: keyboard = WASD + arrows (both), plus the matching touch buttons. `touch.enabled` tells you touch controls are active (e.g. to swap instruction text). Phaser still handles in-canvas taps via pointer events (`this.input.on('pointerdown', ...)`), with 3 active pointers configured.

For mobile-responsive canvas, the template uses `Phaser.Scale.FIT` + `CENTER_BOTH` by default - the game keeps its `settings.canvas` coordinate system and letterboxes to fit any screen or orientation. The page is hardened for games (no pinch-zoom, no overscroll, no text selection; `dvh` viewport).

## Deploy Verification

Verify a deploy when it matters - the first deploy, structural changes (new pages, new frameworks, changed imports), or anything that might have broken. Skip it for trivial changes (copy tweaks, style values).

`gipity deploy dev --inspect` deploys and reports the live page in one step: console errors, failed resources, timing, layout overflow. A clean console is necessary but NOT sufficient for Canvas/WebGL - also capture `gipity page screenshot <url>` and look at it, because render failures are silent. A blank page, black canvas, or wrong-looking UI with a clean console is a real failure, not a pass.

Full loop - reading function logs, calling a function directly, driving the page: the `app-debugging` skill.
