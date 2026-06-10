#!/usr/bin/env bash
# fresh-user-test.sh - clean-room test of the Gipity plugin onboarding.
#
# Spins up a throwaway Docker container that looks like a brand-new user's
# machine: Node + Claude Code and nothing else. No gipity CLI, no ~/.gipity,
# no ~/.claude hooks, no plugin state, no platform CLAUDE.md. Everything is
# discarded when you exit.
#
# This repo is mounted read-only at /gipity-plugin so the marketplace add
# works even while the GitHub repo is private. Once the repo is public, test
# the real path instead: /plugin marketplace add GipityAI/claude-plugin
#
# Claude auth inside the container: either log in interactively when claude
# starts, or run `claude setup-token` on the host first and
# `export CLAUDE_CODE_OAUTH_TOKEN=<token>` before running this script.
set -euo pipefail
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

exec docker run -it --rm \
  ${CLAUDE_CODE_OAUTH_TOKEN:+-e CLAUDE_CODE_OAUTH_TOKEN} \
  -v "$REPO_DIR:/gipity-plugin:ro" \
  node:22-bookworm bash -c '
set -e
echo "[fresh-user] installing Claude Code (~30s)..."
npm install -g @anthropic-ai/claude-code --silent
mkdir -p /home/fresh/my-app
cat <<"EOF"

------------------------------------------------------------------
Fresh machine ready: no gipity CLI, no hooks, no plugin, no auth.

  1. claude                                  (log in if prompted)
  2. /plugin marketplace add /gipity-plugin
  3. /plugin install gipity@gipity
  4. exit claude, run claude again, then ask:
       "put a landing page for my dog-walking business online"

Watch for: the gipity skill firing, npm i -g gipity, the email
code login, gipity init, template add, deploy, and a live dev URL.
------------------------------------------------------------------
EOF
cd /home/fresh/my-app && exec bash'
