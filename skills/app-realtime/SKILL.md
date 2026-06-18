---
name: app-realtime
description: "Use when the user wants realtime multiplayer, live presence, chat, or shared live state in a web app - rooms, lobbies, WebSocket sync, host election - without running their own server. Gipity Realtime channels and the realtime kit."
---

<!-- GENERATED from platform/docs/skills/app-realtime.md by platform/scripts/sync-claude-plugin.ts - do not edit here. -->

> **Gipity required.** This skill needs the `gipity` CLI linked to a project. If `gipity status` errors or shows no project, run the setup flow in the `gipity` skill (or `/gipity:setup`) first.
>
> This doc is shared across Gipity surfaces; where it names an agent tool, use the CLI equivalent: `add` → `gipity add <name>`, `file_write`/`file_read`/`file_delete` → edit files in the project directory directly (they auto-sync), `project_deploy` → `gipity deploy dev`, `code_execute` → `gipity sandbox run`. The live version of this doc: `gipity skill read app-realtime`.

# Real-Time Multiplayer

Gipity apps get WebSocket-powered rooms for multiplayer games, chat, collaborative apps, and live dashboards. A room must be **provisioned** for the project before clients can connect - see "Provisioning a room" below.

**Most apps should build on the `@gipity/realtime` kit** (`gipity add realtime`) rather than the raw client documented further down - see "The realtime kit" below. The raw Colyseus patterns are kept as a reference and a fallback.

## Room Types

### Relay Room
Pure message broker - clients send typed messages, all others receive. No server state.
**Good for:** chat, notifications, signaling, real-time feeds, simple multiplayer.

### State Room
Server-authoritative shared state. Auto-tracks players in a synced map. Generic key-value `data` map (values are JSON strings) auto-synced to all clients.
**Good for:** games, collaborative editors, dashboards, turn-based games, anything needing shared truth.

## The realtime kit (start here)

For anything beyond a toy, do not hand-roll the Colyseus client - run `gipity add realtime` and build on the `@gipity/realtime` kit. It wraps everything in this doc (onStateChange diffing, tokens, reconnection, lobby + match rooms) behind a tested, engine-agnostic API. The raw Colyseus patterns below are the fallback and a reference for what the kit does internally.

**Channels** - one room, namespaced sub-streams. `rt.channel(name, { sync })` where `sync` is:
- `messages` - pub/sub relay.
- `presence` - ephemeral per-peer state (cursors, positions) at ~20 Hz.
- `entities` - per-record CRUD; `authority: 'shared'` (last-write-wins) or `'host'` (elected writer + physics delta-sync).
- `store` - synchronous whole-object key-value (`get` / `set` / `update` / `onChange`) - the shape a turn-based game or match state wants. `authority: 'host'` optional.

**Multi-room (lobby games)** - one client, many rooms:

```js
import { createRealtime, createDirectory } from '@gipity/realtime';
const rt = createRealtime();
const lobby = await rt.join('lobby');             // shared directory room
const match = await rt.create('match');           // a fresh match instance
const other = await rt.joinById(roomId, 'match'); // join an advertised one
```

`createDirectory(lobby)` turns the lobby into a heartbeat'd listing of open rooms.

**Reading state right after a join** - `rt.joinById(...)` resolves on **join**, before the room's state has synced. `channel.get(key)` will return `undefined` until the first sync lands. If you need to read state immediately on join (e.g. a lobby joiner inspecting the host's match state), `await new Promise((r) => channel.onReady(r))` first. Otherwise rely on `channel.onChange` to drive your UI.

**Reconnection is automatic** - an unclean drop is recovered via the Colyseus reconnection token with the session id preserved (channels and seats survive a blip). Observe it with `rt.on('reconnecting')` / `'reconnected'` / `'lost'`.

Worked references ship inside the kit: `examples/` has one file per shape (chat, whiteboard, kanban, city-builder, agent-ops, desktop, lobby, connect-four) plus `README.md`. Room names still need provisioning - see below.

### Presence done well

A who's-here / presence list has three quality gaps that are easy to miss while building and obvious in use. Make these the default for any presence app:

