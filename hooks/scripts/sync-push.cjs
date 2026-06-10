#!/usr/bin/env node
/**
 * PostToolUse (Write|Edit): push the edited file to the Gipity workspace so
 * web previews and the cloud agent see the change immediately.
 *
 * No-ops unless the working directory is a Gipity project (.gipity.json
 * present). The push runs detached so the session never waits on it, and any
 * failure (CLI missing, network down) is swallowed - sync self-corrects on
 * the next `gipity sync`.
 */
'use strict';
const { existsSync } = require('fs');
const { spawn } = require('child_process');

let data = '';
process.stdin.on('data', (c) => { data += c; });
process.stdin.on('end', () => {
  try {
    if (!existsSync('.gipity.json')) return;
    const filePath = JSON.parse(data).tool_input?.file_path;
    if (!filePath) return;
    spawn('gipity', ['push', filePath, '--quiet'], {
      stdio: 'ignore',
      detached: true,
      shell: true,
    }).unref();
  } catch { /* never block the session */ }
});
