---
name: agent-deploy
description: "Use when an AI agent, script, or CI job needs to deploy to or operate Gipity WITHOUT a human present to complete an interactive email-code login - e.g. a self-hosted coding agent (Hermes, OpenClaw), a cron, or a CI pipeline running in an ephemeral container. Covers minting a long-lived agent API token (gip_at_*), authenticating headlessly via the GIPITY_TOKEN env var, and running the build → deploy → verify loop unattended."
---

<!-- GENERATED from platform/docs/skills/agent-deploy.md by platform/scripts/sync-claude-plugin.ts - do not edit here. -->

> **Gipity required.** This skill needs the `gipity` CLI linked to a project. If `gipity status` errors or shows no project, run the setup flow in the `gipity` skill (or `/gipity:setup`) first.
>
> This doc is shared across Gipity surfaces; where it names an agent tool, use the CLI equivalent: `add` → `gipity add <name>`, `file_write`/`file_read`/`file_delete` → edit files in the project directory directly (they auto-sync), `project_deploy` → `gipity deploy dev`, `code_execute` → `gipity sandbox run`. The live version of this doc: `gipity skill read agent-deploy`.

# Headless Deploy with Agent API Tokens

The normal `gipity login` is interactive: it emails a 6-digit code that a human reads and pastes back. An autonomous agent, a cron job, or a CI runner has no inbox to check - and a fresh/ephemeral container has no saved session on disk. For those, use a long-lived **agent API token** (`gip_at_*`) instead. It authenticates from an environment variable, so it survives fresh containers, never expires unless you set `--expires`, bills to your account like any other usage, and can be revoked instantly.

This is the path for **self-hosted coding agents (e.g. Hermes, OpenClaw), scripts, and CI** that want to build, deploy, and operate Gipity apps without a human in the loop.

## When to use this

- You're an agent/script running unattended - no human to read an email code.
- You run in an ephemeral or rebuilt container (no persistent `~/.gipity/auth.json`).
- You're wiring Gipity into CI/CD or a scheduled job.

If a human is present at a terminal, plain `gipity login` is simpler - see [getting-started](https://docs.gipity.ai/skills/getting-started.html). Use a token when login can't be completed interactively.

## 1. Mint a token (one time, needs an interactive session)

From a machine where you're already logged in - your own CLI **or** the web CLI in the browser:

```bash
gipity token create --name "Hermes on my VPS"        # name is a label you choose
gipity token create --name "CI deploy" --expires 90  # optional expiry, in days
gipity token create --name "ci" --expires 90 --json  # machine-readable
```

It prints the token **once** - copy it immediately, it can't be retrieved later:

```
gip_at_eygYHKVRkBP8UXY5dfQzZV_xMH6t1x4Bynnhv4GD128
```

Only a hash is stored server-side, so a lost token can't be recovered - only revoked and replaced. With `--json` the output is `{ "token": "gip_at_…", "shortGuid": "at_…", "expiresAt": "…"|null }`.

## 2. Use it: set GIPITY_TOKEN

Put the token in the agent's environment. The CLI picks it up automatically, skips login entirely, and acts as your account:

```bash
export GIPITY_TOKEN=gip_at_eygYHKVRkBP8UXY5dfQzZV_xMH6t1x4Bynnhv4GD128
```

That's the whole auth step. `GIPITY_TOKEN` takes precedence over any saved session, so the same command works identically in a fresh container with no `auth.json` and on a logged-in workstation. Every CLI command now works unattended:

```bash
gipity status                       # confirms authenticated, no login prompt
gipity init                         # link the cwd as a project (or `gipity add <template>` in an empty dir)
gipity deploy dev                   # → https://dev.gipity.ai/<account>/<project>/
gipity page inspect <url>           # headless verify: console errors, failed resources
```

The full build loop - `gipity add` → edit files → `gipity deploy dev` → `gipity page inspect` → fix → repeat (see [deploy](https://docs.gipity.ai/skills/deploy.html)) - runs with no interactive step anywhere.

> **Keep deploys on dev.** Never run `gipity deploy prod` unattended unless the job is explicitly a production release - `prod` publishes to the user's live URL.

## 3. Manage and revoke

```bash
gipity token list              # active tokens: name, created, expires, last-used
gipity token revoke <id>       # e.g. gipity token revoke at_espgamjb - instant, irreversible
```

Revocation takes effect immediately. The active token count also appears on the Plan tab in Monitor.

## Security notes

- **Treat a token like a password.** It acts as your full account and bills to you.
- **Never commit it.** Inject it through the platform's secret store / environment, not a tracked file. Don't echo it into logs.
- **Scope its lifetime** with `--expires <days>` for CI or short-lived agents; omit it only for long-running trusted agents.
- **Rotate on suspicion.** If a token may have leaked, `gipity token revoke <id>` and mint a fresh one - there's no in-place rotation.
- **One token per consumer.** Give each agent/CI job its own named token so you can revoke one without disrupting the others, and `last-used` tells you which is which.

## How it works (reference)

| Piece | Detail |
|---|---|
| Token format | `gip_at_` + random secret; shown once at creation |
| Env var | `GIPITY_TOKEN` - read by the CLI on every command, ahead of any saved login |
| Sent as | `Authorization: Bearer gip_at_…` to the Gipity API |
| Stored as | A one-way hash server-side - never the plaintext |
| Lifetime | Never expires unless `--expires <days>` is set; revoke is instant |
| Mint / list / revoke | `POST` / `GET` / `DELETE` `…/auth/agent-tokens` (via `gipity token …`) |

## Related skills

- [getting-started](https://docs.gipity.ai/skills/getting-started.html) - accounts, the interactive `gipity login`, credits
- [deploy](https://docs.gipity.ai/skills/deploy.html) - the deploy pipeline and `gipity.yaml` the token-authed agent drives
- [web-app-basics](https://docs.gipity.ai/skills/web-app-basics.html) - building the app you deploy
