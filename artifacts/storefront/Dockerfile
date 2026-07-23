# syntax=docker/dockerfile:1.7
#
# Storefront (Next.js) image for Cloud Run. Mirrors artifacts/tanmatra/Dockerfile:
# a pnpm-workspace builder stage, then a lean runner that serves the Next
# `standalone` output — no pnpm/workspace install in the runtime image.

# ── builder ──────────────────────────────────────────────────────────────────
FROM node:24-slim AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Workspace manifests first so pnpm install is cached unless the lockfile
# changes.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY tsconfig.base.json tsconfig.json ./

# The target manifest + the full lib tree (so every workspace-lib package.json
# pnpm resolves against is present). Other artifacts/* dirs are absent, so pnpm
# treats them as non-packages — same as the api-server Dockerfile.
COPY artifacts/storefront/package.json artifacts/storefront/
COPY lib lib

RUN pnpm install --frozen-lockfile --ignore-scripts

# Full storefront source.
COPY artifacts/storefront artifacts/storefront

# NEXT_PUBLIC_* are inlined into the client bundle at build time. NEXT_PUBLIC_API_BASE
# is left empty so the browser calls the same-origin /api proxy (see next.config
# rewrites); server-side fetches use the runtime API_BASE_URL instead.
ARG NEXT_PUBLIC_API_BASE=""
ARG NEXT_PUBLIC_LIVE_CHECKOUT=""
ARG NEXT_PUBLIC_MEALCARD_RAIL=""
ARG NEXT_PUBLIC_ANALYTICS_BEACON=""
# Proxy upstreams for the same-origin /api and /images hops. next.config's
# rewrites() are evaluated at BUILD time and baked into routes-manifest.json —
# a runtime env var cannot enable them — so these must arrive as build args.
ARG API_UPSTREAM=""
ARG IMAGE_UPSTREAM=""

RUN NEXT_PUBLIC_API_BASE="${NEXT_PUBLIC_API_BASE}" \
    NEXT_PUBLIC_LIVE_CHECKOUT="${NEXT_PUBLIC_LIVE_CHECKOUT}" \
    NEXT_PUBLIC_MEALCARD_RAIL="${NEXT_PUBLIC_MEALCARD_RAIL}" \
    NEXT_PUBLIC_ANALYTICS_BEACON="${NEXT_PUBLIC_ANALYTICS_BEACON}" \
    API_UPSTREAM="${API_UPSTREAM}" \
    IMAGE_UPSTREAM="${IMAGE_UPSTREAM}" \
    pnpm --filter @workspace/storefront run build

# ── runner ────────────────────────────────────────────────────────────────────
FROM node:24-slim AS runner

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