1. **Persist identity across reloads.** Generate a stable peer id once and store it (plus the chosen name) in `localStorage`; pre-fill the name input on load so a returning teammate isn't re-prompted on every refresh.
2. **Scope the room from the URL.** Read the room name from a path segment or `?room=` query param with a sensible default, so two different teams sharing the same app link land in separate presence lists instead of one global room.
3. **Render a stable identity per peer.** Show an initials avatar plus the stable peer id, not the display name alone - otherwise two people both named "Sam" are indistinguishable.

```js
import { createRealtime } from '@gipity/realtime';

// 1. Stable identity that survives a reload - generate a peer id once, persist the
//    chosen name, and pre-fill the input so a returning teammate isn't re-prompted.
const peerId = localStorage.getItem('peerId')
  || ('peer-' + Math.random().toString(36).slice(2, 10));
localStorage.setItem('peerId', peerId);
nameInput.value = localStorage.getItem('name') || '';   // pre-fill, don't re-ask

// 2. Scope the room from the URL so different teams sharing one app link get
//    separate presence lists. Try ?room=, then a path segment, then a default.
const room = new URLSearchParams(location.search).get('room')  // ?room=engineering
  || location.pathname.split('/').filter(Boolean).pop()        // …/engineering/
  || 'standup';                                                // sensible default

const rt = await createRealtime({ room });
const here = rt.channel('presence', { sync: 'presence' });

function announce(name) {
  localStorage.setItem('name', name);                   // remember for next visit
  here.set({ peerId, name });                           // announce a stable identity
}

// 3. Render a stable identity per peer so two people both named "Sam" stay distinct:
//    an initials avatar plus the stable peer id, not the display name alone.
here.onChange(peers => renderRoster(peers.map(p => ({
  initials: (p.name || '?').trim().slice(0, 2).toUpperCase(),
  name: p.name,
  id: p.peerId,                                         // disambiguates duplicate names
}))));
```

## Provisioning a room

A room must exist before an app can connect. There are **three equivalent ways** - all create the same room record, so pick whichever fits the workflow:

- **Declarative (best for deployed apps)** - declare it in `gipity.yaml` as a `realtime` deploy phase. `gipity deploy` reconciles it (creates if missing, no-op if it exists) - reproducible, no separate step. The `3d-world` / `3d-engine` templates already ship this.
  ```yaml
  deploy:
    phases:
      - name: realtime
        type: realtime
        rooms:
          - name: game-lobby
            room_type: state
            auth_level: public
  ```
- **CLI** - `gipity realtime room create game-lobby --type state --auth public` (also `list`, `info`, `delete`). Deterministic and scriptable - good for CI. The same command exists in the web CLI as `/realtime room ...`.
- **Agent tool** - `realtime_room action=create name=game-lobby room_type=state auth_level=public`. Use when working inside a chat turn.

## Quick Start

1. Provision a room (see "Provisioning a room" above) - e.g. the agent tool:
```
realtime_room action=create name=game-lobby room_type=state auth_level=public max_clients=50
```

2. In your app's HTML, load the realtime client from CDN (all API patterns are documented below - do not search the web for external docs). Pin the exact version - the state-room API below is written for `0.16.22`:
```html
<script src="https://unpkg.com/colyseus.js@0.16.22/dist/colyseus.js"></script>
```

3. Connect to the room:

**IMPORTANT:** The token endpoint is on the API server, NOT the app host. You MUST use the absolute URL `https://a.gipity.ai/api/token` - never a relative path like `/api/token`. It is a POST request and the token is nested under `data`.

```js
// Get app token - MUST be absolute URL to API server, POST with app GUID
const resp = await fetch('https://a.gipity.ai/api/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ app: '<PROJECT_GUID>' })
});
const { data: { token } } = await resp.json();
// ✗ WRONG: fetch('/api/token')           - relative URL hits app host, not API
// ✗ WRONG: fetch('https://a.gipity.ai/api/token')  with GET - must be POST
// ✗ WRONG: const { token } = await ...   - token is inside data: { data: { token } }

const client = new Colyseus.Client("wss://rt.gipity.ai");
const room = await client.joinOrCreate("state", {
  app: "<PROJECT_GUID>",
  room: "game-lobby",
  token
});
```

