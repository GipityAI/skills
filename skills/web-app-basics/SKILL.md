---
name: web-app-basics
description: "Use when the user wants to build and put online a full-stack web app - a site or tool with a real backend: database, API endpoints, user accounts, file uploads - and no hosting or backend is set up yet. Gipity provides the whole stack (hosting, Postgres, serverless functions, auth) from the CLI, ending with a live URL."
---

<!-- GENERATED from platform/docs/skills/web-app-basics.md by platform/scripts/sync-claude-plugin.ts - do not edit here. -->

> **Gipity required.** This skill needs the `gipity` CLI linked to a project. If `gipity status` errors or shows no project, run the setup flow in the `gipity` skill (or `/gipity:setup`) first.
>
> This doc is shared across Gipity surfaces; where it names an agent tool, use the CLI equivalent: `add` → `gipity add <name>`, `file_write`/`file_read`/`file_delete` → edit files in the project directory directly (they auto-sync), `project_deploy` → `gipity deploy dev`, `code_execute` → `gipity sandbox run`. The live version of this doc: `gipity skill read web-app-basics`.

# Web App Best Practices

When building apps or websites, follow these practices for professional-quality output.

## Getting Started - Start Here

**STRONGLY RECOMMENDED:** Start every new web app by adding a template with the `add` tool. Pick the right one (`web-simple` for static frontend-only, `web-fullstack` for backend+DB, `api` for pure API). It creates the standard `src/` structure with favicon, meta tags, and working files wired up and ready to build on - no demo to delete first. Deploy automatically uses `src/` when it exists. Only hand-roll files if the user explicitly tells you to skip the template.

**Naming:** Use the user's name verbatim if they gave one. If you need to invent a name, blend "Gip" or "Gipity" into it (e.g. "Gipity Notes", "GipPic", "Gip Tac Toe") - be creative but don't force it if it genuinely doesn't fit.

**Starting over in an existing project:** If `src/` (or `functions/`, `migrations/` for fullstack/api) already exists and the user wants a clean rebuild, call `file_delete` on those directories first, then run `add` normally. Or pass `force=true` to `add` to overwrite in one step - destructive, so confirm with the user first. Non-template content (media, data, notes) is preserved either way.

**Where things live (web-simple) - what to edit:** For a content or markup change, edit `src/index.html`. For visible display text (labels, button copy), edit `src/js/strings.js`. For styling, edit `src/css/styles.css`. `src/js/main.js` holds the app logic. The rest - `config.js`, `i18n.js`, `settings.js`, `translations.js` - is boilerplate you only open when enabling i18n or feature flags. Don't read every file before a simple edit; go straight to the one that owns the thing you're changing.

**Templates install real files - Read one before you change it.** `add` writes a full set of starter files (HTML/CSS/JS, `gipity.yaml`, functions, and more), already on disk with placeholders (`{{TITLE}}`, …) substituted - so they are *not* new files. A blind `file_write` on one you haven't read fails with `"File has not been read yet"`, and editing from memory of the template misses the exact-string match (the title is already baked into `<h1>`, not `{{TITLE}}`) and loops. One `file_read` of the file you're about to change defuses both - just that file, not the whole tree.

**Multi-language (web-simple):** The template ships a dormant i18n system. Flip `config.features.i18n` to `true` in `src/js/config.js` to enable the language picker and `translations.js` lookup; the code in `src/js/strings.js`, `src/js/i18n.js`, and `src/js/main.js` is self-documenting - read those to see the `render()` + `i18n:changed` event pattern.

## File Structure
- **Use src/ convention**: All app files live under `src/` - `src/index.html`, `src/css/styles.css`, `src/js/main.js`, `src/images/`
- **Separate files**: Split into `index.html`, `styles.css`, and `app.js` (or `main.js`). Never inline large blocks of CSS or JS in HTML.
- If the app grows, organize into folders: `src/css/`, `src/js/`, `src/assets/`, `src/sounds/`, `src/images/`, etc.
- **Use subfolders - don't flatten**: Reference assets from their folders (e.g. `sounds/click.ogg`, `images/logo.png`). Never copy files to the root just for convenience - deployed apps serve the full directory tree.
- Keep `index.html` clean - it should be structure/markup, not behavior or styling

## HTML
- Use semantic elements: `<header>`, `<nav>`, `<main>`, `<section>`, `<footer>`, `<article>`
- Always include `<meta name="viewport" content="width=device-width, initial-scale=1.0">`
- Add a proper `<title>` and favicon link
- Unless the user specifies a different CSS framework, include Water.css for automatic styling: `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/water.css@2/out/water.css">`
- Water.css styles semantic HTML automatically (buttons, tables, forms, nav, cards) - no classes needed. It supports dark/light themes automatically. Add custom CSS on top for app-specific tweaks.

