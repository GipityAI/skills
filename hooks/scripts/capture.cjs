#!/usr/bin/env node
/**
 * Lifecycle capture: mirror a terminal Claude Code session into Gipity so
 * the web CLI can display it read-only. Invoked as:
 *
 *   node capture.js <source> <event>
 *
 * Captures BOTH launch paths:
 *   - `gipity claude` - the CLI created the conversation up front and put
 *     GIPITY_CONVERSATION_GUID in our env.
 *   - bare `claude` (or any wrapper) inside a linked project - no env
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
const { existsSync, readFileSync, realpathSync } = require('fs');
const { spawnSync } = require('child_process');
const { join, dirname, delimiter, resolve } = require('path');
const { homedir } = require('os');

if (process.env.GIPITY_CAPTURE === 'off') process.exit(0);

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

  // Fallback: find the `gipity` binary on PATH, follow its symlink to the
  // package root (<pkg>/dist/updater/shim.js), and use the bundled runner.
  for (const dir of (process.env.PATH || '').split(delimiter)) {
    if (!dir) continue;
    try {
      const real = realpathSync(join(dir, 'gipity'));
      const candidate = resolve(dirname(real), '..', 'hooks', 'capture-runner.js');
      if (existsSync(candidate)) return candidate;
    } catch { /* not in this dir */ }
  }
  return null;
}

const runner = findRunner();
if (!runner) process.exit(0);

const res = spawnSync(process.execPath, [runner, ...process.argv.slice(2)], {
  stdio: 'inherit',
});
process.exit(res.status ?? 0);
