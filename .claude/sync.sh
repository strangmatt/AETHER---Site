#!/usr/bin/env bash
# ÆTHER two-computer sync. Runs at the start of a Claude session (hook).
# Pulls every strangmatt/AETHER* repo that sits next to this one, then prints
# the shared INBOX and the newest CLAUDE-LOG entries so Claude sees them.
export GIT_TERMINAL_PROMPT=0 GIT_SSH_COMMAND="ssh -o BatchMode=yes -o ConnectTimeout=8"
self_root=$(cd "$(dirname "$0")/.." && pwd)
parent=$(dirname "$self_root")
shop=""
echo "=== ÆTHER sync ($(date '+%Y-%m-%d %H:%M')) ==="
for d in "$parent"/*/; do
  d=${d%/}
  [ -d "$d/.git" ] || continue
  case "$d" in *BACKUP*|*backup*) continue ;; esac  # never touch backup copies
  url=$(git -C "$d" remote get-url origin 2>/dev/null)
  case "$url" in *strangmatt/AETHER*) ;; *) continue ;; esac
  name=$(basename "$d")
  before=$(git -C "$d" rev-parse HEAD 2>/dev/null)
  if out=$(timeout 25 git -C "$d" pull --ff-only -q 2>&1); then
    after=$(git -C "$d" rev-parse HEAD)
    if [ "$before" != "$after" ]; then
      echo "[$name] pulled new commits:"
      git -C "$d" log --format='  %h %ad %s' --date=short "$before..$after"
    else
      echo "[$name] up to date"
    fi
  else
    echo "[$name] PULL FAILED — fix before editing: ${out%%$'\n'*}"
  fi
  dirty=$(git -C "$d" status --porcelain -uno)
  [ -n "$dirty" ] && echo "[$name] has uncommitted changes on this machine"
  [ -f "$d/CLAUDE-LOG.md" ] && shop="$d"
done
if [ -n "$shop" ]; then
  if [ -f "$shop/INBOX.md" ]; then
    echo; echo "--- INBOX.md (open items: do these, then move them to Done) ---"
    awk '/^## Open/{f=1;next} /^## /{f=0} f && NF' "$shop/INBOX.md"
  fi
  echo; echo "--- Newest CLAUDE-LOG.md entries ---"
  awk '/^### /{n++} n>=1 && n<=2' "$shop/CLAUDE-LOG.md"
fi
echo; echo "Before ending: commit + push your changes and add a CLAUDE-LOG.md entry (AETHER-Shop)."
exit 0