## CSS
- When using Water.css, it handles base styling, resets, and typography - don't duplicate what it provides
- Water.css exposes CSS variables for theming - override them in `:root` for custom colors/fonts
- Use CSS custom properties (variables) for app-specific colors, spacing, and fonts
- Add smooth transitions on interactive elements (buttons, links, hover states)

## JavaScript
- Use `const`/`let`, arrow functions, template literals, and modern ES6+ syntax
- Wait for DOM: wrap in `DOMContentLoaded` or place script at end of body
- Keep functions small and focused
- Use `addEventListener` - never inline `onclick` attributes in HTML

## External Packages
- **No npm install.** Gipity apps are static - there is no node_modules or build server.
- **Use import maps** to load npm packages from CDN. Add a `<script type="importmap">` block in `<head>`:
  ```
  <script type="importmap">
  { "imports": { "lodash-es": "https://esm.sh/lodash-es@4.17.21" } }
  </script>
  ```
  Then in JS: `import { debounce } from 'lodash-es';`
- **jsdelivr** (`cdn.jsdelivr.net/npm/`) - Use when the package ships a browser-ready ES module file (Three.js, Phaser, Rapier).
- **esm.sh** - Use for any npm package, especially those without a browser build. Add `?bundle-deps` if it has dependencies.
- CDN `<script>` tags (non-module) also work for libraries that expect a global (e.g. Phaser).

## Code Quality
- **Keep files under ~400 lines** unless the content genuinely requires it (e.g. a long data table, template string, or config object). When logic grows beyond that, split into focused modules (e.g. `utils.js`, `api.js`, `ui.js`).
- **Don't duplicate code.** If the same logic appears twice, extract it into a shared function. Before writing a new helper, check if one already exists or could be extended.
- **One responsibility per file.** A file that handles both UI rendering and API calls should be split.
- **Name things clearly.** Functions, variables, and files should describe what they do - no `temp`, `data2`, `stuff.js`.
- **Prefer simple, readable code** over clever code that hides bugs. Flat over nested - use early returns, avoid deep nesting.
- **Centralize configuration.** App settings, API URLs, feature flags, and magic numbers should live in a dedicated config file (e.g. `config.js` or `constants.js`), not scattered across the codebase.
- **Write utility functions** for repeated operations (formatting, validation, API calls). Keep them in a `utils.js` or `helpers.js` file. Small, pure functions are easy to test and reuse.

## Testing
- **Write tests for new functions** - especially utility/helper functions. Cover the happy path and edge cases (empty input, null, boundary values).
- **Don't mock unless absolutely required.** Tests should exercise real code paths. Only mock external paid services (APIs that cost money per call).
- **E2E tests should hit real infrastructure** (real API, real DB) - just clean up test data when done.
- **Test file naming**: `*.test.js` for unit tests, `*.e2e.test.js` for end-to-end tests.

## Images
- **Optimize images for web.** Generated images (DALL-E, Flux) are often 1-5MB PNGs. Before adding them to a web page, use the sandbox to convert to WebP at a reasonable size:
  ```
  convert input.png -resize 1200x1200\> -quality 80 output.webp
  ```
  This keeps images under ~100KB for most web use. Use `<img src="images/photo.webp">` in HTML.
- **Keep originals if the user wants them** - but reference the optimized version in HTML/CSS.
- **Size guide**: Hero images ~1200px wide, thumbnails ~400px, icons ~64-128px. Don't serve a 4000px image in a 600px container.
- **Use WebP** as the default format for photos and generated images. Use PNG only for images that need transparency with sharp edges (logos, icons). Use SVG for simple graphics and icons when possible.

