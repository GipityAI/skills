---
name: steam-game
description: "Use when the user wants to put a native game online - a Godot game, a Steam game, a desktop or Steam Deck build - with Steam sign-in, leaderboards, ghosts or replays, saved progress, race results, or server-side game logic, without running their own server."
---

<!-- GENERATED from platform/docs/skills/steam-game.md by platform/scripts/sync-claude-plugin.ts - do not edit here. -->

> **Gipity required.** This skill needs the `gipity` CLI linked to a project. If `gipity status` errors or shows no project, run the setup flow in the `gipity` skill first (in Claude Code or Grok: `/gipity:setup`; in Codex or any other agent, follow the `gipity` skill's setup steps directly).
>
> This doc is shared across Gipity surfaces; where it names an agent tool, use the CLI equivalent: `add` → `gipity add <name>`, `file_write`/`file_read`/`file_delete` → edit files in the project directory directly (they auto-sync), `project_deploy` → `gipity deploy dev`, `code_execute` → `gipity sandbox run`. The live version of this doc: `gipity skill read steam-game`.

# Steam and Godot games - online backend

A native game (Godot 4, exported for Windows, Linux or Steam Deck) uses Gipity as its backend: player accounts, server functions, a database, and leaderboards with ghost recordings. The game talks to it over HTTPS with the **Gipity Godot addon**. There is no server to run.

**Who does what:**

| Need | Use |
|---|---|
| Player sign-in (Steam, guest) | Gipity app players (this skill) |
| Leaderboards (scores or times, daily/weekly/season), personal bests, replays | The `leaderboard` kit (see the [leaderboard](https://docs.gipity.ai/skills/leaderboard.html) skill) |
| Saved progress, race results, ratings, game rules on the server | Your own functions + database ([app-development](https://docs.gipity.ai/skills/app-development.html)) |
| Live race traffic (car positions, 30 Hz) | Steam Networking Sockets through GodotSteam: Steam's relay network, free, global, NAT-free |
| Lobbies, invites, matchmaking between Steam players | Steam lobbies (GodotSteam) |

Don't route per-tick game state through Gipity: functions are request/response, not a game relay. Report outcomes (race results, lap times) to Gipity when they happen.

## Set up the backend

Keep the backend in a `backend/` folder of the game repo, with a `.gdignore` file in it so Godot doesn't import it:

```bash
mkdir backend && touch backend/.gdignore && cd backend
gipity init my-game            # link this folder to a new Gipity project
gipity add api                 # functions + database (no web frontend)
gipity add leaderboard         # optional: leaderboards with replays
gipity project auth app        # players sign in to THIS game, no Gipity account needed
gipity deploy dev
```

`gipity project auth` modes: `gipity` (default: Sign in with Gipity only), `app` (Steam and guest players only), `both`. App sign-in is refused until the mode is `app` or `both`.

### Steam sign-in keys

Steam sign-in verifies each player's session ticket with Valve using the game's **Steamworks publisher Web API key**. The developer creates it in Steamworks: Users & Permissions > Manage Groups > (a group with the app) > Create WebAPI Key. Store it and the AppID as project secrets:

```bash
gipity secrets set STEAM_WEB_API_KEY <publisher key>
gipity secrets set STEAM_APP_ID <appid>
```

Only the developer can get these; ask them. Without them, Steam sign-in returns a setup error, and guest sign-in still works. Valve's test AppID 480 (Spacewar) has no publisher key you can use, so Steam sign-in needs the game's real AppID.

## Add the addon to the game

1. Copy `addons/gipity/` from https://github.com/GipityAI/gipity-godot into the Godot project and enable **Gipity** under Project Settings > Plugins. That adds the `Gipity` autoload.
2. Set **Project Settings > gipity/app_guid** to the project guid (`gipity project info`).
3. For Steam: install GodotSteam, call `Steam.steamInitEx()` at startup, and `Steam.run_callbacks()` every frame.

```gdscript
func _ready():
	var r = await Gipity.sign_in_steam()
	if not r.ok:
		r = await Gipity.sign_in_guest("Player")   # non-Steam build, or Steam unavailable
	if r.ok:
		print("Signed in as ", Gipity.player.displayName)

func save_result(result: Dictionary):
	var r = await Gipity.call_function("race-result", result)   # r.data = the function's return value
```

Every call returns `{ ok, data, error, status, offline }` and never throws. `offline` means the server couldn't be reached: the game must keep working without online features. Leaderboard submissions made offline are queued and sent after the next sign-in. The addon renews expired player tokens by signing in again.

Other calls: `link_steam()` (attach Steam to the current guest, keeping their progress), `sign_out()`, `delete_player()` (account deletion requests), and the `Gipity.leaderboard` client (`submit`, `top`, `around_me`, `me`, `friends`, `friends_steam`, `ghost`, `boards`, `seasons`).

## Players in your functions

A signed-in player is an ordinary signed-in user to your functions: `auth: user` functions accept them, and `ctx.auth.userGuid` / `ctx.auth.displayName` are set (the Steam persona name). Key per-player rows on `ctx.auth.userGuid`, as in any app.

`ctx.auth.identity` says how they signed in: `{ provider: 'steam', id: '<SteamID64>' }` or `{ provider: 'guest', id: '<hash>' }`, and `null` for Gipity users. Use the Steam id to match Steam friends to players.

A player belongs to one game. The same Steam account is a different player in each of your games, and a player token only works on its own game's API.

```js
// functions/race-result.js  (gipity.yaml: auth: user, tables: [race_results])
export default async function raceResult(ctx, { db, guid }) {
  const { track, position, timeMs } = ctx.body;
  await db.insert('race_results', {
    id: guid('rr'), user_guid: ctx.auth.userGuid, steam_id: ctx.auth.identity?.id ?? null,
    track, position, time_ms: timeMs,
  });
  return { saved: true };
}
```

The server can't see the game, so treat everything a client sends as a claim: check it for plausibility (bounds, consistency, rate) and keep a way to ban. The leaderboard kit does this for scores.

## Calling the API without the addon

Any client can use plain HTTPS against `https://a.gipity.ai/api/<appGuid>`:

| Call | Body | Returns |
|---|---|---|
| `POST /auth/steam` | `{ ticket }`: the bytes from `GetAuthTicketForWebApi("gipity")`, hex-encoded. Add `"link": true` with a guest's Bearer token to link. | `{ data: { token, expiresIn, user } }` |
| `POST /auth/guest` | `{ deviceSecret, displayName? }`: 32-256 random characters the client generates once and keeps | same |
| `GET /auth/player` | Bearer token | `{ data: { guid, displayName, provider, providerUserId } }` |
| `DELETE /auth/player` | Bearer token | deletes the player |
| `POST /fn/<name>` | Bearer token, JSON body | `{ data: <function return> }` |

The ticket identity must be exactly `gipity`. Player tokens last 24 hours; there is no refresh token, so sign in again (a fresh Steam ticket, or the same device secret) when one expires or a call returns 401.

## Common mistakes

- **Sending live positions through functions.** Use Steam Networking Sockets for the race itself. Functions are for outcomes.
- **Forgetting `gipity project auth app`.** Sign-in returns 403 until the mode allows app players.
- **A ticket for the wrong identity.** Request it with `Steam.getAuthTicketForWebApi("gipity")`, not the no-argument session ticket.
- **Not calling `Steam.run_callbacks()`.** The ticket never arrives, and sign-in times out after 10 seconds.
- **Requiring the network to start the game.** Sign in in the background and let every online feature fail soft.
