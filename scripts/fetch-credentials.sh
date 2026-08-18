#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# Tanmatra — fetch every retrievable production credential into one local file.
#
#   ./scripts/fetch-credentials.sh [OUTFILE]      (default: tanmatra-credentials.txt)
#
# Run this on a machine where YOU are authenticated:
#   gcloud auth login
#   gcloud config set project brand-tanmatra-tmg
#
# This script contains no secrets and is safe to commit. Its OUTPUT is not —
# it is written 0600 and must never be committed, pasted into chat, or attached
# to a ticket.
#
# ── Where Tanmatra credentials actually live (three places, not one) ──────────
#
#   1. GCP Secret Manager      — 8 values, mounted via deploy.yml --set-secrets.
#                                Fetched below.
#   2. Cloud Run env vars      — set as PLAINTEXT via deploy.yml
#                                --update-env-vars. Readable by anyone holding
#                                run.services.get. Fetched below.
#   3. GitHub Actions secrets  — WRITE-ONLY. GitHub never returns a secret's
#                                value, by design. Nothing can fetch these; the
#                                script prints where each one actually comes
#                                from instead.
# ══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

PROJECT="${GCP_PROJECT:-brand-tanmatra-tmg}"
REGION="${GCP_REGION:-asia-south2}"
API_SERVICE="${API_SERVICE:-wellness-foods}"
SQL_INSTANCE="${SQL_INSTANCE:-brand-tanmatra-db}"
OUT="${1:-tanmatra-credentials.txt}"

command -v gcloud >/dev/null || { echo "gcloud not on PATH" >&2; exit 1; }
command -v python3 >/dev/null || { echo "python3 not on PATH" >&2; exit 1; }

if ! gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null | grep -q .; then
  echo "No active gcloud account. Run: gcloud auth login" >&2
  exit 1
fi

# Create 0600 BEFORE writing, so the secrets are never briefly world-readable.
umask 077
: > "$OUT"

log() { printf '%s\n' "$*" >&2; }
say() { printf '%s\n' "$*" >> "$OUT"; }

say "# Tanmatra credentials — generated $(date -u +%Y-%m-%dT%H:%M:%SZ)"
say "# Project ${PROJECT} / region ${REGION}"
say "# SENSITIVE. Do not commit, paste, or attach. Delete when done: shred -u ${OUT}"
say ""

# ── 1. GCP Secret Manager ─────────────────────────────────────────────────────
say "# ── From GCP Secret Manager (deploy.yml --set-secrets) ────────────────────"
fetch_secret() {
  local env_name="$1" secret="$2" value
  if value=$(gcloud secrets versions access latest \
        --secret="$secret" --project="$PROJECT" 2>/dev/null); then
    say "${env_name}=${value}"
    log "  ok    ${env_name}  <- ${secret}"
  else
    say "# ${env_name}= (UNREADABLE: ${secret} — missing, or you lack secretAccessor)"
    log "  FAIL  ${env_name}  <- ${secret}"
  fi
}

log "Secret Manager:"
fetch_secret DATABASE_URL             brand-tanmatra-database-url
fetch_secret ADMIN_SESSION_SECRET     brand-tanmatra-admin-session-secret
fetch_secret SESSION_SECRET           brand-tanmatra-session-secret
fetch_secret CLINICAL_KMS_MASTER_KEY  brand-tanmatra-clinical-kms-key
fetch_secret PETPOOJA_APP_KEY         brand-tanmatra-petpooja-app-key
fetch_secret PETPOOJA_APP_SECRET      brand-tanmatra-petpooja-app-secret
fetch_secret PETPOOJA_ACCESS_TOKEN    brand-tanmatra-petpooja-access-token
fetch_secret GOOGLE_API_KEY           brand-tanmatra-google-api-key
say ""