## Room Discovery (Lobby / Matchmaking)

The client library does **NOT** have a room listing function. To list rooms, use the REST endpoint:

```js
// List available rooms (uses the app token from step 1)
const roomsResp = await fetch(
  'https://rt.gipity.ai/rooms?room=game-lobby&token=' + encodeURIComponent(token)
);
const { rooms } = await roomsResp.json();
// rooms = [{ roomId, clients, maxClients, metadata }, ...]
```

### Lobby Pattern - Join Existing or Create New
```js
const roomsResp = await fetch(
  'https://rt.gipity.ai/rooms?room=game-lobby&token=' + encodeURIComponent(token)
);
const { rooms } = await roomsResp.json();

// Find a room that isn't full
const available = rooms.find(r => r.clients < r.maxClients);
let room;
if (available) {
  // Join existing room by ID
  room = await client.joinById(available.roomId, {
    app: "<PROJECT_GUID>", room: "game-lobby", token
  });
} else {
  // No room available - create a new one
  room = await client.joinOrCreate("state", {
    app: "<PROJECT_GUID>", room: "game-lobby", token
  });
}
```

> **Note:** The `room` query param is optional - omit it to list all rooms for your app.
> **Never use** `client.getAvailableRooms()` - it does not exist in the client library.

## Relay Room Patterns

```js
// Send a typed message
room.send("chat", { user: "Alice", text: "Hello!" });
room.send("move", { x: 10, y: 20 });

// Receive messages by type
room.onMessage("chat", (msg) => {
  console.log(msg.user + ": " + msg.text);
});
room.onMessage("move", (msg) => {
  movePlayer(msg.x, msg.y);
});
```

## State Room Patterns

**IMPORTANT - how to read state-room state.** The Colyseus client (`colyseus.js@0.16.22`) does **not** expose `.onAdd()` / `.onChange()` / `.onRemove()` callbacks on the `players` and `data` maps - those were removed after 0.14, and calling them throws `TypeError: ... is not a function`. Instead, react to state inside `room.onStateChange` - it fires with the **full state** on every server update - and diff it against what you have already seen. The maps are also `undefined` on a fresh room, so always guard before reading them.

### Players (auto-tracked)
```js
// Detect joins/leaves by diffing room.state.players on every update.
const knownPlayers = new Set();
room.onStateChange((state) => {
  if (!state.players) return;            // undefined on a fresh room
  const present = new Set();
  state.players.forEach((player, sessionId) => {
    present.add(sessionId);
    if (knownPlayers.has(sessionId)) return;
    knownPlayers.add(sessionId);
    console.log("Player joined:", player.displayName);
  });
  for (const sessionId of [...knownPlayers]) {
    if (present.has(sessionId)) continue;
    knownPlayers.delete(sessionId);
    console.log("Player left:", sessionId);
  }
});

// ✗ WRONG - .onAdd is not a function in colyseus.js 0.16:
// state.players.onAdd((player, sid) => { ... })

// Set custom player data (e.g. score, position)
room.send("set_player_data", { data: JSON.stringify({ score: 100 }) });
```

### Shared Data (key-value, auto-synced)
```js
// Set shared data (any client can set, all clients receive)
room.send("set_data", { key: "gameState", value: JSON.stringify({ round: 1, phase: "playing" }) });
room.send("delete_data", { key: "oldKey" });

// Detect changes by diffing room.state.data on every update. Values are JSON
// strings - compare them raw to spot a change, then parse.
const dataSeen = new Map();   // key -> last raw JSON string
room.onStateChange((state) => {
  if (!state.data) return;               // undefined on a fresh room
  state.data.forEach((value, key) => {
    if (dataSeen.get(key) === value) return;   // unchanged
    dataSeen.set(key, value);
    console.log(key, "changed to:", JSON.parse(value));
  });
  for (const key of [...dataSeen.keys()]) {
    if (state.data.has(key)) continue;
    dataSeen.delete(key);
    console.log(key, "deleted");
  }
});

// ✗ WRONG - .onChange is not a function in colyseus.js 0.16:
// state.data.onChange((value, key) => { ... })
```

