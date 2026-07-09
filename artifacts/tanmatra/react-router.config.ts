import type { Config } from "@react-router/dev/config";
import { ALL_PRERENDER_PATHS } from "./src/lib/prerenderPaths";

export default {
  appDirectory: "src",
  // SPA mode: React Router renders entirely client-side. Pre-rendering still
  // works for the listed routes. Setting ssr:true with Firebase static hosting
  // caused checkout crashes because Firebase serves the home-page SSR HTML for
  // unknown routes, and React Router v7 then tried to fetch /checkout.data
  // from a server that doesn't exist — Firebase returned HTML (200 OK), and
  // the JSON.parse of that HTML threw: "Unexpected token '<', <!DOCTYPE..."
  ssr: false,
  // Derived from bundled catalogs (dishes, team, RDs, plans) plus the
  // marketing/legal/discovery pages and noindex shells for personalized
  // routes — see src/lib/prerenderPaths.ts. scripts/generate-sitemap.mjs
  // builds sitemap.xml from the same output, so the two can't drift.
  prerender: ALL_PRERENDER_PATHS,
} satisfies Config;
