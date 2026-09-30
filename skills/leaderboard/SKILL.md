---
name: leaderboard
description: "Use when the user wants leaderboards, high scores, best times, speedrun rankings, personal bests, daily/weekly/monthly or seasonal rankings, friends rankings, or downloadable replays for a game - web or native (Godot/Steam) - with basic server-side cheat checks and moderation."
---

<!-- GENERATED from platform/docs/skills/leaderboard.md by platform/scripts/sync-claude-plugin.ts - do not edit here. -->

> **Gipity required.** This skill needs the `gipity` CLI linked to a project. If `gipity status` errors or shows no project, run the setup flow in the `gipity` skill first (in Claude Code or Grok: `/gipity:setup`; in Codex or any other agent, follow the `gipity` skill's setup steps directly).
>
> This doc is shared across Gipity surfaces; where it names an agent tool, use the CLI equivalent: `add` → `gipity add <name>`, `file_write`/`file_read`/`file_delete` → edit files in the project directory directly (they auto-sync), `project_deploy` → `gipity deploy dev`, `code_execute` → `gipity sandbox run`. The live version of this doc: `gipity skill read leaderboard`.

# Leaderboard kit

`gipity add leaderboard` adds leaderboards to any game with a database (`web-fullstack` or `api`): four functions, six tables, and a small browser helper. It fits high scores, best times, speedruns, puzzle solves and racing alike. Native games call the same functions over HTTPS (the Gipity Godot addon at https://github.com/GipityAI/registry/tree/main/examples/godot wraps them; see [steam-game](https://docs.gipity.ai/skills/steam-game.html)).

## 1. Declare the boards

Boards live in an app migration, so they ship with the code. Each board's columns are its server-side checks:

```sql
-- migrations/001-boards.sql
INSERT INTO lb_boards (board, sort, tiebreak_sort, periods, min_score, max_score) VALUES
  ('arcade:score',   'desc', NULL,  ARRAY['all', 'day', 'week'], 0, 5000000),
  ('puzzle:classic', 'desc', 'asc', ARRAY['all', 'season'],      0, 10000)
ON CONFLICT (board) DO UPDATE SET sort = EXCLUDED.sort, tiebreak_sort = EXCLUDED.tiebreak_sort,
  periods = EXCLUDED.periods, min_score = EXCLUDED.min_score, max_score = EXCLUDED.max_score;
```

- `sort`: `desc` (higher wins: points) or `asc` (lower wins: times).
- `tiebreak_sort`: optional. A second number orders equal scores, e.g. "most points, then fastest" is `desc` + tiebreak `asc`. On such boards every submission must send `tiebreak`. Without one, equal scores share a rank and the earlier run lists first.
- `periods`: which rankings the board keeps, any of `all`, `day`, `week`, `month`, `season`. Default `all` + `week`. Day, week (ISO) and month are UTC.
- `min_score` / `max_score`: reject anything outside. For times, set `min_score` just under the fastest possible run.
- `splits`: optional checkpoint count (racing, speedruns). Each submission sends cumulative checkpoint times that increase and end at the score.
- `rulesets`: optional official ruleset hashes (a hash of difficulty or tuning settings). Only these rank; `NULL` accepts any, and each ranks separately.
- `max_ghost_bytes` (default 65536) and `submit_per_hour` (per player, per board; default 60).
- `min_game_version`: optional oldest game build whose runs count, e.g. `'1.4.2'`. Runs must send `gameVersion`; a missing or older one is refused with `code: 'GAME_VERSION_TOO_OLD'` (show "update your game"), and one that isn't a version like `1.4.2` with `GAME_VERSION_INVALID`. Versions compare as semver: `1.10` beats `1.9`, missing parts are 0, a prerelease (`1.4.2-beta`) is older than its release. Raise it in a new migration when a release changes scoring.

**Seasons.** A board with `season` in `periods` ranks within the running season: the latest `lb_seasons` row whose window contains now. Declare them in a migration:

```sql
INSERT INTO lb_seasons (name, starts_at, ends_at) VALUES ('Season 1', '2026-10-01', '2027-01-01') ON CONFLICT (name) DO NOTHING;
```

Name boards `<mode>:<kind>` (e.g. `arcade:score`, `level-3:time`, `oval-1:lap`). Separate variants (a car, a character, a difficulty) are separate boards, or send the variant in `meta`.

## 2. Submit and read

Submitting needs a signed-in player: Sign in with Gipity on the web, or a Steam or guest player in a native game. Reading is public.

```js
import { submitScore, top, aroundMe, myEntry, friends, ghost, seasons } from '@gipity/leaderboard';

const r = await submitScore('puzzle:classic', 9200, { tiebreak: 61400 });
// { accepted: true, improved: { all: true, season: true }, period: 'all', personalBest, rank, entryId }
// or { accepted: false, reason, code? }  - a rejection is a normal result, not an error;
// version refusals carry code GAME_VERSION_TOO_OLD | GAME_VERSION_INVALID

await top('arcade:score', { period: 'day', limit: 10, offset: 0 });   // { entries, total, period }
await aroundMe('arcade:score', { radius: 3 });                        // { entry, entries }
await friends('arcade:score', steamFriendIds);                        // Steam ids, you included
await top('puzzle:classic', { period: 'season' });                   // or 'season:Season 1'
await ghost(entryId);                                                  // { ghost: base64 }
await seasons();                                                       // { current, seasons }
```

Over HTTPS: `POST /api/<appGuid>/fn/leaderboard-submit` with the same body, and `POST /api/<appGuid>/fn/leaderboard-read` with `{ action: 'top' | 'around' | 'me' | 'friends' | 'ghost' | 'boards' | 'seasons', ... }`.

- **Periods:** a kind for the current window (`all`, `day`, `week`, `month`, `season`) or a key for a past one (`2026-09-28`, `2026-W39`, `2026-09`, `season:Season 1`). The default is all-time when the board keeps it, else its first period. A period the board doesn't keep comes back as `{ error }`.
- **Submit results:** `improved` has one flag per period the board keeps; `rank` and `personalBest` are for the main period (all-time, or the board's first period). Every accepted run updates every period's personal best it beats.
- **Entries:** `{ rank, entryId, userGuid, playerRef, displayName, score, tiebreak, splits, meta, gameVersion, hasGhost, updatedAt }`. `playerRef` is `steam:<SteamID64>` for Steam players. `displayName` is the name the player had when they set that personal best; a renamed player's entries update with their next improving run.
- **Replays ("ghosts")** are opaque bytes (base64 over the wire) kept with each personal best, up to `max_ghost_bytes`: a racing line, an input log, a puzzle solution. Record positions, not inputs, if the physics isn't deterministic across machines.
- Bad input (an unknown board or period) comes back as `{ error }` in the result.

**Racing boards** add splits, a ruleset and a ghost: `('oval-1:lap', 'asc', 12000, 90000, 3, ARRAY['a1f09c'])` for `(board, sort, min_score, max_score, splits, rulesets)`, then `submitScore('oval-1:lap', 31250, { ruleset: 'a1f09c', splits: [10400, 21010, 31250], ghost })`.

## 3. Moderate

`leaderboard-admin` is `auth: member` (the owner and project members only):

```bash
gipity fn call leaderboard-admin '{"action":"submissions","board":"arcade:score","rejectedOnly":true}'
gipity fn call leaderboard-admin '{"action":"ban","userGuid":"u_...","reason":"impossible score"}'
gipity fn call leaderboard-admin '{"action":"remove","entryId":"lbe_..."}'
gipity fn call leaderboard-admin '{"action":"reset","board":"arcade:score","period":"day"}'
```

Also `unban` and `bans`. A ban deletes the player's entries and hides them from every view.

**Deleted players are erased automatically.** The kit's `leaderboard-player-deleted` function is declared with `hooks: [user_deleted]`, so when an app player deletes their account (`DELETE /api/<appGuid>/auth/player`) the platform runs it first: it deletes their entries (which carry their display name), their submission log, any ban, and the ghosts only they used. If it fails, the player is not deleted and the call returns 502 `PLAYER_CLEANUP_FAILED`, so the game can retry; see why with `gipity logs fn leaderboard-player-deleted`. Nobody else can call it (it's `auth: member` and refuses calls the platform didn't trigger). To erase someone by hand (e.g. a Gipity-account user who asked), use `gipity fn call leaderboard-admin '{"action":"purge","userGuid":"u_..."}'`.

## Limits of the checks

These are plausibility checks. A careful cheater can submit a believable fake, so review the rejected-submissions log and ban. Replay bytes aren't inspected. Real cheat resistance needs the game to run on a server, which this kit doesn't do.

## Common mistakes

- **Submitting before the board exists.** Declare it in a migration and deploy first; unknown boards return `{ error: "No board ..." }`.
- **Forgetting `tiebreak`** on a board with `tiebreak_sort`, or sending one to a board without it. Both are rejected with a reason.
- **Asking for a period the board doesn't keep** (`day` on an `all` + `week` board). Add it to `periods` in the migration.
- **Treating `accepted: false` as a failure.** It's the check working. Show `reason` in development.
- **A float score.** Scores and tiebreaks are integers (points, milliseconds).
- **Setting `min_game_version` without sending `gameVersion`.** Every run is then refused as too old. Send the build's version on every submit.
