/**
 * Gipity plugin for opencode (opencode.ai). Installed to
 * ~/.config/opencode/plugins/gipity.js by the gipity CLI (`gipity build
 * --agent opencode` / `gipity init`), staged here in the skills repo with the
 * other agent hook scripts so it versions with the plugin marketplace.
 *
 * Three jobs:
 *
 *  1. MODEL SLOT - registers the "gipity" provider: the curated open coding
 *     models (DeepSeek / Qwen / Kimi / GLM families) served by the Gipity
 *     platform and billed via your Gipity credits. The model list comes from
 *     the platform at startup (falls back to the stable family aliases when
 *     offline). Auth resolves, in order: GIPITY_TOKEN env (relay/devbox and
 *     CI), the gipity CLI's minted model token (~/.gipity/opencode-token.json),
 *     or a token pasted via `opencode auth login` -> Gipity.
 *
 *  2. SESSION CAPTURE - mirrors sessions into the Gipity web CLI. On every
 *     session.idle it writes a normalized transcript
 *     (~/.gipity/opencode/transcripts/<session_id>.jsonl, one {info, parts}
 *     line per message) and invokes the shared capture runner
 *     (~/.gipity/agent-hooks/capture.cjs opencode stop), which owns
 *     conversation binding, watermarking, batching, and ingest. Skipped
 *     cleanly when the gipity CLI isn't installed.
 *
 *  3. HARNESS MARKERS - injects OPENCODE_SESSION_ID into shells opencode
 *     spawns so the gipity CLI can attribute its calls to this harness.
 *
 * Runs under Bun inside the opencode server process; plain ESM, no deps.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

const GIPITY_DIR = process.env.GIPITY_DIR || join(homedir(), '.gipity');
const TOKEN_FILE = join(GIPITY_DIR, 'opencode-token.json');
const TRANSCRIPT_DIR = join(GIPITY_DIR, 'opencode', 'transcripts');
const CAPTURE_RUNNER = join(GIPITY_DIR, 'agent-hooks', 'capture.cjs');

const API_BASE = (process.env.GIPITY_API_BASE || 'https://a.gipity.ai').replace(/\/+$/, '');
const SERVE_BASE = `${API_BASE}/llm/v1`;

/** Family aliases are stable across quarterly catalog rotations - the
 *  platform re-points each alias at the family's current member. Used as the
 *  offline fallback model list; the live list replaces it when reachable. */
const FALLBACK_MODELS = {
  deepseek: { name: 'DeepSeek (current family member, via Gipity credits)' },
  qwen: { name: 'Qwen Coder (current family member, via Gipity credits)' },
  kimi: { name: 'Kimi (current family member, via Gipity credits)' },
  glm: { name: 'GLM (current family member, via Gipity credits)' },
};

function readStoredToken() {
  const env = process.env.GIPITY_TOKEN?.trim();
  if (env) return env;
  try {
    const parsed = JSON.parse(readFileSync(TOKEN_FILE, 'utf-8'));
    if (typeof parsed?.token === 'string' && parsed.token) return parsed.token;
  } catch { /* absent or unreadable - fall through */ }
  return null;
}

