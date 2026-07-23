import type { NextConfig } from "next";

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
  // Explicit dimensions on the <img> keep CLS at zero without pulling in the
  // next/image loader for the skeleton. Revisit with next/image +
  // remotePatterns in a later phase.
  images: { unoptimized: true },
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

export default nextConfig;
