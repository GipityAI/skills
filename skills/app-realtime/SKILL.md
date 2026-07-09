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

**Most apps should build on the `@gipity/realtime` kit** (`gipity add realtime`) rather than the raw Colyseus client - see "The realtime kit" below. The raw client is kept as a fallback in [app-realtime-reference](https://docs.gipity.ai/skills/app-realtime-reference.html) (`gipity skill read app-realtime-reference`).

**The realtime build loop ends with a concurrent two-client check, not a page load.** Realtime work is only "done" after `gipity page test <url> --clients 2 --observe ...` shows the clients seeing each other (details in "Verifying presence/shared state across clients" below). A single `page inspect`/`page eval` cannot verify multiplayer, and two sequential evals are a false negative - plan the test-mode hooks for this while building, not after.

## Pick a room model (all built into the kit)

| Model | Use for | API |
|---|---|---|
| **One shared space** | presence lists, chat, collab docs, dashboards | `createRealtime({ room })` + `connect()` |
| **Spaces from the URL** | per-team / per-session spaces off one app link | same, plus `scope: <url param>` |
| **Invite a friend** | 1v1 / private matches via share link or 4-char code | `createParty()` → `host()` / `joinFromUrl()` / `joinByCode()` |
| **Open lobby** | browse open games, quick-match strangers | `createParty()` → `onTables()` / `join(entry)` / `quickMatch()` |

Don't hand-roll a lobby, invite link, or room-code flow out of the primitives - `createParty` already owns those flows and their failure modes (cancelable hosting, typed join errors, one staleness window). Hand-rolled versions have repeatedly shipped ghost tables and UIs stuck on "Joining…".

## Room Types

### Relay Room
Pure message broker - clients send typed messages, all others receive. No server state.
**Good for:** chat, notifications, signaling, real-time feeds, simple multiplayer.

### State Room
Server-authoritative shared state. Auto-tracks players in a synced map. Generic key-value `data` map (values are JSON strings) auto-synced to all clients.
**Good for:** games, collaborative editors, dashboards, turn-based games, anything needing shared truth.

## The realtime kit (start here)

For anything beyond a toy, do not hand-roll the Colyseus client - run `gipity add realtime` and build on the `@gipity/realtime` kit. It wraps everything in this doc (onStateChange diffing, tokens, reconnection, lobby + match rooms) behind a tested, engine-agnostic API. The raw Colyseus patterns - connecting by hand, room discovery over REST, relay/state message shapes, and the state-room boilerplate - are the fallback and a reference for what the kit does internally: read [app-realtime-reference](https://docs.gipity.ai/skills/app-realtime-reference.html).

**Channels** - one room, namespaced sub-streams. `rt.channel(name, { sync })` where `sync` is:
- `messages` - pub/sub relay.
- `presence` - ephemeral per-peer state (cursors, positions) at ~20 Hz.
- `entities` - per-record CRUD; `authority: 'shared'` (last-write-wins) or `'host'` (elected writer + physics delta-sync).
- `store` - synchronous whole-object key-value (`get` / `set` / `update` / `onChange`) - the shape a turn-based game or match state wants. `authority: 'host'` optional.

**Party (lobby games, invite links, room codes) - use this, don't hand-roll.** `createParty(rt)` owns the whole host/join flow: share codes, invite URLs, the live table list, quick-match, cancelable hosting, and typed join failures:

```js
import { createRealtime, createParty } from '@gipity/realtime';
const rt = createRealtime();
const party = createParty(rt, { seats: 2 });   // uses rooms 'lobby' + 'match'

// Host: share the invite link or code; cancel() if the host backs out
const table = await party.host({ host: name });
showShareUi(table.inviteUrl, table.code);      // e.g. a copy-link button
table.onFull(() => startGame(table));          // opponent arrived
backBtn.onclick = () => table.cancel();        // delists everywhere, no ghosts

// Guest: an invite link joins on page load (resolves null when no ?join=)
const joined = await party.joinFromUrl();
// ...or: await party.joinByCode(code) / party.onTables(render) + party.join(entry)
//        / party.quickMatch({ host: name })
```

Every failed join **throws a `RealtimeJoinError`** with `err.code` `'not-found'` | `'full'` | `'gone'` | `'auth'` | `'offline'` | `'failed'` - catch it and show the right message ("game is full", "invite expired") instead of a stuck "Joining…". Game state goes in a `store` channel on `table.channel('state', { sync: 'store' })`; `table.onPeerLeave` fires only on PERMANENT departure (the server holds a dropped seat 30 s), so it is safe as a forfeit signal. Worked file: `examples/party-game.js` in the kit.

**Multi-room primitives** (what party is built on) - one client, many rooms:

```js
import { createRealtime, createDirectory } from '@gipity/realtime';
const rt = createRealtime();
const lobby = await rt.join('lobby');             // joinOrCreate a shared room
const match = await rt.create('match');           // a fresh match instance
const other = await rt.joinById(roomId, 'match'); // join an advertised one
const only  = await rt.joinExisting('match', { scope: code }); // join, NEVER create
```

All four throw `RealtimeJoinError` on failure. `createDirectory(lobby)` turns the lobby into a heartbeat'd listing of open rooms.

**Scope - many spaces from one provisioned room.** `scope` is an opaque partition key: same `(room, scope)` → same instance, different scope → separate instance of the same provisioned room. Key it off a URL param so one app link serves many independent teams/sessions. **Never derive the room NAME from a URL** - unprovisioned room names are rejected by the server; derive the scope.

**Reading state right after a join** - `rt.joinById(...)` resolves on **join**, before the room's state has synced. `channel.get(key)` will return `undefined` until the first sync lands. If you need to read state immediately on join (e.g. a lobby joiner inspecting the host's match state), `await new Promise((r) => channel.onReady(r))` first. Otherwise rely on `channel.onChange` to drive your UI.

**Reconnection is automatic** - an unclean drop is recovered via the Colyseus reconnection token with the session id preserved (channels and seats survive a blip). Observe it with `rt.on('reconnecting')` / `'reconnected'` / `'lost'`.

Worked references ship inside the kit: `examples/` has one file per shape (chat, whiteboard, kanban, city-builder, agent-ops, desktop, lobby, connect-four) plus `README.md`. Room names still need provisioning - see below.

### Presence done well

A who's-here / presence list has three quality gaps that are easy to miss while building and obvious in use. Make these the default for any presence app:

1. **Persist identity across reloads.** Generate a stable peer id once and store it (plus the chosen name) in `localStorage`; pre-fill the name input on load so a returning teammate isn't re-prompted on every refresh.
2. **Scope the space from the URL - via `scope`, never the room name.** Read a `?team=` (or similar) param into the `scope` option so two different teams sharing the same app link land in separate presence lists instead of one global room. The room *name* stays the provisioned one - a URL-derived room name is rejected by the server as unprovisioned.
3. **Render a stable identity per peer.** Show an initials avatar plus the stable peer id, not the display name alone - otherwise two people both named "Sam" are indistinguishable.

```js
import { createRealtime } from '@gipity/realtime';

// 1. Stable identity that survives a reload - generate a peer id once, persist the
//    chosen name, and pre-fill the input so a returning teammate isn't re-prompted.
const peerId = localStorage.getItem('peerId')
  || ('peer-' + Math.random().toString(36).slice(2, 10));
localStorage.setItem('peerId', peerId);
nameInput.value = localStorage.getItem('name') || '';   // pre-fill, don't re-ask

// 2. Scope the SPACE from the URL so different teams sharing one app link get
//    separate presence lists. The room name stays the provisioned one; the
//    scope partitions it into one instance per team.
const scope = new URLSearchParams(location.search).get('team') // ?team=engineering
  || 'general';                                                // sensible default

const rt = createRealtime({ room: 'standup', scope });  // synchronous - connect() below
const here = rt.channel('presence', { sync: 'presence' });

function announce(name) {
  localStorage.setItem('name', name);                   // remember for next visit
  here.setLocal({ peerId, name });                      // announce a stable identity
}                                                       // (rebroadcast ~20 Hz until changed)

// 3. Render a stable identity per peer so two people both named "Sam" stay distinct:
//    an initials avatar plus the stable peer id, not the display name alone.
//    onChange fires PER PEER as (sid, peer) - don't expect the whole roster as its
//    argument. Rebuild the roster from peers(), a Map of sid → peer holding every
//    REMOTE peer; your own state is here.local(), not in the Map.
function renderAll() {
  const everyone = [here.local(), ...here.peers().values()].filter(Boolean);
  renderRoster(everyone.map(p => ({
    initials: (p.name || '?').trim().slice(0, 2).toUpperCase(),
    name: p.name,
    id: p.peerId,                                       // disambiguates duplicate names
  })));
}
here.onChange(renderAll);                               // (sid, peer) per update
here.onLeave(renderAll);

await rt.connect();
```

The presence channel's surface is exactly: `setLocal(obj)`, `local()`, `peers()` (a Map), `onChange(cb)` / `onJoin(cb)` / `onLeave(cb)` (all fire per peer as `cb(sid, peer)`; `onLeave` gets just `sid`), and `metrics()`. There is **no `set()`**, and no callback ever receives the whole roster - always rebuild from `peers()`.

Plain `setLocal(obj)` needs **no adapter** - payloads are merged into peer records with an `Object.assign`. A custom presence adapter (`{ encode, apply, newPeer }`, e.g. for quantized positions) is only for controlling the wire format - its contract is documented in the kit's README ("The presence adapter contract") and `contracts/adapter.contract.md`; don't reverse-engineer it from `lib/presence.js`.

## Provisioning a room

A room must exist before an app can connect - the server rejects unprovisioned room names. `gipity add realtime` already provisions three `state`/`public` rooms: one named after the project, plus `lobby` and `match` (what `createParty` uses), so kit apps usually need no extra step. Many *instances* of one provisioned room come free via `scope` - never provision per team/session/code. For additional names there are **three equivalent ways** - all create the same room record, so pick whichever fits the workflow:

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


## Human/AI parity

When an app fields **both bot and human players**, anything a bot can do on its turn must also be reachable by a human through the UI - bots and humans get an equivalent set of actions, never a strict subset. If a bot can buy, build, mortgage, sell, bid, or trade, the human needs an affordance for each. Trading is the one most often dropped, so wire it up too.

## Auth
- **public**: Pass app token in join options - no login needed
- **user**: Requires Gipity session cookie (Sign in with Gipity)

## Verifying presence/shared state across clients

Presence and shared state only mean anything when two clients are **live at the same time**. Two important traps:

- `gipity page test` *without* `--observe` does passive page loads only - it never submits a name, clicks, or reads shared state, so it can't tell you whether clients see each other.
- Two separate `gipity page eval` calls run **sequentially** - each finishes before the next starts, so the clients never coexist and each sees only itself. That looks identical to a broken presence kit, but it's a false negative from the harness, not a bug in your app. Don't go debugging the transport over it.

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

For asymmetric roles (one host, others join), don't run two separate calls - they execute sequentially, so the host client is gone (or its room is stale) by the time the joiners load, and you get a false negative. Co-launch the roles in **one** interactive invocation instead: with `--observe`, `{{label}}` / `{{i}}` substitute into the URL too, and the overlap check confirms the roles actually coexisted:

```
gipity page test ".../app/?test-name={{label}}&test-action={{label}}" --clients 2 --labels host,join   --observe "document.querySelector('[data-screen]')?.dataset.screen"
```

Client 0 loads `?test-action=host` and client 1 `?test-action=join`, genuinely concurrently - no backgrounding + `sleep` dance, no stale lingering room to land in.

No Puppeteer, no Chromium libs, no DOM driving - a passive `page test` (no `--observe`) just loads the URL, so the URL-param test mode is what makes the load alone exercise the join path. (When you'd rather drive the form than add a test mode, the interactive `page test --observe` above does the DOM driving for you.) Implement it once per multiplayer app and every realtime change is a 30-second smoke test from there on. Pair it with the `data-testid` / `data-screen` / `data-ready` conventions from `web-app-basics` for any leftover click-driven tests.

## Tips
- The `@gipity/realtime` kit (`gipity add realtime`) covers party flows (invite links / codes / browse / quick-match), lobby + match rooms, a `store` channel for whole-object state, presence, scope partitioning, host election, and automatic reconnection - prefer it over hand-rolling any of the above
- A multiplayer game needs a visible share affordance: show the invite link / code with a copy button on the "waiting for opponent" screen (that is when it's needed), not after the game starts
- Split state into many small keys, not one big JSON blob (each key change re-syncs the entire value)
- Room config changes apply to new instances only - existing connections are unaffected
- Room instances have a max client limit (see `realtime_room info` for current limits); the server auto-creates new instances when rooms fill up
- Use relay rooms for simple message passing; use state rooms when you need server-authoritative truth
- When editing connection code, read the entire connection function before making changes - partial edits that fix one issue while missing a related one waste a full deploy cycle

## Related
- [app-realtime-reference](https://docs.gipity.ai/skills/app-realtime-reference.html) - the raw Colyseus client: connecting without the kit, room discovery over REST, relay + state room message patterns, turn-based games, and the safe state-room initialization boilerplate
- [realtime-scheduled-app](https://docs.gipity.ai/skills/realtime-scheduled-app.html) - end-to-end recipe combining presence + messages with a database and a scheduled poster
