#!/usr/bin/env bash
# Checks that every place that names a Node.js version names the same major version.
# Run from anywhere: bash scripts/check-node-version.sh      (the frontend CI runs it too)
# The places: the frontend Dockerfile, netlify.toml, the frontend CI workflow, and @types/node in package.json.
# Why: Node 20 reached end of life on 2026-04-30 and we moved to the Active LTS. A pin left behind would make the
# laptop, the tests and the live site run different Node versions without anyone noticing.
set -u

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

dockerfile_major="$(sed -n 's/^FROM node:\([0-9]*\).*/\1/p' "$root/frontend/Dockerfile" | head -n 1)"
netlify_major="$(sed -n 's/^ *NODE_VERSION *= *"\([0-9]*\).*/\1/p' "$root/netlify.toml" | head -n 1)"
workflow_major="$(sed -n 's/.*node-version: *"\([0-9]*\)".*/\1/p' "$root/.github/workflows/frontend.yml" | head -n 1)"
types_major="$(sed -n 's/.*"@types\/node": *"[^0-9]*\([0-9]*\).*/\1/p' "$root/frontend/package.json" | head -n 1)"

echo "frontend/Dockerfile ........ node:${dockerfile_major:-?}"
echo "netlify.toml NODE_VERSION .. ${netlify_major:-?}"
echo ".github/workflows/frontend.yml node-version ${workflow_major:-?}"
echo "frontend/package.json @types/node ^${types_major:-?}"

if [ -z "$dockerfile_major" ] || [ "$dockerfile_major" != "$netlify_major" ] \
  || [ "$dockerfile_major" != "$workflow_major" ] || [ "$dockerfile_major" != "$types_major" ]; then
  echo "NODE VERSIONS DISAGREE (or one is missing). They must all name the same major version." >&2
  exit 1
fi
echo "All four name Node ${dockerfile_major}."
