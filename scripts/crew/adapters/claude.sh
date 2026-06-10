#!/usr/bin/env bash
# Launch a Claude Code worker. args: $1=worktree path  $2=pbi id  $3=charge file
#
# bypassPermissions (not acceptEdits) so the worker can run Bash — `pnpm gate`,
# tests, local commits — WITHOUT a prompt; a worker that stalls on a permission
# prompt never finishes and gets reclaimed when its lease expires. Safe because
# each worker is isolated in its own git worktree and the gate is still the merge
# contract. `deny` rules in .claude/settings.json (e.g. `git push`) STILL apply in
# bypass mode, so workers remain unable to push.
set -euo pipefail
charge="$(sed "s/{{PBI_ID}}/$2/g" "$3")"
cd "$1"
exec claude --permission-mode bypassPermissions --print "$charge"
