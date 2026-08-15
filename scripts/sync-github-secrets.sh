#!/usr/bin/env bash
#
# Sync GitHub Actions secrets for this repo from the deployed Cloud Run
# service (or Secret Manager), without any secret value being printed.
#
# WHY THIS SHAPE
#
# The values are piped gcloud -> variable -> `gh secret set` on stdin. They are
# never passed as command arguments (argv is world-readable via `ps`), never
# echoed, and never written anywhere except one mode-600 temp file that is
# removed on exit. `set -x` is refused outright, because xtrace would print
# every value it touches.
#
# WHERE THE VALUES ACTUALLY LIVE (checked 2026-08-15)
#
# Of the 18 secrets the workflows reference, 11 are plaintext env vars on the
# api-server Cloud Run service, and 7 (FIREBASE_* and GCP_SA_KEY) are in
# neither Cloud Run nor Secret Manager. Nothing in the workflow set comes from
# Secret Manager today — the 8 secrets stored there (DATABASE_URL,
# CLINICAL_KMS_MASTER_KEY, SESSION_SECRET, ...) are consumed by the running
# service and are not needed by CI. --source=secret-manager exists so this
# script keeps working once those 26 plaintext vars are migrated.
#
# Usage:
#   scripts/sync-github-secrets.sh                 # dry run: report only
#   scripts/sync-github-secrets.sh --apply         # actually write to GitHub
#   scripts/sync-github-secrets.sh --source=secret-manager --apply
#
# Requires: gcloud (authenticated), gh (authenticated with repo admin rights).
set -euo pipefail

# xtrace would leak every value below. Refuse rather than silently leak.
case "$-" in *x*) echo "refusing to run under 'set -x' (would print secrets)" >&2; exit 2;; esac

REPO="${REPO:-bubsla-svg/TanmatraV2}"
PROJECT="${GCP_PROJECT:-brand-tanmatra-tmg}"
REGION="${GCP_REGION:-asia-south2}"
SERVICE="${SERVICE:-wellness-foods}"
SOURCE="cloud-run"
APPLY=0

for arg in "$@"; do
  case "$arg" in
    --apply)                 APPLY=1 ;;
    --source=cloud-run)      SOURCE="cloud-run" ;;
    --source=secret-manager) SOURCE="secret-manager" ;;
    --repo=*)                REPO="${arg#*=}" ;;
    --service=*)             SERVICE="${arg#*=}" ;;
    -h|--help)               sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

need() { command -v "$1" >/dev/null 2>&1 || { echo "missing required tool: $1" >&2; exit 2; }; }
need gcloud; need python3
[ "$APPLY" -eq 1 ] && need gh

if [ "$APPLY" -eq 1 ] && ! gh auth status >/dev/null 2>&1; then
  echo "gh is not authenticated. Run: gh auth login" >&2
  exit 2
fi

# --- which secrets do the workflows actually need? -------------------------
#
# Derived from the workflows rather than hardcoded, so a newly referenced
# secret is picked up automatically. Comment lines are stripped first:
# deploy.yml documents the interpolation rule using a literal `secrets.X`,
# which is prose, not a secret.
mapfile -t REQUIRED < <(
  find .github/workflows -name '*.yml' -print0 \
  | xargs -0 sed 's/#.*$//' \
  | grep -oE 'secrets\.[A-Z_][A-Z0-9_]+' \
  | sed 's/secrets\.//' \
  | grep -vx 'GITHUB_TOKEN' \
  | sort -u
)
[ "${#REQUIRED[@]}" -gt 0 ] || { echo "found no secret references in .github/workflows" >&2; exit 1; }

# --- fetch the source once, into a mode-600 temp file ----------------------
umask 077
SRC_FILE="$(mktemp)"
cleanup() { rm -f "$SRC_FILE"; }
trap cleanup EXIT INT TERM

if [ "$SOURCE" = "cloud-run" ]; then
  echo "reading env from Cloud Run service '$SERVICE' ($REGION, $PROJECT)" >&2
  gcloud run services describe "$SERVICE" \
    --region "$REGION" --project "$PROJECT" --format json > "$SRC_FILE"
fi

# Print one value to stdout, or exit 1 if absent/empty. Never logs.
lookup() {
  local name="$1"
  if [ "$SOURCE" = "secret-manager" ]; then
    gcloud secrets versions access latest \
      --secret "$name" --project "$PROJECT" 2>/dev/null || return 1
  else
    SECRET_NAME="$name" python3 -c '
import json, os, sys
name = os.environ["SECRET_NAME"]
d = json.load(open(sys.argv[1]))
for e in d["spec"]["template"]["spec"]["containers"][0].get("env", []):
    if e.get("name") == name and "value" in e:
        sys.stdout.write(e["value"])
        sys.exit(0)
sys.exit(1)
' "$SRC_FILE" || return 1
  fi
}

# --- sync ------------------------------------------------------------------
[ "$APPLY" -eq 1 ] || echo "DRY RUN — no secrets will be written. Re-run with --apply." >&2
echo >&2

synced=0; missing=0; failed=0
missing_names=()

for name in "${REQUIRED[@]}"; do
  if ! value="$(lookup "$name")" || [ -z "$value" ]; then
    printf '  %-28s MISSING at source\n' "$name" >&2
    missing=$((missing + 1)); missing_names+=("$name")
    continue
  fi

  if [ "$APPLY" -eq 0 ]; then
    printf '  %-28s would sync (%d bytes)\n' "$name" "${#value}" >&2
    synced=$((synced + 1))
  elif printf '%s' "$value" | gh secret set "$name" --repo "$REPO" >/dev/null 2>&1; then
    printf '  %-28s synced\n' "$name" >&2
    synced=$((synced + 1))
  else
    printf '  %-28s FAILED to write\n' "$name" >&2
    failed=$((failed + 1))
  fi
  unset value
done

echo >&2
printf 'required=%d  ok=%d  missing=%d  failed=%d\n' \
  "${#REQUIRED[@]}" "$synced" "$missing" "$failed" >&2

if [ "$missing" -gt 0 ]; then
  echo >&2
  echo "Set these by hand — they exist in neither Cloud Run nor Secret Manager:" >&2
  printf '  https://github.com/%s/settings/secrets/actions\n' "$REPO" >&2
  for n in "${missing_names[@]}"; do echo "    $n" >&2; done
fi

[ "$failed" -eq 0 ]
