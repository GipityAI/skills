# Gipity plugin for Claude Code

[Gipity](https://gipity.ai) is a full-stack cloud platform tuned for AI agents — hosting, Postgres databases, serverless functions, auth, file storage, realtime, and AI services (image, speech, LLM), all driven by the `gipity` CLI.

This plugin teaches Claude Code how to use it: when you ask for something deployable (a web app, game, or API) or need a cloud backend, Claude can install the CLI, sign you in, link a project, and run the build → deploy → verify loop — ending with a live URL.

## Install

From the Gipity marketplace:

```
/plugin marketplace add GipityAI/claude-plugin
/plugin install gipity@gipity
```

Or, once available in the community marketplace:

```
/plugin install gipity@claude-community
```

## What's inside

- **`gipity` skill** — Claude automatically reaches for Gipity when you want to deploy/host something or need a backend (database, functions, auth, realtime, AI services) and nothing is set up yet. It detects your setup state, onboards you, and then defers to the platform's live documentation (`gipity skill list`) so guidance never goes stale.
- **`/gipity:setup` command** — explicit one-shot onboarding: install the CLI, log in (email + 6-digit code), link the current directory to a cloud project.

The plugin is intentionally thin: the `gipity` CLI and the platform's live skill catalog are the source of truth, so the plugin doesn't drift as the platform evolves.

## Requirements

- Node.js 18+ (for `npm install -g gipity`)
- A Gipity account — created automatically on first login, free to start

## Development

```
claude plugin validate . --strict
```

This repo doubles as a Claude Code plugin marketplace (`.claude-plugin/marketplace.json`), so installing straight from the repo always gets the latest version.

## Questions?

steve@gipity.ai — this is early and moving fast; if something's broken or confusing, we want to hear about it.
