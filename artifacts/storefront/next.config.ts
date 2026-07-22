import type { NextConfig } from "next";

/**
 * Workspace TS packages ship source, not build output, so Next must transpile
 * them. Keep this list tight — every entry is a package the storefront imports
 * directly (the token package for the CSS/values, the catalog for the SSR menu
 * fallback).
 */
const nextConfig: NextConfig = {
  transpilePackages: [
    "@workspace/tokens",
    "@workspace/menu-catalog",
    "@workspace/subscription-rules",
  ],
  reactStrictMode: true,
  // Dish imagery is served by the api-server / CDN; explicit dimensions on the
  // <img> keep CLS at zero without pulling in the next/image loader for the
  // skeleton. Revisit with next/image + remotePatterns in a later phase.
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
