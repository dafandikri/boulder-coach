#!/usr/bin/env bash
# Launch a Claude Code worker. args: $1=worktree path  $2=pbi id  $3=charge file
#
# acceptEdits (NOT bypassPermissions): the worker auto-applies file edits, and the
# specific Bash commands it needs (pnpm gate/test/install, git add/commit) are
# allowlisted in .claude/settings.json `permissions.allow`. Everything else fails
# closed — a blanket bypass would give an autonomous agent full host Bash (network,
# credentials, rm), and a git worktree is NOT a security boundary (same user/FS/creds).
# For untrusted PBIs or shared machines, run the conductor inside a container/VM.
#
# --disallowed-tools hard-blocks push/PR for THIS worker session only (it wins over
# the shared `allow`). The human/supervised session may push; autonomous workers
# never can — they commit locally and the conductor merges to local main.
#
# The charge (worker prompt) is piped on STDIN, NOT passed as a positional arg:
# --disallowed-tools is variadic (`<tools...>`), so a trailing positional prompt
# gets greedily parsed as more tool names (the prompt's words become bogus deny
# rules and the worker receives an empty charge). `claude --print` reads the
# prompt from stdin when no positional is given, which keeps the two unambiguous.
set -euo pipefail
charge="$(sed "s/{{PBI_ID}}/$2/g" "$3")"
cd "$1"
exec claude --permission-mode acceptEdits --print \
  --disallowed-tools "Bash(git push:*)" "Bash(git push)" "Bash(gh pr create:*)" "Bash(gh pr merge:*)" \
  <<<"$charge"
