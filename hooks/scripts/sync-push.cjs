#!/usr/bin/env node
/**
 * PostToolUse (Write|Edit): push the edited file to the Gipity workspace so
 * web previews and the cloud agent see the change immediately.
 *
 * No-ops unless the working directory is a Gipity project (.gipity.json
 * present). The push runs detached so the session never waits on it, and any
 * failure (CLI missing, network down) is swallowed - sync self-corrects on
 * the next `gipity sync`.
 *
 * We locate the CLI entry and run it via `node` directly rather than
 * `spawn('gipity', ..., { shell: true })`: a shell launch re-parses the
 * argument line, so any file_path with a space (`C:\Users\Jane Doe\...`,
 * "My Documents", "OneDrive - Corp") or a shell metacharacter would be split
 * or mangled - and on Windows the shell was only there to resolve the `.cmd`
 * shim in the first place. `process.execPath` + the entry path needs no shell
 * and passes each arg verbatim. Mirrors capture.cjs's resolver.
 */
'use strict';
const { existsSync, realpathSync } = require('fs');
const { spawn } = require('child_process');
const { join, dirname, delimiter, resolve } = require('path');
const { homedir } = require('os');

/** Resolve the CLI entry (dist/index.js): the published local install first,
 *  then the `gipity` binary on PATH followed to its package. Null if neither
 *  is found - push is best-effort and must never break the session. */
function findCli() {
  const local = join(
    homedir(), '.gipity', 'local', 'node_modules', 'gipity', 'dist', 'index.js',
  );
  if (existsSync(local)) return local;

  for (const dir of (process.env.PATH || '').split(delimiter)) {
    if (!dir) continue;
    try {
      const real = realpathSync(join(dir, 'gipity'));
      const candidate = resolve(dirname(real), '..', 'index.js');
      if (existsSync(candidate)) return candidate;
    } catch { /* not in this dir */ }
  }
  return null;
}

let data = '';
process.stdin.on('data', (c) => { data += c; });
process.stdin.on('end', () => {
  try {
    if (!existsSync('.gipity.json')) return;
    const filePath = JSON.parse(data).tool_input?.file_path;
    if (!filePath) return;
    const cli = findCli();
    if (!cli) return;
    spawn(process.execPath, [cli, 'push', filePath, '--quiet'], {
      stdio: 'ignore',
      detached: true,
    }).unref();
  } catch { /* never block the session */ }
});
