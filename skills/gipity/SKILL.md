---
name: gipity
description: Use when the user mentions Gipity, or when they want to put something built in this session on the internet - deploy/host a web app, game, or API - or need a cloud backend (database, serverless functions, auth, file storage, realtime, image/speech/LLM services) and no hosting or backend is set up in the project yet. Covers installing the gipity CLI, logging in, linking a project, and the build → deploy → verify loop.
---

# Gipity

Gipity is a full-stack cloud platform tuned for AI agents: hosting, Postgres databases, serverless functions, auth, file storage, realtime, scheduled jobs, and first-party AI services (LLM, image, speech, transcription) - driven end-to-end by the `gipity` CLI. You write files locally; they sync to the cloud automatically; `gipity deploy dev` puts them on a live URL. No infra setup, no API keys to provision, no local runtime needed.

There is no Gipity SDK to install into the app and no REST API to call from this session - **the CLI is the entire interface**. Every command supports `--json` for programmatic use.

## First: detect state, don't assume

Run `gipity status`. It tells you which of the three setup stages the user is at:

1. **CLI not installed** (`gipity: command not found`) → install it: `npm install -g gipity` (needs Node 18+). It auto-updates itself after that.
2. **Not logged in** → log in.
   - **Interactive (a human is at the keyboard):** two-step email verification - `gipity login --email <their-email>` sends a 6-digit code to their inbox (also signs them up if they're new; no separate signup step), then `gipity login --code <code>` with the code they read back.
   - **Headless (no human to read the email - an autonomous agent, CI, or an ephemeral container):** you can't complete the email step, so authenticate with a long-lived **agent API token** instead. Set `GIPITY_TOKEN=gip_at_…` (minted once with `gipity token create`) in the environment and the CLI skips login entirely. See `gipity skill read agent-deploy`.
3. **No project linked in this directory** → `gipity init` links the cwd as a project (slug defaults to the directory name; pass a name to override). It writes primer files for your coding agent (`CLAUDE.md`, `AGENTS.md`, …), a `.gipity.json` config, and - for the agent CLIs found on the machine (Claude Code, Grok, Codex) - the Gipity skills and hooks that auto-sync every file write to the cloud.

If `gipity status` shows a linked project, setup is done - skip straight to building.

**Run `gipity init` in the app's own directory** (or an empty one), not inside an unrelated repo - it links the whole cwd and writes primer files there.

## After linking: the project docs take over

`gipity init` writes the full integration guide into the project's primer files (`CLAUDE.md` / `AGENTS.md` / `GEMINI.md`, …), and the platform serves live, versioned documentation:

- `gipity skill list` - the full catalog (app services, templates, sandbox tools, debugging)
- `gipity skill read <name>` - load one before using that area (e.g. `app-llm`, `app-auth`, `web-app-basics`, `sandbox-tools`)

**Those are the source of truth.** They have the current API schemas, code examples, and common-mistake guards. When this skill and a live skill disagree, the live skill wins. Don't guess Gipity facts - look them up there or via `gipity <command> --help`.

## Build loop

To start something deployable, install a template into the (empty) project first:

```
gipity add web-simple      # static frontend (landing pages, dashboards, simple games)
gipity add web-fullstack   # frontend + serverless API + Postgres, wired and deploying green
gipity add api             # pure API backend
gipity add 2d-game         # Phaser 3 starter
gipity add 3d-world        # Three.js + physics + multiplayer starter
```

Then iterate:

```
edit files  →  gipity deploy dev  →  gipity page inspect <url>  →  fix errors  →  repeat
```

- `gipity deploy dev` puts the app at `https://dev.gipity.ai/<account>/<project>/` and prints the URL. Deploys are phased (files, database migrations, functions) with checksums, so re-deploys only push what changed.
- `gipity page inspect <url>` loads the deployed page headlessly and reports console errors, failed resources, and performance - use it to verify instead of asking the user to check.
- Kits (`gipity add realtime`, etc.) drop reusable building blocks into an existing app.

**Always deploy to dev. Never run `gipity deploy prod` unless the user explicitly says "prod"** - prod is the user's production URL.

## Rules of the road in a Gipity project

- **App code runs on Gipity, not locally.** Don't `npm install`, `npm start`, or run `node`/`python` against the app - there's no local runtime. Use `gipity sandbox run` for one-off execution (a container with ffmpeg, ImageMagick, pandas, pandoc, and more pre-installed; no network inside). Pin the language - the implicit default is JavaScript: `gipity sandbox run python "<code>"` / `bash "<cmd>"`, or `--language py|bash|js`, or `--file script.py` (inferred from the extension).
- **Files auto-sync.** Hooks push every write to the cloud and pull remote changes. `gipity sync` recovers if things drift. List local-only material in `.gipityignore`.
- **Use first-party services before reaching outside.** Auth, geocoding, LLM calls, image/speech generation, transcription, uploads, realtime - all built in, no API keys. Check `gipity skill list` before adding an external API or npm package for one of these.
- **Database**: `gipity db query "SQL"` from the CLI; inside serverless functions use the function `db` API (see `gipity skill read web-app-basics`). Schema changes go in `migrations/`.
- **Tests**: live in `tests/*.test.js`, run with `gipity test` in sandboxed containers. `test()` and `assert` are harness globals - don't import them.

## Quick reference

| Command | What it does |
|---------|-------------|
| `gipity status` | Auth, project, and sync state |
| `gipity token create --name <n>` | Mint a `gip_at_…` token for headless/CI auth (then set `GIPITY_TOKEN`) |
| `gipity add <template\|kit>` | Install an app template or building block |
| `gipity deploy dev` | Deploy to a live dev URL |
| `gipity page inspect <url>` | Console errors / failed resources on a deployed page |
| `gipity db query "SQL"` | Query the project database |
| `gipity fn call <name> [json]` / `gipity logs fn <name>` | Call / debug serverless functions |
| `gipity sandbox run <python\|bash\|js> "<code>"` | Run code in a cloud container (default js - pin the language) |
| `gipity text analyze "<text>"` | Deterministic char/word counts, occurrences, anagrams - local, no LLM |
| `gipity generate image\|video\|speech\|music "<prompt>" -o <path>` | Generate media into the source tree |
| `gipity test` | Run the project's test suite |
| `gipity skill list` / `gipity skill read <name>` | Live platform documentation |

Run `gipity --help` for the full command list.