### Custom Messages (broadcast to all)
```js
// Any unrecognized message type is broadcast to all other clients
room.send("explosion", { x: 50, y: 30, radius: 10 });
room.onMessage("explosion", (data) => renderExplosion(data));
```

## Turn-Based Game Pattern

Use a state room with a `currentTurn` key:
```js
// Host sets initial turn
room.send("set_data", { key: "currentTurn", value: JSON.stringify(room.sessionId) });
room.send("set_data", { key: "board", value: JSON.stringify(Array(9).fill(null)) });

// On each move, update board + advance turn
function makeMove(index) {
  const board = JSON.parse(room.state.data.get("board"));
  board[index] = mySymbol;
  room.send("set_data", { key: "board", value: JSON.stringify(board) });
  room.send("set_data", { key: "currentTurn", value: JSON.stringify(opponentSessionId) });
}

// React to board/turn changes by diffing data on every update
const seen = new Map();
room.onStateChange((state) => {
  if (!state.data) return;
  state.data.forEach((value, key) => {
    if (seen.get(key) === value) return;   // unchanged
    seen.set(key, value);
    if (key === "board") renderBoard(JSON.parse(value));
    if (key === "currentTurn") updateTurnIndicator(JSON.parse(value));
  });
});
```

## Human/AI parity

When an app fields **both bot and human players**, anything a bot can do on its turn must also be reachable by a human through the UI - bots and humans get an equivalent set of actions, never a strict subset. If a bot can buy, build, mortgage, sell, bid, or trade, the human needs an affordance for each. Trading is the one most often dropped, so wire it up too.

## State Room - Safe Initialization Boilerplate

Copy-paste this as your starting point for any state room app:
```js
// 1. Get token
const resp = await fetch('https://a.gipity.ai/api/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ app: '<PROJECT_GUID>' })
});
const { data: { token } } = await resp.json();

// 2. Connect (or use Room Discovery to join an existing room - see above)
const client = new Colyseus.Client("wss://rt.gipity.ai");  // from CDN loaded above
const room = await client.joinOrCreate("state", {
  app: "<PROJECT_GUID>",
  room: "my-room",
  token
});

// 3. React to state by diffing it. onStateChange fires with the full state
//    on every server update; colyseus.js 0.16 has NO .onAdd/.onChange
//    callbacks on the maps - diff against what you have seen instead.
const knownPlayers = new Set();
const dataSeen = new Map();
room.onStateChange((state) => {
  // Players
  if (state.players) {
    const present = new Set();
    state.players.forEach((player, sessionId) => {
      present.add(sessionId);
      if (!knownPlayers.has(sessionId)) {
        knownPlayers.add(sessionId);
        // Handle player join
      }
    });
    for (const sessionId of [...knownPlayers]) {
      if (!present.has(sessionId)) {
        knownPlayers.delete(sessionId);
        // Handle player leave
      }
    }
  }
  // Shared data - values are JSON strings
  if (state.data) {
    state.data.forEach((value, key) => {
      if (dataSeen.get(key) !== value) {
        dataSeen.set(key, value);
        const parsed = JSON.parse(value);
        // Handle data change
      }
    });
  }
});

// 4. Send messages
room.send("set_data", { key: "myKey", value: JSON.stringify({ foo: "bar" }) });

// 5. Cleanup on leave
room.onLeave((code) => {
  console.log("Left room, code:", code);
});
```

## Auth
- **public**: Pass app token in join options - no login needed
- **user**: Requires Gipity session cookie (Sign in with Gipity)

## Verifying presence/shared state across clients

Presence and shared state only mean anything when two clients are **live at the same time**. Two important traps:

