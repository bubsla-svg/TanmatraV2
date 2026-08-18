import type { MetadataRoute } from "next";
import { THEME_COLOR } from "@/lib/stitchRoutes";

// N1.1 — the storefront was never installable: no manifest meant no browser
// "install" prompt and no standalone launch, full stop. icons/ live in
// public/ (not app/, despite sw.js's STATIC_PREFIXES already anticipating an
// "/icons/" path) because only Next's exact-match convention filenames
// (app/icon.png, app/apple-icon.png — handled separately, auto-linked into
// <head>) are served from app/; a manifest-referenced icon has to be a real
// public/ asset or its src 404s.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tanmatra — clinical nutrition, cooked fresh",
    short_name: "Tanmatra",
    description:
      "Lunches built around your macros, delivered to your desk. Real food, no jargon.",
    start_url: "/",
    display: "standalone",
    // Same value the live theme-color meta tag uses (lib/stitchRoutes.ts) —
    // this is what a standalone launch's splash screen and OS chrome paint,
    // so it has to match, not just look close.
    background_color: THEME_COLOR.dark,
    theme_color: THEME_COLOR.dark,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
