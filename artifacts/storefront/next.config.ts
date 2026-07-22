import type { NextConfig } from "next";

/**
 * Workspace TS packages ship source, not build output, so Next must transpile
 * them. Keep this list tight — every entry is a package the storefront imports
 * directly (the token package for the CSS/values, the catalog for the SSR menu
 * fallback).
 */
const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/tokens", "@workspace/menu-catalog"],
  reactStrictMode: true,
  // Dish imagery is served by the api-server / CDN; explicit dimensions on the
  // <img> keep CLS at zero without pulling in the next/image loader for the
  // skeleton. Revisit with next/image + remotePatterns in a later phase.
  images: { unoptimized: true },
};

export default nextConfig;
