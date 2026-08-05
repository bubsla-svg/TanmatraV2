# syntax=docker/dockerfile:1.7

# ── builder ──────────────────────────────────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"
ENV CI="true"
ENV PYTHON="/usr/bin/python3"

ARG PNPM_VERSION=9.15.5

# Native build requirements for better-sqlite3 and other node-gyp packages.
RUN apt-get update \
    && apt-get install --yes --no-install-recommends \
        python3 \
        make \
        g++ \
    && rm -rf /var/lib/apt/lists/*

# Install current Corepack, then activate the repository-pinned pnpm.
RUN npm install --global corepack@latest \
    && corepack enable \
    && corepack prepare "pnpm@${PNPM_VERSION}" --activate \
    && echo "Node: $(node --version)" \
    && echo "Python: $(python3 --version)" \
    && echo "pnpm: $(pnpm --version)"

# Workspace manifests first so pnpm install is cached unless lockfile changes.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY tsconfig.base.json tsconfig.json ./

# tanmatra depends on lib/* workspace packages — copy all manifests before
# pnpm install so workspace resolution works, then overwrite with full source.
COPY artifacts/tanmatra/package.json    artifacts/tanmatra/
COPY lib/db/package.json                lib/db/
COPY lib/api-zod/package.json           lib/api-zod/
COPY lib/api-client-react/package.json  lib/api-client-react/
COPY lib/menu-catalog/package.json      lib/menu-catalog/
COPY lib/preferences-match/package.json lib/preferences-match/
COPY lib/integrations-gemini-ai/package.json lib/integrations-gemini-ai/
COPY lib/agency-agents/package.json     lib/agency-agents/

RUN pnpm install --frozen-lockfile --reporter=append-only

# Full source for lib packages (compiled in-place by tsc or bundled by vite).
COPY lib lib
# Full source for tanmatra (includes src/, public/, vite.config.ts, etc.).
COPY artifacts/tanmatra artifacts/tanmatra

# VITE_API_BASE is baked into the JS bundle at build time. Pass it as a build
# arg so CI can set the correct wellness-foods Cloud Run URL.
ARG VITE_API_BASE
ARG VITE_GOOGLE_MAPS_API_KEY
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_RAZORPAY_KEY_ID

# SPA mode (ssr:false) — produces build/client/ only (no build/server/).
RUN VITE_API_BASE="${VITE_API_BASE}" \
    VITE_GOOGLE_MAPS_API_KEY="${VITE_GOOGLE_MAPS_API_KEY}" \
    VITE_FIREBASE_API_KEY="${VITE_FIREBASE_API_KEY}" \
    VITE_FIREBASE_AUTH_DOMAIN="${VITE_FIREBASE_AUTH_DOMAIN}" \
    VITE_FIREBASE_PROJECT_ID="${VITE_FIREBASE_PROJECT_ID}" \
    VITE_FIREBASE_STORAGE_BUCKET="${VITE_FIREBASE_STORAGE_BUCKET}" \
    VITE_FIREBASE_MESSAGING_SENDER_ID="${VITE_FIREBASE_MESSAGING_SENDER_ID}" \
    VITE_FIREBASE_APP_ID="${VITE_FIREBASE_APP_ID}" \
    VITE_RAZORPAY_KEY_ID="${VITE_RAZORPAY_KEY_ID}" \
    pnpm --filter @workspace/tanmatra run build

# ── runner ────────────────────────────────────────────────────────────────────
# Serve the static SPA with a minimal Node http server; no SSR bundle needed.
FROM node:22-slim AS runner

ENV NODE_ENV=production
ENV PORT=8080
ARG BUILD_SHA=unknown
ARG BUILT_AT=unknown
ENV BUILD_SHA=${BUILD_SHA}
ENV BUILT_AT=${BUILT_AT}
WORKDIR /app

COPY --from=builder /app/artifacts/tanmatra/build/client ./public

# Static server + /api reverse proxy (see server/static-server.mjs):
# same-origin API keeps the session cookie first-party — the cross-site
# topology (tanmatra.food -> run.app) had Safari/ITP and Chrome Incognito
# silently dropping the cookie, bouncing freshly-verified users to /login.
COPY --from=builder /app/artifacts/tanmatra/server/static-server.mjs ./server.mjs

RUN groupadd --system --gid 1001 app \
 && useradd  --system --uid 1001 --gid app --home /app app \
 && chown -R app:app /app
USER app

EXPOSE 8080

CMD ["node", "server.mjs"]
