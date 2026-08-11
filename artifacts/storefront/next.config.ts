import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";


/**
 * Workspace TS packages ship source, not build output, so Next must transpile
 * them. Keep this list tight — every entry is a package the storefront imports
 * directly (the token package for the CSS/values, the catalog for the SSR menu
 * fallback).
 */
const nextConfig: NextConfig = {
  // Cloud Run ships the app as a self-contained Node server: `next build`
  // emits `.next/standalone` with only the traced deps, so the runtime image
  // needs no pnpm/workspace install. Next auto-detects the monorepo root from
  // the lockfile for dependency tracing.
  output: "standalone",
  transpilePackages: [
    "@workspace/tokens",
    "@workspace/menu-catalog",
    "@workspace/subscription-rules",
  ],
  reactStrictMode: true,
  // Same-origin /api proxy to the api-server (set API_UPSTREAM at runtime). The
  // browser calls same-origin `/api/*` (NEXT_PUBLIC_API_BASE=""), so the session
  // cookie stays first-party — the cross-site topology (storefront → api on a
  // different host) drops it under Safari/ITP, exactly the bug the tanmatra
  // static server was built to avoid. Server components fetch the api directly
  // via API_BASE_URL and don't use this hop.
  // NOTE: rewrites are evaluated ONCE at `next build` and baked into
  // routes-manifest.json — a runtime-only env var can NOT enable them
  // (verified empirically: env set at `next start`, rewrite absent). Both
  // upstreams must be present AT BUILD TIME; the Dockerfile passes them as
  // build args from deploy.yml. Repointing = redeploy with a new build arg.
  async rewrites() {
    const upstream = process.env.API_UPSTREAM;
    // Dish photography: the catalog's `dish.image` paths are root-relative
    // (/images/dishes/<slug>.jpg), but the photo library (~280 base JPGs,
    // ~196 MB) lives in the legacy app's public/ dir and is far too heavy to
    // bake into this container. Proxy the path to wherever the library is
    // hosted — the legacy Cloud Run service today, a bucket/CDN at cutover.
    // Same-origin also keeps a future `img-src 'self'` CSP clean.
    const imageUpstream = process.env.IMAGE_UPSTREAM;
    return [
      ...(upstream
        ? [{ source: "/api/:path*", destination: `${upstream}/api/:path*` }]
        : []),
      ...(imageUpstream
        ? [{ source: "/images/:path*", destination: `${imageUpstream}/images/:path*` }]
        : []),
    ];
  },
  // Central path-rename map (route-parity Track 0 — docs/STOREFRONT-ROUTE-PARITY.md
  // §3). Legacy top-level paths → their canonical storefront home, as permanent
  // (308) redirects so link-equity + SEO consolidate onto one URL each. Baked at
  // build time (routes-manifest) — adding one is a redeploy. This is the single
  // shared redirect surface; waves add here instead of scattering redirects.
  async redirects() {
    return [
      // Account/plan consolidation: legacy bare paths → the /account/* home.
      { source: "/orders", destination: "/account/orders", permanent: true },
      { source: "/rewards", destination: "/account/loyalty", permanent: true },
      { source: "/preferences", destination: "/account/preferences", permanent: true },
      { source: "/subscriptions", destination: "/account/subscriptions", permanent: true },
      // Bare /track was the legacy order LIST; the storefront keeps only
      // /track/:orderId (live tracking), which this exact-match rule leaves alone.
      { source: "/track", destination: "/account/orders", permanent: true },
      // Legacy /account/plan was a stub that forwarded to plan management; the
      // storefront's plan surface is /account/subscriptions — target it directly
      // (no double-hop through the /subscriptions alias above).
      { source: "/account/plan", destination: "/account/subscriptions", permanent: true },
      // /profile is a common typed / QR-code / deep-link URL; the canonical
      // account home is /account (legacy ProfileRedirect did the same).
      { source: "/profile", destination: "/account", permanent: true },
      // Plan surfaces reconcile onto /plans + /plan/:id + /trial (Wave H).
      { source: "/subscribe", destination: "/plans", permanent: true },
      { source: "/subscription-plans", destination: "/plans", permanent: true },
      // Legacy legal paths → the consolidated /legal/* pages (legal-pages PR).
      // These resolve once that PR merges; until then they 308 to a not-yet-live
      // path — no regression, since the bare paths 404 today anyway.
      { source: "/terms", destination: "/legal/terms", permanent: true },
      { source: "/privacy", destination: "/legal/privacy", permanent: true },
      { source: "/refunds", destination: "/legal/refunds", permanent: true },
      // Legacy standalone /cart → canonical B2C checkout page.
      { source: "/cart", destination: "/checkout", permanent: true },
      // Legacy plural plan detail URLs (e.g. /plans/pcos-balance) → canonical singular /plan/:id home.
      // Using :path+ ensures only sub-paths are matched, preserving bare /plans as the active catalog list.
      { source: "/plans/:path+", destination: "/plan/:path+", permanent: true },
      // Legacy clinical advisory schedules → canonical account appointments dashboard.
      { source: "/appointments", destination: "/account/appointments", permanent: true },
      { source: "/checkout-appointment", destination: "/account/appointments", permanent: true },
      // P0 §7: health-connections canonical home is /account/connections; the
      // legacy wearables name permanently redirects there.
      { source: "/account/wearables", destination: "/account/connections", permanent: true },
      // D-04A/D-05A (TNM-CRO-01 owner ruling 2026-08-11): compat aliases for
      // the D-04B quick-setup rebuild and the login route. Next forwards the
      // incoming query string to a fixed-path destination automatically —
      // verified against the ruled param set (condition, goal, origin,
      // acquisitionContextId, returnTo) rather than assumed; see
      // e2e/specs/compat-aliases.spec.ts.
      { source: "/quiz", destination: "/quick-setup", permanent: true },
      { source: "/auth", destination: "/login", permanent: true },
    ];
  },
  // next/image through a custom loader (lib/imageLoader.ts — the WHY is
  // documented there). No `remotePatterns`: every photo is same-origin via the
  // /images/* rewrite above, and keeping it that way is what lets a future
  // `img-src 'self'` CSP stay clean. deviceSizes/imageSizes stay at Next's
  // defaults — the loader only annotates the URL, so the candidate list costs
  // markup, not bytes, until the upstream can actually resize.
  images: { loader: "custom", loaderFile: "./lib/imageLoader.ts" },
  // The workspace's shared TS libs use NodeNext ".js" import specifiers that
  // resolve to ".ts" sources (e.g. subscription-rules' `from "./pricing.js"`).
  // Vite/tsx map those automatically; webpack needs an explicit extension alias.
  // (Turbopack has no equivalent, so the storefront builds with --webpack.)
  webpack(config) {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG || "tanmatra",
  project: process.env.SENTRY_PROJECT || "storefront",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
});
