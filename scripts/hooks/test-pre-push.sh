#!/usr/bin/env bash
# Tests for scripts/hooks/pre-push. Run from anywhere: bash scripts/hooks/test-pre-push.sh
# It builds a throwaway "remote" and "clone" in a temp folder and tries real pushes. Nothing in this repo is touched.
set -u

hooks_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
failures=0

check() {  # check "what is tested" "expected: pass|block" <command...>
  local name="$1" expected="$2"
  shift 2
  local output status
  output="$("$@" 2>&1)"
  status=$?
  if [ "$expected" = "block" ] && [ "$status" -ne 0 ] && grep -q "pull request" <<<"$output"; then
    echo "ok    $name"
  elif [ "$expected" = "pass" ] && [ "$status" -eq 0 ]; then
    echo "ok    $name"
  else
    echo "FAIL  $name (expected $expected, exit status $status)"
    echo "$output" | sed 's/^/        /'
    failures=$((failures + 1))
  fi
}

git init -q --bare "$work/remote.git"
git clone -q "$work/remote.git" "$work/clone" 2>/dev/null
cd "$work/clone" || exit 1
git config user.email "test@example.com"
git config user.name "Test"
git config core.hooksPath "$hooks_dir"
git checkout -q -b main
git commit -q --allow-empty -m "first"

check "a push of main is refused, with a message about pull requests" block git push origin main
check "a push from a feature branch to main (HEAD:main) is refused" block git push origin HEAD:main
git checkout -q -b feature/example
git commit -q --allow-empty -m "second"
check "a push of a feature branch is allowed" pass git push origin feature/example
check "a push to main from a feature branch is refused" block git push origin feature/example:main
check "a push of several branches that includes main is refused" block git push origin main feature/example
check "a push with a full ref name to main is refused" block git push origin HEAD:refs/heads/main
git push -q --no-verify origin main 2>/dev/null  # put main on the remote the only way left, to test deleting it
check "deleting main on the remote is refused" block git push origin --delete main
git tag v0.0.1
check "a push of a tag is allowed" pass git push origin v0.0.1
check "deleting a feature branch on the remote is allowed" pass git push origin --delete feature/example

if [ "$failures" -eq 0 ]; then
  echo "All pre-push hook tests passed."
else
  echo "$failures test(s) failed."
  exit 1
fi
