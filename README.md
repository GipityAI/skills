# Gipity plugin for Claude Code

[Gipity](https://gipity.ai) is a full-stack cloud platform tuned for AI agents - hosting, Postgres databases, serverless functions, auth, file storage, realtime, and AI services (image, speech, LLM), all driven by the `gipity` CLI.

This plugin teaches Claude Code how to use it: when you ask for something deployable (a web app, game, or API) or need a cloud backend, Claude can install the CLI, sign you in, link a project, and run the build → deploy → verify loop - ending with a live URL.

## Install

From the Gipity marketplace:

```
/plugin marketplace add GipityAI/skills
/plugin install gipity@gipity
```

Or, once available in the community marketplace:

```
/plugin install gipity@claude-community
```

## What's inside

- **`gipity` skill** - Claude automatically reaches for Gipity when you want to deploy/host something or need a backend (database, functions, auth, realtime, AI services) and nothing is set up yet. It detects your setup state, onboards you, and then defers to the platform's live documentation (`gipity skill list`) so guidance never goes stale.
- **`/gipity:setup` command** - explicit one-shot onboarding: install the CLI, log in (email + 6-digit code), link the current directory to a cloud project.
- **Use-case skills** (generated) - deep documentation for the things people most often want to build: full-stack web apps (`web-app-basics`), 2D games (`2d-game`), 3D/multiplayer games (`3d-world`), camera + computer-vision apps (`web-vision-mediapipe`), and realtime/presence features (`app-realtime`).
- **Project hooks** - keep a linked Gipity project in sync without the model having to remember to: every file the agent writes is pushed to your cloud workspace (`hooks/scripts/sync-push.js`), cloud-side changes are pulled before each turn (`sync-pull.js`), and `gipity claude` terminal sessions are mirrored to the web CLI (`capture.js`). Every hook checks for a `.gipity.json` in the working directory first and exits instantly outside Gipity projects - nothing runs, syncs, or phones home in your other repos. Uninstalling or disabling the plugin removes all hooks in one step.

The hand-written parts are intentionally thin, and every use-case skill is generated from the same `platform/docs/skills/*.md` sources that power the Gipity agent, the web docs (docs.gipity.ai), and `gipity skill read` - one source of truth, published to this plugin by `platform/scripts/sync-claude-plugin.ts`. Don't edit files marked GENERATED here; edit the platform doc and re-run the sync.

## Requirements

- Node.js 18+ (for `npm install -g gipity`)
- A Gipity account - created automatically on first login, free to start

## Development

```
claude plugin validate . --strict
```

This repo doubles as a Claude Code plugin marketplace (`.claude-plugin/marketplace.json`), so installing straight from the repo always gets the latest version.

## Questions?

steve@gipity.ai - this is early and moving fast; if something's broken or confusing, we want to hear about it.