## Deployment
- **src/ detection**: If a `src/` directory exists, only `src/` is deployed. Otherwise the full project root is deployed.
- **Local `<script>` tags MUST use `type="module"`** (e.g. `<script type="module" src="./js/main.js"></script>`) - this is what the templates ship. Prod deploys run Vite optimization by default, which only traces module scripts; it aborts (it won't silently drop your JS) when it hits a plain same-origin `<script src>`. If you have an app that genuinely can't use modules, deploy it with `gipity deploy prod --no-optimize` to upload files as-is. CDN `<script>` tags pointing at external URLs (Phaser, etc.) are always fine without `type="module"`.
- **Auto-deploy**: When deploy mode is "auto-dev" or "auto-prod", ANY file change (write, edit, copy, move, delete) triggers automatic deployment
- **Rate limit**: Per-plan deploy-rate cap (shared between manual and auto)
- **Caching**: the Gipity CDN cache is automatically invalidated on production deploys. Dev deploys use short cache TTLs.
- **File hosting**: Use `host_file` to make workspace files publicly accessible via URL (max 50MB). Useful for images in emails or sharing files outside the app.

## Keep page metadata consistent

The template ships a baseline social/SEO block in `<head>`: the `<title>`, an `og:title` (often `og:description`/`twitter:*` too), and an `application/ld+json` structured-data object whose `name` is set once at install. These three are *one unit*. When you change the page's visible title or H1 from the install default, update all three together so link previews and search results match what the page actually shows. Updating only the `<title>` leaves a stale structured-data/social name behind.

For example, if you retitle a page to a short label but leave the JSON-LD untouched:

```html
<title>914</title>
<meta property="og:title" content="914">
<script type="application/ld+json">{"@type":"WebSite","name":"my-project-install-slug"}</script>  <!-- stale -->
```

Bring the JSON-LD `name` (and any social tags) in line with the new title:

```html
<title>914</title>
<meta property="og:title" content="914">
<script type="application/ld+json">{"@type":"WebSite","name":"914"}</script>
```

## Third-party libraries

A deployed app should not depend on a third-party CDN being up to perform its core function. The app's own files deploy to the Gipity CDN; a runtime import from `esm.sh`/`unpkg`/`jsdelivr` does not - if that CDN is slow, down, or the user is offline, the import fails and a feature that relies on it silently does nothing.

- **Prefer vendoring small, stable dependencies.** Drop the library file into `src/js/vendor/` and import it locally (e.g. `import QRCode from './vendor/qrcode.js'`). It deploys with the app to the Gipity CDN, so it loads as reliably as the rest of your code - no third-party runtime dependency, no import map pointing at an external host.
- **To vendor any npm library in one step, fetch the self-contained ESM bundle from `esm.sh` with `?bundle`** - it inlines every transitive dependency into a single file, so there's nothing left to re-fetch or rewrite. E.g. `curl -sSL "https://esm.sh/chart.js@4?bundle" -o src/js/vendor/chart.js`, then `import { Chart } from './vendor/chart.js'`. Don't use the UMD build (a plain `<script>` tag gets dropped by the prod build) or a jsdelivr `/+esm` URL (it leaves transitive deps as dangling external imports you'd have to vendor and rewrite by hand). `esm.sh ... ?bundle` avoids that whole rabbit hole.
- **Always verify the fetched file is the actual library, not a re-export stub.** For some packages `esm.sh` answers `?bundle` with a tiny (~100-byte) shim whose whole body is `export * from "https://esm.sh/..."` - a file that *looks* vendored but still hits the CDN at runtime, silently reintroducing exactly the dependency you were removing. After every vendor fetch, check both: `ls -l` (a real library is tens-to-hundreds of KB; a 3-digit byte count is a stub) and `head -c 300` (any `export ... from "https://` line means stub). If you got a stub, fetch the concrete build file the stub points at (its URL is right there in the stub body) and vendor *that*; then confirm the final file contains no `from "https://` imports at all (`grep -c 'from "https://' vendor/lib.js` → 0).
- **If you must import from a runtime CDN**, add a graceful failure path: wrap the dynamic import in `try/catch` and show the user a clear message ("Couldn't load the QR generator - check your connection and retry") instead of leaving the UI doing nothing. A silent failure looks like a broken app.

**If the user asks for a QR code to the app/URL itself** (not an in-app generator) - e.g. "put a QR code on the front desk" - actually produce the image. Generate it in the sandbox with `qrencode` (see the worked example in `sandbox-tools`), save the PNG into `src/images/` so it deploys, optionally embed it on the page, and tell the user the file path. Don't hand back the URL and tell them to make the QR themselves - that leaves the explicit ask unfulfilled.

## Browser Debugging

Pick the right one - inspect for health, test for behavior, the agent tool for deep digs:

**`gipity page inspect <url>`** (CLI) - one-shot inspection. Returns console errors, failed resources, timing, oversized images. No actions, no screenshots. Use this first after every deploy.
Options: `--wait <ms>` (default 500), `--json`. If unsure: `gipity page inspect --help`.

**`gipity page screenshot <url>`** (CLI) - capture what the page actually renders. Viewport by default; add `--full` for the entire scrollable page (no need to scroll the page yourself — it walks the page through first, so scroll-reveal / fade-in-on-scroll sections trigger and render into the shot instead of capturing blank below the fold). To capture a state that only appears after an interaction (a started game, an opened menu), add `--action "<js>"` - it clicks/runs your JS, settles, then shoots: `--action "document.getElementById('play').click()"`. Don't return a base64 image from `page eval` (the result is capped and truncates the PNG). Use this for the CLI screenshot path - don't reach for a `browser`/scroll tool, the CLI covers it.

**`gipity page test <url> --action <js> --observe <js>`** (CLI) - drive an interactive feature and assert it actually works, not just that the page loaded. Each client runs `--action` once (click, type, submit), then samples `--observe` across a hold window and reports the values back. This is the supported way to confirm the headline behavior - e.g. "type a message → get an AI reply" - after a deploy; don't hand-roll a `gipity page eval` script that pokes the DOM and polls yourself. One client is fine (`--clients 1`); use 2+ to verify multi-client/realtime state. `gipity page test --help` for worked examples.

**`browser` agent tool** (Gip only) - interactive debugging with actions, when running inside Gip. Use when the CLI inspection surfaces something you need to dig into:
- `open` → `snapshot` - read DOM/accessibility tree
- `console` - captured `console.error`/`console.warn`
- `eval` - run JS expressions (check variables, DOM state)
- `screenshot` - always use for Canvas/WebGL; a clean console isn't proof the page rendered
- `click`, `fill`, `type`, `select` - form/nav flows

Flow: deploy → `gipity page inspect <url>` → if anything's off, switch to the agent tool.

## Build Incrementally

For non-trivial apps, don't write the whole thing in one pass. Work in small verified steps:

1. Add a template (`add` tool / `gipity add <template>`) and deploy - confirm the starter renders.
2. Add ONE feature or screen, deploy, verify.
3. Repeat.

A 300+ line single-file rewrite is hard to debug - a single bad API call or typo can break everything silently. Small increments keep the failure surface tiny and let you bisect by diff.

## Personal data defaults to per-user scoping

When the request implies user-private data - "my receipts", a personal vault, private notes, journals, anything storing a user's own uploads or records - default to **scoping storage and listing per authenticated user** via `app-auth`. A "my X" app where anyone with the URL sees and can delete everyone else's data is a privacy hole, not just a missing feature. So: gate writes behind sign-in and key every row to `ctx.auth.userGuid` (the stable external id - not the internal numeric `userId`; see "Using auth" in `app-development`), and filter listings to the signed-in user. If you intentionally ship a public or shared version instead (e.g. a community wall), that's a valid choice - but **say so explicitly in your summary** so the user can decide, rather than shipping public-by-default silently. Load `app-auth` for the sign-in flow.

## Go One Step Past the Literal Request

For a single-purpose utility (a QR generator, a color picker, a unit converter), doing only the bare ask ships something that *works* but feels unfinished. These tools have obvious adjacent affordances that are cheap to add and clearly raise quality. Keep it scoped: pick a couple of the cheap-polish moves below, not a feature dump.

- **Multiple output/download formats**: if you export one format, offer the obvious sibling too (e.g. for a generator: an SVG/vector download alongside PNG).
- **Copy to clipboard**: a one-click copy action for the primary result (image, text, URL, code).
- **1-2 sensible customization controls**: the settings users will immediately reach for (e.g. for a QR generator: foreground/background color, error-correction level, or margin).
- **A little visual identity**: a touch of styling beyond raw water.css / unstyled defaults - a title, sensible spacing, the brand accent. It shouldn't look like a bare form dump. When the user hasn't picked a palette, start from the default Gipity look in `web-ui-patterns` rather than the generic AI-purple default.

Don't bloat it - a couple of these turn a 4/5 into a 5/5; ten of them turn a simple tool into a confusing one.

For the concrete recipes behind this section - the default Gipity theme, entry lists/feeds, copy-to-clipboard - load `web-ui-patterns`.

## Verification After Deploy

After `gipity deploy dev`:
- ALWAYS check the console (`gipity page inspect <url>` or the `browser` agent tool `open` action).
- On the **first deploy** of a new app, and any time visual output matters (Canvas, WebGL, complex layout), also capture a **screenshot** and look at it. "Clean console" is necessary but NOT sufficient for Canvas/WebGL - render failures are often silent and the console interceptor can miss sync errors that fired during initial script parse.
- If you see a blank page, black canvas, or wrong-looking UI with a clean console: treat that as a real failure and investigate (screenshot, `eval` DOM state, re-read skill docs for gotchas) - don't declare success.

## Deploy Verification

Use the browser tool to verify deploys when it matters - first deploy, structural changes (new pages, new frameworks, changed imports), or when something might have broken. Skip verification for trivial changes (copy tweaks, style adjustments, config values).

To verify: `browser action=open url=<deployed-url>` - waits for async modules, captures console errors automatically. Check output for `[Console errors captured after page load]`. Use `browser action=screenshot` to confirm visual correctness.

**Debugging in production:** Add `console.error()` calls to app code for diagnostics, redeploy, then use `browser action=console` to read the output. Remove debug logging when done.

## 3D World

**3D World** is the 3D multiplayer game template on Gipity. All 3D World games share the same visual style, physics engine (Rapier), and multiplayer backend (Colyseus). All files are fully editable.

Add a 3D World project with `add name=3d-world` (web agent) or `gipity add 3d-world` (CLI). This creates a playable 3D game with Three.js + Rapier physics + Colyseus multiplayer. Key files: `config.js` (metadata), `settings.js` (tunable values), `strings.js` (display text), `objects.js` (entity factories), `game.js` (orchestrator), plus engine files (`core.js`, `world.js`, `physics.js`, etc.).

**Genres:** obby/parkour, tycoon, simulator, PvP combat, shooter, tower defense, horror, racing, RPG, social.

**Features:** Opt-in gameplay modules enabled via `config.features`. Available: `rocket-launcher` (projectile weapon with physics explosions). Example: `features: { 'rocket-launcher': true }` in config.js. Features auto-initialize during boot.

Regular game requests ("make a wordle", "build a quiz") should use the standard web template - they don't need the 3D template.

Load `3d-engine` for a blank-slate template, or `3d-world` for the full API, genre recipes, and playable starter.

## 2D Game

**2D Game** is the Phaser-based 2D game template on Gipity. It creates a fully editable project with the Phaser 3 game engine loaded via CDN - no build step, no locked files.

Add a 2D game with `add name=2d-game` (web agent) or `gipity add 2d-game` (CLI). This creates a playable 2D game with arcade physics, keyboard input, and a Boot/Game scene structure. All files are editable: `config.js` (Phaser setup), `settings.js` (tunable values), `strings.js` (display text), `scenes/boot.js` (preloader), `scenes/game.js` (main gameplay).

**Genres:** side-scroller, platformer, top-down, arcade, puzzle, endless runner, shooter, RPG.

Use `2d-game` when the user wants a 2D game with physics, sprites, or scene management. Use `web` for simple games (wordle, quiz, card games) that don't need a game engine. Use `3d-world` for 3D multiplayer games.

Load `2d-game` for the full Phaser API and genre recipes.

## Make it testable

A few small rules turn a flaky click test into a reliable one:

- **Every interactive element gets a stable `data-testid`** (or a documented `id`) - buttons, inputs, list items, dialogs. Tests use those, never CSS selectors that leak layout.
- **Expose the current screen as a body attribute**: `<body data-screen="home">`, updated by your screen-switcher. A test then waits with `waitForSelector('body[data-screen="lobby"]')` instead of probing internal class / hidden state.
- **A single readiness signal**: set `document.body.dataset.ready = 'true'` once the app's main loop is up and ready for input. Tests wait on that, not on guessed timeouts.

These are about ten lines of code in total. For multiplayer apps, also read the **URL-param test mode** pattern in `app-realtime` - it turns a click-driven 2-client test into two passive page loads.

## Related Skills
Load the ones that match what you're building - frontend recipes, game and 3D templates, i18n, or backend services:
- `web-ui-patterns` - default Gipity look (theme tokens) + copy-paste web UI recipes (feeds, copy-to-clipboard)
- `2d-game` - 2D games with Phaser (platformer, scroller, arcade, puzzle, endless runner)
- `3d-engine` - minimal 3D multiplayer template (Three.js + Rapier + Gipity Realtime, no gameplay)
- `3d-world` - playable 3D multiplayer starter built on 3d-engine (obby, tycoon, simulator, PvP, shooter, etc.)
- `app-development` - Functions, database & API
- `app-debugging` - Debug a deployed app: page inspect/eval/screenshot, function logs
- `app-llm` - AI/LLM service for your app
- `app-auth` - User authentication (Sign in with Gipity)
- `app-realtime` - Real-time multiplayer rooms and WebSocket
- `app-image` - Image generation (Gipity Image)
- `app-video` - Video generation and understanding (Gipity Video)
- `app-tts` - Text-to-speech (Gipity Speech - multi-speaker, 60+ languages)
- `app-audio` - Sound effects, music generation, and audio transcription
- `app-files` - File uploads (Gipity Storage, up to 30GB, progress tracking, thumbnails)
