#!/usr/bin/env bash
# Stop hook: if any ÆTHER repo has uncommitted or unpushed work, ask Claude
# (once per turn) to push it or tell the user why not. Never pushes by itself.
input=$(cat)
echo "$input" | grep -q '"stop_hook_active": *true' && exit 0
self_root=$(cd "$(dirname "$0")/.." && pwd)
parent=$(dirname "$self_root")
msgs=""
for d in "$parent"/*/; do
  d=${d%/}
  [ -d "$d/.git" ] || continue
  case "$d" in *BACKUP*|*backup*) continue ;; esac  # never touch backup copies
  case "$(git -C "$d" remote get-url origin 2>/dev/null)" in *strangmatt/AETHER*) ;; *) continue ;; esac
  name=$(basename "$d")
  [ -n "$(git -C "$d" status --porcelain -uno)" ] && msgs="$msgs $name has uncommitted changes."
  ahead=$(git -C "$d" rev-list --count @{u}..HEAD 2>/dev/null || echo 0)
  [ "$ahead" != "0" ] && msgs="$msgs $name has $ahead unpushed commit(s)."
done
[ -z "$msgs" ] && exit 0
reason="ÆTHER sync check:$msgs The other computer cannot see this work. If it is finished, commit (author strangmatt <strangm@umich.edu>), push, and add a CLAUDE-LOG.md entry. Pushing AETHER - Site goes live, so only push finished work. If it is intentionally unfinished, tell the user."
printf '{"decision":"block","reason":%s}\n' "$(printf '%s' "$reason" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))')"
