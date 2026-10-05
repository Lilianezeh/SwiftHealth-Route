#!/usr/bin/env bash
# PostToolUse hook: after Claude edits a file, lint it and show problems to Claude.
# Exit 0 = fine (silent). Exit 2 = problems; stderr is shown to Claude so it can fix them.
file=$(python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("tool_input",{}).get("file_path",""))' 2>/dev/null)
[ -z "$file" ] && exit 0
cd "$CLAUDE_PROJECT_DIR" || exit 0

case "$file" in
  *backend/*.py)
    if command -v ruff >/dev/null 2>&1; then
      out=$(cd backend && ruff check "$file" 2>&1) || { echo "ruff found problems:" >&2; echo "$out" >&2; exit 2; }
    fi ;;
  *frontend/*.ts|*frontend/*.tsx)
    if [ -d frontend/node_modules ]; then
      out=$(cd frontend && npx eslint "$file" 2>&1) || { echo "eslint found problems:" >&2; echo "$out" >&2; exit 2; }
    fi ;;
esac
exit 0
