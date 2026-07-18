# Gipity plugin for agent CLIs (Claude Code, Grok, Codex, …)

[Gipity](https://gipity.ai) is a full-stack cloud platform tuned for AI agents - hosting, Postgres databases, serverless functions, auth, file storage, realtime, and AI services (image, speech, LLM), all driven by the `gipity` CLI.

This plugin teaches your coding agent how to use it: when you ask for something deployable (a web app, game, or API) or need a cloud backend, the agent can install the CLI, sign you in, link a project, and run the build → deploy → verify loop - ending with a live URL. The skills are plain [Agent Skills](https://agentskills.io) `SKILL.md` files, so any harness that reads that format can use them.

## Install

**Claude Code** (this repo doubles as its own plugin marketplace):

```
/plugin marketplace add GipityAI/skills
/plugin install gipity@gipity
```

**Grok Build** (reads Claude-format plugins natively - skills, commands, and hooks all load):

```
grok plugin install GipityAI/skills --trust
```

**OpenAI Codex** and other [agentskills.io](https://agentskills.io) harnesses (OpenClaw, Hermes, …): copy the `skills/<name>` directories into a skills dir your harness reads (for Codex: `~/.agents/skills/`).

**The easy path for all of the above:** `gipity init` in a project directory detects the agent CLIs on your machine and installs the plugin/skills/hooks into each one for you.

## What's inside

- **`gipity` skill** - the agent automatically reaches for Gipity when you want to deploy/host something or need a backend (database, functions, auth, realtime, AI services) and nothing is set up yet. It detects your setup state, onboards you, and then defers to the platform's live documentation (`gipity skill list`) so guidance never goes stale.
- **`/gipity:setup` command** - explicit one-shot onboarding: install the CLI, log in (email + 6-digit code), link the current directory to a cloud project.
- **Use-case skills** (generated) - deep documentation for the things people most often want to build: full-stack web apps (`web-app-basics`), 2D games (`2d-game`), 3D/multiplayer games (`3d-world`), camera + computer-vision apps (`web-vision-mediapipe`), and realtime/presence features (`app-realtime`).
- **`xquik-dashboard` skill** - build dashboards, monitors, and research tools that use Xquik's public X data API as an external data source.
- **Project hooks** (Claude Code and Grok via this plugin; Codex gets the same hooks installed directly by `gipity init`) - keep a linked Gipity project in sync without the model having to remember to: every file the agent writes is pushed to your cloud workspace (`hooks/scripts/sync-push.cjs`), and cloud-side changes are pulled before each turn (`sync-pull.cjs`). Terminal sessions in the project are also mirrored to the web CLI (`capture.cjs`) - Claude Code, Codex, and Grok alike, however you launch them (`gipity build` or plain `claude`/`codex`/`grok`; on a machine paired via `gipity login`; Codex session recording isn't available on Windows). Opt a project out of session recording with `gipity init --no-capture` (writes `captureHooks: false` to `.gipity.json`), or set `GIPITY_CAPTURE=off` for a one-off unrecorded session. Every hook checks for a `.gipity.json` in the working directory first and exits instantly outside Gipity projects - nothing runs, syncs, or phones home in your other repos. Uninstalling or disabling the plugin removes all hooks in one step.

The hand-written parts are intentionally thin, and every use-case skill is generated from the same `platform/docs/skills/*.md` sources that power the Gipity agent, the web docs (docs.gipity.ai), and `gipity skill read` - one source of truth, published to this plugin by `platform/scripts/sync-claude-plugin.ts`. Don't edit files marked GENERATED here; edit the platform doc and re-run the sync.

## Network and credentials

Everything talks to Gipity's own platform: the hooks and skills run the `gipity` CLI, which calls `*.gipity.ai` (API, deploys, sync) using the account you sign into via `gipity login` (email + 6-digit code; no API keys to paste). The plugin itself stores no secrets, and the hooks send nothing from directories that aren't linked Gipity projects.

## Requirements

- Node.js 18+ (for `npm install -g gipity`)
- A Gipity account - created automatically on first login, free to start

## Development

```
claude plugin validate . --strict
grok plugin validate .
```

This repo doubles as a Claude Code plugin marketplace (`.claude-plugin/marketplace.json`), so installing straight from the repo always gets the latest version.

## Questions?

steve@gipity.ai - this is early and moving fast; if something's broken or confusing, we want to hear about it.
