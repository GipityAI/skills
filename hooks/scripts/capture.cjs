#!/usr/bin/env node
/**
 * Lifecycle capture: mirror a terminal `gipity claude` session into Gipity so
 * the web CLI can display it read-only. Invoked as:
 *
 *   node capture.js <source> <event>
 *
 * Three gates, all silent (exit 0):
 *   1. GIPITY_CONVERSATION_GUID unset - this is a bare `claude` session, not
 *      `gipity claude`; there is nothing to capture.
 *   2. `captureHooks: false` in the project's .gipity.json - per-project
 *      opt-out of the mirror-to-web feature.
 *   3. The gipity CLI can't be located - capture must never break a session.
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

if (!process.env.GIPITY_CONVERSATION_GUID) process.exit(0);

try {
  const cfg = JSON.parse(readFileSync('.gipity.json', 'utf-8'));
  if (cfg.captureHooks === false) process.exit(0);
} catch { /* not a project or unreadable - the runner re-checks context */ }

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
