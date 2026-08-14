#!/usr/bin/env bash
# set-github-secrets.sh — push KEY=VALUE pairs from .env files into GitHub
# Actions repository secrets via the gh CLI.
#
# Usage:
#   ./scripts/set-github-secrets.sh [-R owner/repo] [--include-derived] <file.env> [more.env ...]
#
# Requires: gh CLI (https://cli.github.com), authenticated as a user with
# admin access to the repository (`gh auth login`).
#
# Behavior:
#   - Full-line comments (#...) and blank lines are ignored.
#   - Values are passed to gh via stdin, never argv, so they don't show in `ps`.
#   - Empty values are skipped: GitHub rejects empty secrets, and an unset
#     secret already expands to "" in a workflow, so skipping is equivalent.
#   - Derived deploy metadata (API_BASE_URL, API_UPSTREAM, IMAGE_UPSTREAM,
#     BUILD_SHA, BUILT_AT) is skipped by default: deploy.yml computes these
#     itself at deploy time, and registering them as secrets would make GitHub
#     mask the commit SHA and service URLs everywhere in Actions logs.
#     Pass --include-derived to upload them anyway.
set -euo pipefail

REPO="bubsla-svg/TanmatraV2"
INCLUDE_DERIVED=0
DERIVED_KEYS="API_BASE_URL API_UPSTREAM IMAGE_UPSTREAM BUILD_SHA BUILT_AT"

usage() { echo "usage: $0 [-R owner/repo] [--include-derived] <env-file> [...]" >&2; exit 1; }

FILES=()
while [ $# -gt 0 ]; do
  case "$1" in
    -R) [ $# -ge 2 ] || usage; REPO="$2"; shift 2 ;;
    --include-derived) INCLUDE_DERIVED=1; shift ;;
    -h|--help) usage ;;
    *) FILES+=("$1"); shift ;;
  esac
done
[ ${#FILES[@]} -ge 1 ] || usage

command -v gh >/dev/null || { echo "error: gh CLI not found — install from https://cli.github.com" >&2; exit 1; }

is_derived() {
  local k
  for k in $DERIVED_KEYS; do [ "$1" = "$k" ] && return 0; done
  return 1
}

set_count=0 skip_count=0
for file in "${FILES[@]}"; do
  [ -f "$file" ] || { echo "error: no such file: $file" >&2; exit 1; }
  echo "== $file"
  while IFS= read -r line || [ -n "$line" ]; do
    line=${line%$'\r'}
    case "$line" in ''|\#*) continue ;; esac
    case "$line" in *=*) ;; *) echo "  skip (not KEY=VALUE): $line"; skip_count=$((skip_count + 1)); continue ;; esac
    key=${line%%=*}
    value=${line#*=}
    if ! printf '%s' "$key" | grep -Eq '^[A-Za-z_][A-Za-z0-9_]*$'; then
      echo "  skip $key (invalid secret name)"; skip_count=$((skip_count + 1)); continue
    fi
    if [ -z "$value" ]; then
      echo "  skip $key (empty value — unset secret behaves the same)"; skip_count=$((skip_count + 1)); continue
    fi
    if [ "$INCLUDE_DERIVED" -eq 0 ] && is_derived "$key"; then
      echo "  skip $key (derived at deploy time; --include-derived to force)"; skip_count=$((skip_count + 1)); continue
    fi
    printf '%s' "$value" | gh secret set "$key" --repo "$REPO"
    echo "  set  $key"
    set_count=$((set_count + 1))
  done < "$file"
done
echo "done: $set_count secret(s) set, $skip_count skipped, repo: $REPO"
