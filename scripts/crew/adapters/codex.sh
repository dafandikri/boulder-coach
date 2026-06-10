#!/usr/bin/env bash
# Launch a Codex worker. args: $1=worktree path  $2=pbi id  $3=charge file
# --full-auto runs non-interactively with workspace-write access so the worker can
# edit files and run the gate without prompts (the worktree is its sandbox).
set -euo pipefail
charge="$(sed "s/{{PBI_ID}}/$2/g" "$3")"
cd "$1"
exec codex exec --full-auto "$charge"