# ── 2. Cloud Run plaintext env vars ───────────────────────────────────────────
# deploy.yml sets these with --update-env-vars, NOT --set-secrets, so the live
# values sit in the service spec in the clear and can be read straight back.
say "# ── From the ${API_SERVICE} Cloud Run service (plaintext env vars) ─────────"
log "Cloud Run ${API_SERVICE}:"
if gcloud run services describe "$API_SERVICE" \
      --region "$REGION" --project "$PROJECT" --format=json > /tmp/.tnm-svc.$$ 2>/dev/null; then
  # The JSON arrives by PATH, not on stdin: `python3 -` already uses stdin to
  # read the program itself, so a `< file` redirect here would feed python the
  # service JSON as its source code.
  python3 - "$OUT" "/tmp/.tnm-svc.$$" <<'PY'
import json, sys
WANT = ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET",
        "REDIS_PASSWORD", "REDIS_HOST", "REDIS_PORT",
        "ADMIN_USERNAME", "ADMIN_PASSWORD_HASH", "PRIVATE_OBJECT_DIR"]
with open(sys.argv[2]) as fh:
    svc = json.load(fh)
containers = svc["spec"]["template"]["spec"]["containers"]
env = {e["name"]: e for e in containers[0].get("env", [])}
with open(sys.argv[1], "a") as fh:
    for name in WANT:
        entry = env.get(name)
        if entry is None:
            fh.write(f"# {name}= (not set on the service)\n")
            print(f"  miss  {name}", file=sys.stderr)
        elif "value" in entry:
            v = entry["value"]
            fh.write(f"{name}={v}\n")
            # An unset GitHub secret expands to "" and silently overwrites a
            # working credential — deploy.yml has a guard for exactly this.
            print(f"  {'EMPTY!' if v == '' else 'ok    '} {name}", file=sys.stderr)
        else:
            ref = entry.get("valueFrom", {}).get("secretKeyRef", {})
            fh.write(f"# {name}= -> Secret Manager: {ref.get('name','?')}\n")
            print(f"  ref   {name}", file=sys.stderr)
PY
  rm -f /tmp/.tnm-svc.$$
else
  say "# (could not describe ${API_SERVICE} — check run.services.get permission)"
  log "  FAIL  describe ${API_SERVICE}"
fi
say ""

# ── 3. Not fetchable from anywhere ────────────────────────────────────────────
say "# ── NOT retrievable by any tool — GitHub Actions secrets are write-only ───"
say "# GitHub never returns a secret's value. Each of these has one real source:"
say "#"
say "#   GOOGLE_MAPS_API_KEY   GCP console -> APIs & Services -> Credentials."
say "#                         If unset, Maps geocoding falls back to"
say "#                         GOOGLE_API_KEY above, which then needs the"
say "#                         Geocoding API enabled. A Gemini-only rotation of"
say "#                         that key broke /geo/* live on 2026-07-20."
say "#"
say "#   NEXT_PUBLIC_FIREBASE_*  Firebase console -> Project settings -> Your"
say "#                         apps -> SDK setup and config. Public by design"
say "#                         (it ships in the client bundle; the boundary is"
say "#                         the server verifying the idToken), so it is also"
say "#                         readable out of the deployed storefront bundle."
say "#"
say "#   GCP_SA_KEY            The CI deploy service-account key. Not needed"
say "#                         locally — use your own gcloud login instead."
say ""

# ── Local usage notes ─────────────────────────────────────────────────────────
say "# ── Using these locally ───────────────────────────────────────────────────"
say "# DATABASE_URL above is the PRODUCTION Cloud SQL socket form. For local dev,"
say "# start the proxy and rewrite the host:"
say "#"
say "#   cloud-sql-proxy ${PROJECT}:${REGION}:${SQL_INSTANCE} --port 9470"
say "#   DATABASE_URL=postgresql://postgres:<password-from-above>@localhost:9470/neondb"
say "#"
say "# CLINICAL_KMS_MASTER_KEY is the PRODUCTION key. Use it ONLY when pointing"
say "# at the production database — clinical rows written under a different key"
say "# cannot be decrypted, and vice versa."
say "#"
say "# Use the rzp_test_* Razorpay pair locally, never the live pair above."

chmod 600 "$OUT"
log ""
log "Wrote $(grep -cE '^[A-Z_]+=' "$OUT") populated values to ${OUT} (mode 0600)."
log "Delete it when you are done:  shred -u ${OUT}"
