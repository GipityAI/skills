#!/usr/bin/env node
/**
 * Lifecycle capture: mirror a terminal coding-agent session into Gipity so
 * the web CLI can display it read-only. Invoked as:
 *
 *   node capture.js <source> <event>
 *
 * Serves every harness that runs these hooks: Claude Code and any tool that
 * runs Claude-format plugin hooks natively (Grok Build today) load them via
 * the Gipity plugin - those tools set their own env marker on every hook
 * process, which SOURCE_REWRITES below maps to the right source arg so the
 * CLI picks that agent's transcript parser - and Codex via the project's
 * .codex/hooks.json (which passes source 'codex' explicitly).
 *
 * Captures BOTH launch paths:
 *   - `gipity build` - the CLI created the conversation up front and put
 *     GIPITY_CONVERSATION_GUID in our env.
 *   - bare `claude` / `codex` / `grok` inside a linked project - no env
 *     binding; the runner self-arms by resolving the project's
 *     conversation from `.gipity.json` + the session_id.
 *
 * Gates, all silent (exit 0):
 *   1. GIPITY_CAPTURE=off - the relay daemon owns capture for this run
 *      (it parses stream-json from stdout; a hook post would double-write
 *      every event), or the caller wants a one-off unrecorded session.
 *   2. No binding possible: neither GIPITY_CONVERSATION_GUID nor a
 *      `.gipity.json` in the working directory - not a Gipity session.
 *   3. `captureHooks: false` in the project's .gipity.json - per-project
 *      opt-out of the mirror-to-web feature (`gipity init --no-capture`).
 *   4. The gipity CLI can't be located - capture must never break a session.
 *
 * The actual capture logic lives in the CLI (dist/hooks/capture-runner.js) so
 * it versions with the CLI, not the plugin. This script only resolves the
 * runner at fire time: the published install location first, then the
 * `gipity` binary on PATH (npm global or a dev link) followed to its package.
 */
'use strict';
const { existsSync, readFileSync, realpathSync, writeFileSync } = require('fs');
const { spawnSync } = require('child_process');
const { join, dirname, delimiter, resolve } = require('path');
const { homedir } = require('os');

if (process.env.GIPITY_CAPTURE === 'off') process.exit(0);

// This same plugin loads natively in any tool that runs Claude-format plugin
// hooks, not just Claude Code itself - Grok Build is the first example. Those
// tools' hooks fire with source 'claude-code' (it's the Claude plugin's), so
// they're told apart by an env var THEY set on every hook process, and the
// source arg is rewritten accordingly before the CLI's capture runner sees
// it - which then picks that agent's transcript parser and labels the
// conversation correctly. Adding the next Claude-hook-compatible agent is one
// entry here, nothing else on this side (the parser/normalization live in
// the CLI). Order matters only if two entries could both match - none do today.
const SOURCE_REWRITES = [
  // Grok Build: runs Claude-format plugin hooks natively and sets
  // GROK_HOOK_EVENT. The runner also normalizes Grok's camelCase hook
  // payload and derives the transcript path from the session id.
  { env: 'GROK_HOOK_EVENT', source: 'grok' },
];

const args = process.argv.slice(2);
if (args[0] === 'claude-code') {
  const rewrite = SOURCE_REWRITES.find((r) => process.env[r.env]);
  if (rewrite) args[0] = rewrite.source;
}

// Find the project's .gipity.json by walking up from cwd - the session may
// have been launched in a subdirectory of the project. Mirrors the CLI's
// own config resolution.
function findProjectConfig() {
  let dir = process.cwd();
  for (;;) {
    const candidate = join(dir, '.gipity.json');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

const configPath = findProjectConfig();
if (!process.env.GIPITY_CONVERSATION_GUID && !configPath) process.exit(0);

if (configPath) {
  try {
    const cfg = JSON.parse(readFileSync(configPath, 'utf-8'));
    if (cfg.captureHooks === false) process.exit(0);
  } catch { /* unreadable - the runner re-checks context */ }
}

function findRunner() {
  // Published install: the updater bootstraps the CLI to a fixed location.
  const local = join(
    homedir(), '.gipity', 'local', 'node_modules', 'gipity',
    'dist', 'hooks', 'capture-runner.js',
  );
  if (existsSync(local)) return local;

  // Fallback: find the `gipity` binary on PATH and locate the bundled runner
  // relative to whatever entry file it resolves to.
  //
  // Do NOT assume a fixed depth here. This used to hardcode one level up
  // (`<entry>/../hooks/capture-runner.js`), which is right only when the bin
  // resolves to <pkg>/dist/updater/shim.js - the published self-updating
  // shim. The relay-host image deliberately repoints the bin at
  // <pkg>/dist/index.js to bypass the updater (services/relay-host/
  // Dockerfile), so `..` overshot to <pkg>/hooks, this returned null, and
  // capture silently exited 0 in EVERY devbox - opencode/codex/grok sessions
  // billed tokens and wrote files while the web CLI showed nothing but
  // "finished" markers. Walking ancestors instead works for both layouts and
  // for any future entry point.
  for (const dir of (process.env.PATH || '').split(delimiter)) {
    if (!dir) continue;
    try {
      let cursor = dirname(realpathSync(join(dir, 'gipity')));
      for (;;) {
        const candidate = join(cursor, 'hooks', 'capture-runner.js');
        if (existsSync(candidate)) return candidate;
        const parent = dirname(cursor);
        if (parent === cursor) break;
        cursor = parent;
      }
    } catch { /* not in this dir */ }
  }
  return null;
}

/** Leave a breadcrumb for the silent-failure paths.
 *
 *  Capture must never break a session, so every gate here exits 0 - but the
 *  two "we couldn't run at all" gates are indistinguishable from "captured
 *  nothing" without this. Callers discard our stderr (the opencode plugin
 *  spawns us with stdio ignore), so a file is the only channel that survives. */
function breadcrumb(reason) {
  try {
    writeFileSync(
      join(homedir(), '.gipity', 'agent-hooks', 'capture-last-error.log'),
      `${new Date().toISOString()} ${reason}\n`,
      { flag: 'a' },
    );
  } catch { /* best-effort by definition */ }
}

const runner = findRunner();
if (!runner) {
  breadcrumb(`capture-runner.js not found (gipity CLI unreachable from PATH=${process.env.PATH || ''})`);
  process.exit(0);
}

const res = spawnSync(process.execPath, [runner, ...args], {
  stdio: 'inherit',
});
process.exit(res.status ?? 0);