- `gipity page test` *without* `--observe` does passive page loads only — it never submits a name, clicks, or reads shared state, so it can't tell you whether clients see each other.
- Two separate `gipity page eval` calls run **sequentially** — each finishes before the next starts, so the clients never coexist and each sees only itself. That looks identical to a broken presence kit, but it's a false negative from the harness, not a bug in your app. Don't go debugging the transport over it.

The fix for both is the interactive mode of `page test`, which spins up N **genuinely concurrent** clients, drives an action in each, samples the shared state over a window, and then **verifies the clients actually overlapped in time** (refusing to call a non-overlapping run a pass):

```
gipity page test ".../app/" --clients 2 --labels Alice,Bob   --action "document.querySelector('#name').value='{{label}}'; document.querySelector('form').requestSubmit();"   --observe "document.querySelectorAll('.present').length"
```

`{{label}}` / `{{i}}` are substituted per client. Each client runs `--action` once, then samples `--observe` across `--hold` ms (default 8000, `--samples` readings). A working presence app prints each client's count rising as the other joins (e.g. `1 → 1 → 2 → 2`) plus `✓ all clients overlapped for ~Ns`. If the clients didn't overlap (too much `--stagger`, or more `--clients` than free browser slots), it says so loudly and exits non-zero instead of giving you a misleading green. Use `--wait-for <selector>` to gate the action on the form being ready.

## URL-param test mode (also handy for multiplayer lobbies)

A click-driven multi-client test (two browsers, host on one, join from the other) is real work to write and slow to run. A small **URL-param test mode** in the app turns it into two passive page loads:

- `?test-name=Alice` - auto-fills the player name on load.
- `?test-action=host` - once on the lobby, auto-clicks Host (or your equivalent).
- `?test-action=join` - once on the lobby, auto-joins the first open game.
- `?test-action=join&room=<id>` - joins a specific room.

With those, verification is a single `gipity page test` run - it loads the URL in N staggered headless clients (client 0 settles first as host, the rest join) and flags any error/crash lines across their consoles:

```
gipity page test ".../app/?test-name=Player&test-action=join" --clients 3 --stagger 8 --wait 10000
```

For asymmetric roles (one host, others join), don't run two separate calls — they execute sequentially, so the host client is gone (or its room is stale) by the time the joiners load, and you get a false negative. Co-launch the roles in **one** interactive invocation instead: with `--observe`, `{{label}}` / `{{i}}` substitute into the URL too, and the overlap check confirms the roles actually coexisted:

```
gipity page test ".../app/?test-name={{label}}&test-action={{label}}" --clients 2 --labels host,join   --observe "document.querySelector('[data-screen]')?.dataset.screen"
```

Client 0 loads `?test-action=host` and client 1 `?test-action=join`, genuinely concurrently — no backgrounding + `sleep` dance, no stale lingering room to land in.

No Puppeteer, no Chromium libs, no DOM driving — a passive `page test` (no `--observe`) just loads the URL, so the URL-param test mode is what makes the load alone exercise the join path. (When you'd rather drive the form than add a test mode, the interactive `page test --observe` above does the DOM driving for you.) Implement it once per multiplayer app and every realtime change is a 30-second smoke test from there on. Pair it with the `data-testid` / `data-screen` / `data-ready` conventions from `web-app-basics` for any leftover click-driven tests.

## Tips
- The `@gipity/realtime` kit (`gipity add realtime`) covers lobby + match rooms, a `store` channel for whole-object state, presence, host election, and automatic reconnection - prefer it over hand-rolling any of the above
- Split state into many small keys, not one big JSON blob (each key change re-syncs the entire value)
- Room config changes apply to new instances only - existing connections are unaffected
- Room instances have a max client limit (see `realtime_room info` for current limits); the server auto-creates new instances when rooms fill up
- Use relay rooms for simple message passing; use state rooms when you need server-authoritative truth
- When editing connection code, read the entire connection function before making changes - partial edits that fix one issue while missing a related one waste a full deploy cycle

## Related
- [realtime-scheduled-app](https://docs.gipity.ai/skills/realtime-scheduled-app.html) - end-to-end recipe combining presence + messages with a database and a scheduled poster