async function fetchModels() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${SERVE_BASE}/models`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const body = await res.json();
    const list = Array.isArray(body?.data) ? body.data : null;
    if (!list || !list.length) return null;
    const models = {};
    for (const m of list) {
      if (typeof m?.id !== 'string' || !m.id) continue;
      models[m.id] = {
        name: typeof m.display_name === 'string' ? m.display_name : m.id,
        ...(m.context_length ? { limit: { context: m.context_length, output: m.max_output_tokens || 32768 } } : {}),
        ...(m.reasoning ? { reasoning: true } : {}),
        tool_call: true,
      };
    }
    return Object.keys(models).length ? models : null;
  } catch {
    return null;
  }
}

/** The linked Gipity project (".gipity.json" at the project root), if any.
 *  Sent as a header on model calls so the platform can attribute credit spend
 *  to the project (per-project cost reporting, bake-off accounting). */
function linkedProjectGuid(directory) {
  try {
    const parsed = JSON.parse(readFileSync(join(directory, '.gipity.json'), 'utf-8'));
    return typeof parsed?.projectGuid === 'string' && parsed.projectGuid ? parsed.projectGuid : null;
  } catch {
    return null;
  }
}

export const GipityPlugin = async ({ client, directory }) => {
  const seenSessions = new Set();
  const flushing = new Map(); // sessionID -> Promise, so idle bursts don't stack writes

  async function writeTranscript(sessionID) {
    const res = await client.session.messages({ path: { id: sessionID } });
    const messages = res?.data ?? res;
    if (!Array.isArray(messages) || !messages.length) return null;
    mkdirSync(TRANSCRIPT_DIR, { recursive: true });
    const path = join(TRANSCRIPT_DIR, `${sessionID}.jsonl`);
    const lines = messages
      .map((m) => (m?.info ? JSON.stringify({ info: m.info, parts: m.parts ?? [] }) : null))
      .filter(Boolean);
    writeFileSync(path, lines.join('\n') + '\n');
    return path;
  }

  function runCapture(sessionID, transcriptPath, { sync = false } = {}) {
    if (!existsSync(CAPTURE_RUNNER)) return; // gipity CLI not installed - capture off
    const payload = JSON.stringify({
      session_id: sessionID,
      transcript_path: transcriptPath,
      cwd: directory,
      hook_event_name: 'Stop',
    });
    const argv = [CAPTURE_RUNNER, 'opencode', 'stop'];
    if (sync) {
      // Shutdown path: the process may exit right after dispose() resolves,
      // so an async spawn would be killed mid-flush.
      spawnSync(process.execPath, argv, { input: payload, timeout: 60000, stdio: ['pipe', 'ignore', 'ignore'] });
    } else {
      const child = spawn(process.execPath, argv, { stdio: ['pipe', 'ignore', 'ignore'], detached: false });
      child.on('error', () => { /* capture is best-effort - never break the session */ });
      child.stdin.end(payload);
    }
  }

  async function flush(sessionID, opts = {}) {
    if (flushing.has(sessionID)) return flushing.get(sessionID);
    const p = (async () => {
      try {
        const path = await writeTranscript(sessionID);
        if (path) runCapture(sessionID, path, opts);
      } catch { /* best-effort */ } finally {
        flushing.delete(sessionID);
      }
    })();
    flushing.set(sessionID, p);
    return p;
  }

  return {
    async config(config) {
      // MODEL SLOT: register the "gipity" provider (an OpenAI-compatible
      // serving path; models are billed via your Gipity credits). Anything
      // the user already configured under "gipity" wins field-by-field.
      const token = readStoredToken();
      const models = (await fetchModels()) ?? FALLBACK_MODELS;
      const projectGuid = linkedProjectGuid(directory);
      config.provider ??= {};
      const existing = config.provider.gipity ?? {};
      config.provider.gipity = {
        npm: '@ai-sdk/openai-compatible',
        name: 'Gipity',
        ...existing,
        options: {
          baseURL: SERVE_BASE,
          ...(token ? { apiKey: token } : {}),
          ...(projectGuid ? { headers: { 'X-Gipity-Project': projectGuid } } : {}),
          ...(existing.options ?? {}),
        },
        models: { ...models, ...(existing.models ?? {}) },
      };
      // Pre-wire the default model only when the user has none at all - a
      // fresh zero-config install. Never override a configured default.
      config.model ??= 'gipity/deepseek';
    },

    auth: {
      provider: 'gipity',
      methods: [
        {
          type: 'api',
          label: 'Gipity agent token (gip_at_..., from `gipity token create` or gipity.ai settings)',
        },
      ],
      loader: async (getAuth) => {
        try {
          const stored = await getAuth();
          if (stored?.type === 'api' && stored.key) return { apiKey: stored.key };
        } catch { /* nothing stored via opencode auth */ }
        const token = readStoredToken();
        return token ? { apiKey: token } : {};
      },
    },

    'shell.env': async (input, output) => {
      // Harness attribution for gipity CLI calls made from opencode shells.
      output.env.OPENCODE_HARNESS = '1';
      if (input.sessionID) output.env.OPENCODE_SESSION_ID = input.sessionID;
    },

    event: async ({ event }) => {
      const sid = event?.properties?.sessionID
        ?? event?.properties?.info?.sessionID
        ?? (event?.type?.startsWith('session.') ? event?.properties?.info?.id : undefined);
      if (typeof sid === 'string' && sid) seenSessions.add(sid);
      if (event?.type === 'session.idle' && event?.properties?.sessionID) {
        await flush(event.properties.sessionID);
      }
    },

    async dispose() {
      // Headless (`opencode run`) exits right after the turn - session.idle
      // may not have flushed yet. Mirror whatever we saw, synchronously.
      for (const sid of seenSessions) {
        try {
          const path = await writeTranscript(sid);
          if (path) runCapture(sid, path, { sync: true });
        } catch { /* best-effort */ }
      }
    },
  };
};
