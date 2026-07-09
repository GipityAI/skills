#!/usr/bin/env node
/**
 * PostToolUse (Write|Edit): push the edited file to the Gipity workspace so
 * web previews and the cloud agent see the change immediately.
 *
 * No-ops unless the working directory is a Gipity project (.gipity.json
 * present). Any failure (CLI missing, network down) is swallowed - sync
 * self-corrects on the next `gipity sync`.
 *
 * Saves are DEBOUNCED: each hook invocation appends its file to
 * .gipity/push-pending.txt and at most one detached "flusher" process exists
 * at a time (guarded by .gipity/push-flush.lock). The flusher waits a short
 * window, then runs ONE `gipity push <files...> --quiet` for the whole burst,
 * looping until no new saves landed. Before this, every single save spawned
 * its own detached CLI process and they all serialized on the project sync
 * lock - a multi-file edit burst meant N node startups and N lock queues.
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
const {
  existsSync, realpathSync, mkdirSync, appendFileSync, writeFileSync,
  readFileSync, renameSync, unlinkSync, statSync, utimesSync,
} = require('fs');
const { spawn, spawnSync } = require('child_process');
const { join, dirname, delimiter, resolve } = require('path');
const { homedir } = require('os');

const PENDING = join('.gipity', 'push-pending.txt');
const LOCK = join('.gipity', 'push-flush.lock');
const DEBOUNCE_MS = 400;
// A lock older than this is a crashed flusher; take over. Kept generous so a
// slow push (big file, slow network) isn't mistaken for a corpse - and the
// flusher re-touches the lock between rounds. A rare double-flusher is
// harmless anyway: `gipity push` is lock-protected and CAS-guarded.
const LOCK_STALE_MS = 30_000;

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

/** Atomically become the single flusher. Returns false when a live flusher
 *  already holds the lock (it will pick up our pending entry). */
function acquireFlusherLock() {
  try {
    writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
    return true;
  } catch {
    try {
      if (Date.now() - statSync(LOCK).mtimeMs > LOCK_STALE_MS) {
        unlinkSync(LOCK);
        writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
        return true;
      }
    } catch { /* raced another taker or lock vanished - they own it */ }
    return false;
  }
}

/** Flusher child: wait out the debounce window, then push every pending file
 *  in one CLI call, looping until no new saves arrive during a flush. */
function flush() {
  const cli = findCli();
  const finish = () => {
    try { unlinkSync(LOCK); } catch { /* already gone */ }
    // A save can land between the empty check and the lock release; its hook
    // saw our (still-live) lock and skipped spawning a flusher. Re-check after
    // releasing so that file doesn't sit stranded until the next save.
    if (existsSync(PENDING) && acquireFlusherLock()) setTimeout(round, DEBOUNCE_MS);
  };
  const round = () => {
    // Claim the current batch atomically; appends after the rename start a
    // fresh pending file that the next round (or next flusher) picks up.
    const work = PENDING + '.' + process.pid;
    try {
      renameSync(PENDING, work);
    } catch {
      finish();
      return; // no pending file - burst fully flushed
    }
    let files = [];
    try {
      files = [...new Set(readFileSync(work, 'utf-8').split('\n').filter(Boolean))];
      unlinkSync(work);
    } catch { /* unreadable batch - drop it; full sync self-corrects */ }
    if (files.length && cli) {
      try { const now = new Date(); utimesSync(LOCK, now, now); } catch { /* lock raced */ }
      const batch = spawnSync(process.execPath, [cli, 'push', ...files, '--quiet'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      // Fallback: a CLI from before multi-file `push` rejects >1 argument.
      // Re-push one at a time so a stale install degrades to the old
      // one-process-per-file behavior instead of silently dropping the batch.
      if (batch.status !== 0 && files.length > 1) {
        for (const f of files) {
          spawnSync(process.execPath, [cli, 'push', f, '--quiet'], {
            stdio: 'ignore',
            windowsHide: true,
          });
        }
      }
    }
    setTimeout(round, DEBOUNCE_MS);
  };
  setTimeout(round, DEBOUNCE_MS);
}

if (process.argv[2] === '--flush') {
  try { flush(); } catch { process.exit(0); }
} else {
  let data = '';
  process.stdin.on('data', (c) => { data += c; });
  process.stdin.on('end', () => {
    try {
      if (!existsSync('.gipity.json')) return;
      const filePath = JSON.parse(data).tool_input?.file_path;
      if (!filePath) return;
      mkdirSync('.gipity', { recursive: true });
      appendFileSync(PENDING, filePath + '\n');
      if (!acquireFlusherLock()) return; // live flusher will pick it up
      spawn(process.execPath, [process.argv[1], '--flush'], {
        stdio: 'ignore',
        detached: true,
        windowsHide: true,
      }).unref();
    } catch { /* never block the session */ }
  });
}
