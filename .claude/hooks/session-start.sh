#!/bin/bash
# SessionStart hook — install the Google Cloud SDK.
#
# Tanmatra deploys three Cloud Run services (see .github/workflows/deploy.yml),
# so a session that needs to read deploy state, tail Cloud Run logs, inspect
# revisions or reach Secret Manager needs `gcloud` on PATH. The remote container
# image does not ship it, and the image is rebuilt from a fresh clone every
# session, so it has to be installed here rather than assumed.
#
# Runs synchronously: gcloud is a tool the agent may reach for on its very first
# command, so we would rather pay the startup cost than race the install.
set -euo pipefail

# Web/remote sessions only. A local checkout keeps whatever gcloud the developer
# already has (or deliberately does not have) — this hook must not mutate it.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

INSTALL_DIR="${GCLOUD_INSTALL_DIR:-$HOME/google-cloud-sdk}"
BIN_DIR="${GCLOUD_BIN_DIR:-/usr/local/bin}"
ARCHIVE_URL="https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-linux-x86_64.tar.gz"

log() { printf 'session-start: %s\n' "$*" >&2; }

# Persist an export for the rest of the session when the harness offers an env
# file, and no-op cleanly when it does not (e.g. when run by hand).
persist_env() {
  if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
    printf '%s\n' "$1" >> "$CLAUDE_ENV_FILE"
  fi
}

# Make the three entrypoints reachable without depending on shell rc files
# being sourced. /usr/local/bin is already on PATH in this image.
link_binaries() {
  for tool in gcloud gsutil bq; do
    if [ -x "$INSTALL_DIR/bin/$tool" ] && [ -w "$BIN_DIR" ]; then
      ln -sf "$INSTALL_DIR/bin/$tool" "$BIN_DIR/$tool"
    fi
  done
}

expose_sdk() {
  export PATH="$INSTALL_DIR/bin:$PATH"
  persist_env "export PATH=\"$INSTALL_DIR/bin:\$PATH\""
  link_binaries
}

# Idempotent: a cached container that already ran this hook just re-exports.
if [ -x "$INSTALL_DIR/bin/gcloud" ]; then
  log "gcloud already installed at $INSTALL_DIR"
  expose_sdk
  gcloud --version | head -1 >&2
  exit 0
fi

# An image-provided gcloud is good enough — do not shadow it with our own copy.
if command -v gcloud >/dev/null 2>&1; then
  log "gcloud already on PATH at $(command -v gcloud) — skipping install"
  exit 0
fi

archive="$(mktemp -t gcloud-cli-XXXXXX.tar.gz)"
cleanup() { rm -f "$archive"; }
trap cleanup EXIT

# Outbound HTTPS goes through the session's egress proxy, which curl already
# trusts via CURL_CA_BUNDLE. Retry transient failures; a policy denial (403/407)
# will not improve with retries but --retry only fires on 5xx/connection errors.
log "downloading Google Cloud CLI"
curl -fsSL --retry 4 --retry-delay 2 --retry-connrefused -o "$archive" "$ARCHIVE_URL"

log "extracting to $INSTALL_DIR"
rm -rf "$INSTALL_DIR"
mkdir -p "$(dirname "$INSTALL_DIR")"
# The tarball's single top-level directory is `google-cloud-sdk`; strip it so
# INSTALL_DIR can be named whatever the caller wants.
tar -xzf "$archive" -C "$(dirname "$INSTALL_DIR")" --transform \
  "s|^google-cloud-sdk|$(basename "$INSTALL_DIR")|"

# --install-python=false skips the *extra* interpreter download; the
# linux-x86_64 tarball already bundles one, which gcloud's launcher picks up on
# its own. --path-update/--command-completion write to shell rc files that a
# hook-spawned shell never sources, so we handle PATH ourselves above.
log "running installer"
"$INSTALL_DIR/install.sh" \
  --quiet \
  --usage-reporting=false \
  --path-update=false \
  --command-completion=false \
  --install-python=false >/dev/null

expose_sdk

# Cloud Run and Cloud SQL are how this repo ships; surface a broken install now
# rather than three tool calls into the session.
gcloud --version | head -1 >&2
log "gcloud ready"
