# syntax=docker/dockerfile:1.7
#
# Storefront (Next.js) image for Cloud Run. Mirrors artifacts/tanmatra/Dockerfile:
# a pnpm-workspace builder stage, then a lean runner that serves the Next
# `standalone` output — no pnpm/workspace install in the runtime image.

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

# Workspace manifests first so pnpm install is cached unless the lockfile
# changes.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY tsconfig.base.json tsconfig.json ./

# The target manifest + the full lib tree (so every workspace-lib package.json
# pnpm resolves against is present). Other artifacts/* dirs are absent, so pnpm
# treats them as non-packages — same as the api-server Dockerfile.
COPY artifacts/storefront/package.json artifacts/storefront/
COPY lib lib

RUN pnpm install --frozen-lockfile --reporter=append-only

# Full storefront source.
COPY artifacts/storefront artifacts/storefront

# NEXT_PUBLIC_* are inlined into the client bundle at build time. NEXT_PUBLIC_API_BASE
# is left empty so the browser calls the same-origin /api proxy (see next.config
# rewrites); server-side fetches use the runtime API_BASE_URL instead.
ARG NEXT_PUBLIC_API_BASE=""
ARG NEXT_PUBLIC_LIVE_CHECKOUT=""
ARG NEXT_PUBLIC_MEALCARD_RAIL=""
ARG NEXT_PUBLIC_ANALYTICS_BEACON=""
# Canonical public origin baked into robots.txt / sitemap.xml / canonical + OG
# tags and JSON-LD (lib/siteUrl.ts). Empty → falls back to the Cloud Run run.app
# origin; set to the production domain once it fronts this service (see
# docs/DOMAIN-CUTOVER.md).
ARG NEXT_PUBLIC_SITE_URL=""
# Firebase web config (SF-03 phone-auth). These are PUBLIC by design — the
# security boundary is the api-server, which verifies the resulting idToken —
# so they ship in the client bundle exactly like the legacy VITE_FIREBASE_* set.
# Absent → firebaseConfigured() is false and sign-in silently self-hides.
ARG NEXT_PUBLIC_FIREBASE_API_KEY=""
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=""
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID=""
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=""
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=""
ARG NEXT_PUBLIC_FIREBASE_APP_ID=""
# Proxy upstreams for the same-origin /api and /images hops. next.config's
# rewrites() are evaluated at BUILD time and baked into routes-manifest.json —
# a runtime env var cannot enable them — so these must arrive as build args.
ARG API_UPSTREAM=""
ARG IMAGE_UPSTREAM=""

RUN NEXT_PUBLIC_API_BASE="${NEXT_PUBLIC_API_BASE}" \
    NEXT_PUBLIC_LIVE_CHECKOUT="${NEXT_PUBLIC_LIVE_CHECKOUT}" \
    NEXT_PUBLIC_MEALCARD_RAIL="${NEXT_PUBLIC_MEALCARD_RAIL}" \
    NEXT_PUBLIC_ANALYTICS_BEACON="${NEXT_PUBLIC_ANALYTICS_BEACON}" \
    NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL}" \
    NEXT_PUBLIC_FIREBASE_API_KEY="${NEXT_PUBLIC_FIREBASE_API_KEY}" \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}" \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID="${NEXT_PUBLIC_FIREBASE_PROJECT_ID}" \
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}" \
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}" \
    NEXT_PUBLIC_FIREBASE_APP_ID="${NEXT_PUBLIC_FIREBASE_APP_ID}" \
    API_UPSTREAM="${API_UPSTREAM}" \
    IMAGE_UPSTREAM="${IMAGE_UPSTREAM}" \
    pnpm --filter @workspace/storefront run build

# ── runner ────────────────────────────────────────────────────────────────────
FROM node:22-slim AS runner

ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
WORKDIR /app

# Next `standalone` output: a self-contained traced server. The build traces
# from the monorepo root, so the server entry sits at artifacts/storefront/.
# `public/` is not part of the traced output and must be copied explicitly —
# it carries the §9.5 service-worker kill switch (sw.js).
COPY --from=builder /app/artifacts/storefront/.next/standalone ./
COPY --from=builder /app/artifacts/storefront/.next/static ./artifacts/storefront/.next/static
COPY --from=builder /app/artifacts/storefront/public ./artifacts/storefront/public

RUN groupadd --system --gid 1001 app \
 && useradd  --system --uid 1001 --gid app --home /app app \
 && chown -R app:app /app
USER app

EXPOSE 8080

CMD ["node", "artifacts/storefront/server.js"]
