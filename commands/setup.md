---
description: Install the Gipity CLI, log in, and link this directory to a Gipity cloud project
---

Set up Gipity in the current directory, completing only the stages that aren't already done. Check state first with `gipity status` (or `gipity: command not found`) - never redo a completed stage.

1. **Install the CLI** if `gipity` isn't on PATH: `npm install -g gipity`. Requires Node 18+; if Node is missing, help the user install it for their OS first. The CLI auto-updates after this one-time install.

2. **Log in** if `gipity status` says unauthenticated. Ask the user for their email address if you don't know it, then:
   - `gipity login --email <email>` - emails them a 6-digit code (new users are signed up automatically)
   - Ask them for the code from their inbox, then `gipity login --code <code>`

3. **Link a project** if the current directory has no `.gipity.json`. Confirm with the user that this directory is where their app should live (it should be the app's own folder or an empty one - not an unrelated repo). Then run `gipity init` (slug defaults to the directory name; pass a name to override). This writes integration-guide primer files for your coding agent (`CLAUDE.md`, `AGENTS.md`, …) and hooks that auto-sync file writes to the cloud.

4. **Confirm and orient.** Run `gipity status` to show the linked project, then tell the user what they can do next:
   - Start an app: `gipity add web-simple` (static), `web-fullstack` (frontend + API + database), `api`, `2d-game`, or `3d-world`
   - Deploy: `gipity deploy dev` → live at `https://dev.gipity.ai/<account>/<project>/`
   - Explore the platform: `gipity skill list`

If anything fails, show the user the exact error output and the command that produced it.
