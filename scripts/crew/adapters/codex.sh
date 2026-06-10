#!/usr/bin/env bash
# Launch a Codex worker. args: $1=worktree path  $2=pbi id  $3=charge file
set -euo pipefail
charge="$(sed "s/{{PBI_ID}}/$2/g" "$3")"
cd "$1"
exec codex exec "$charge"
