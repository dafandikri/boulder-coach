#!/usr/bin/env bash
# Launch an Aider worker. args: $1=worktree path  $2=pbi id  $3=charge file
# --yes-always auto-confirms every prompt so the run is non-interactive.
set -euo pipefail
charge="$(sed "s/{{PBI_ID}}/$2/g" "$3")"
cd "$1"
exec aider --yes-always --message "$charge"
