#!/bin/sh
# Gipity plugin hook launcher.
#
# Claude Code runs each hook `command` string through a NON-INTERACTIVE shell
# (`/bin/sh -c ...` on macOS/Linux). Users whose `node` comes from a version
# manager (nvm, fnm, asdf, volta, n) don't get their shell init in that
# environment, so a bare `node` is not on PATH: every hook died with
# `node: command not found` and all file sync + session capture silently
# stopped. This launcher fixes that. It:
#
#   1. No-ops instantly (exit 0) outside a Gipity context, WITHOUT needing node
#      - so an absent/version-managed node never surfaces an error on an
#      unrelated project. (The old guard lived inside the .cjs, which can only
#      run once node has already been found - too late.)
#   2. Resolves a usable `node` across the common version managers.
#   3. Exits 0 (never blocks the session) when no node can be found; sync/capture
#      simply pause and `gipity sync` remains the manual catch-up.
#
# Usage:  launch.sh <script.cjs> [args...]     (stdin is forwarded to node)
set -u

script="${1:-}"
[ -n "$script" ] && shift

# ── 1. Gipity-context guard (no node required) ─────────────────────────────
# Proceed only when this could be a Gipity session: a .gipity.json in the cwd
# or any ancestor (a session may launch in a project subdirectory), OR an
# active `gipity claude` binding via GIPITY_CONVERSATION_GUID. This is a safe
# superset of every hook script's own guard, so short-circuiting here only
# skips work the script would itself no-op on.
in_gipity_context() {
  [ -n "${GIPITY_CONVERSATION_GUID:-}" ] && return 0
  dir=$(pwd)
  while :; do
    [ -f "$dir/.gipity.json" ] && return 0
    parent=$(dirname "$dir")
    [ "$parent" = "$dir" ] && return 1
    dir="$parent"
  done
}
in_gipity_context || exit 0

# ── 2. Resolve a node binary ───────────────────────────────────────────────
# Our hook scripts are plain CommonJS, so ANY recent node runs them - we only
# need *a* working node, not necessarily the project's selected version.
find_node() {
  # Already on PATH (system install, or a shell that exported one).
  if command -v node >/dev/null 2>&1; then command -v node; return 0; fi
  # Explicit override (escape hatch / `gipity doctor` can point at one).
  if [ -n "${GIPITY_NODE:-}" ] && [ -x "${GIPITY_NODE}" ]; then
    printf '%s\n' "$GIPITY_NODE"; return 0
  fi

  # Version managers that keep a STABLE default shim - cheap and deterministic.
  for c in \
    "${VOLTA_HOME:-$HOME/.volta}/bin/node" \
    "$HOME/.asdf/shims/node" \
    "${ASDF_DATA_DIR:-$HOME/.asdf}/shims/node" \
    "${FNM_DIR:-$HOME/.fnm}/aliases/default/bin/node" \
    "$HOME/.local/share/fnm/aliases/default/bin/node"
  do
    [ -x "$c" ] && { printf '%s\n' "$c"; return 0; }
  done

  # nvm keeps no stable shim: prefer the `default` alias, else newest install.
  nvm_dir="${NVM_DIR:-$HOME/.nvm}"
  if [ -d "$nvm_dir/versions/node" ]; then
    if [ -f "$nvm_dir/alias/default" ]; then
      v=$(cat "$nvm_dir/alias/default" 2>/dev/null)
      for cand in \
        "$nvm_dir/versions/node/$v/bin/node" \
        "$nvm_dir/versions/node/v$v/bin/node"
      do
        [ -x "$cand" ] && { printf '%s\n' "$cand"; return 0; }
      done
    fi
    # Use modification time instead of GNU-only `sort -V`, which macOS lacks.
    newest_dir=$(ls -1dt "$nvm_dir"/versions/node/* 2>/dev/null | head -n 1)
    [ -n "$newest_dir" ] && [ -x "$newest_dir/bin/node" ] && {
      printf '%s\n' "$newest_dir/bin/node"; return 0; }
  fi

  # Common absolute fallbacks (Homebrew, n, system).
  for c in \
    /opt/homebrew/bin/node \
    /usr/local/bin/node \
    /usr/bin/node \
    "${N_PREFIX:-/usr/local}/bin/node"
  do
    [ -x "$c" ] && { printf '%s\n' "$c"; return 0; }
  done
  return 1
}

node_bin=$(find_node) || exit 0   # no node anywhere - degrade silently

exec "$node_bin" "$script" "$@"
