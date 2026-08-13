/**
 * ─── Stitch Project & Screen Registry ──────────────────────────────────────
 *
 * Official programmatic mapping of Tanmatra routes to generated Google Stitch
 * UI screens in project 12062470764535558612 ("Tanmatra — Premium Clinical
 * Metabolic OS"). Generated per the Tanmatra Google Stitch SDK Prompt Pack.
 *
 * SPLIT OUT of lib/stitchRoutes.ts (2026-08-13): that file's job is the DARK
 * CANVAS allowlist — which routes paint on #0a0a0a — a runtime concern read on
 * every page load. This registry is design-tool provenance: which generated
 * Stitch screen a route came from. Two different questions that only share a
 * word, and keeping them together pushed the runtime file past the 300-line
 * cap. Nothing in app/ or components/ imports this today; it is documentation
 * with a type.
 */

export interface StitchScreenSpec {
  readonly projectId: string;
  readonly screenId: string;
  readonly title: string;
  readonly route: string;
  readonly category: "design_system" | "route" | "component";
}

export const STITCH_PROJECT_ID = "12062470764535558612" as const;

export const STITCH_SCREEN_REGISTRY: readonly StitchScreenSpec[] = [
  {
    projectId: STITCH_PROJECT_ID,
    screenId: "839f4a92436a4444bda6fabfa07d7a06",
    title: "Tanmatra Design Reference",
    route: "/styleguide?theme=dark",
    category: "design_system",
  },
  {
    projectId: STITCH_PROJECT_ID,
    screenId: "f814ddb11cbb4b17832dba069604e371",
    title: "Tanmatra Design Reference (Light Theme)",
    route: "/styleguide?theme=light",
    category: "design_system",
  },
  {
    projectId: STITCH_PROJECT_ID,
    screenId: "966d396f55ed43ada3e69ff56950d3ef",
    title: "Tanmatra Home: Clinical Feed",
    route: "/",
    category: "route",
  },
  {
    projectId: STITCH_PROJECT_ID,
    screenId: "72d14e82a0064eb398552c2bee5d4682",
    title: "Daily Menu: Clinical Selection",
    route: "/menu",
    category: "route",
  },
  {
    projectId: STITCH_PROJECT_ID,
    screenId: "ef20a9487d414d8aaa48ab69e4b1f22d",
    title: "Dish Detail: Charcoal Smoothie",
    route: "/dish/[slug]",
    category: "route",
  },
  {
    projectId: STITCH_PROJECT_ID,
    screenId: "44267f5a1c8c43f0873fb5ed30fef65d",
    title: "Cart Drawer: Clinical Summary",
    route: "/menu",
    category: "component",
  },
  {
    projectId: STITCH_PROJECT_ID,
    screenId: "866fc4167d9c47709ff6c3465ab63b84",
    title: "Tanmatra Marketplace: Clinical Pantry",
    route: "/marketplace",
    category: "route",
  },
  {
    projectId: STITCH_PROJECT_ID,
    screenId: "8d3c8980a3cc4937b00e062e5d5e554c",
    title: "Subscription Plans: Therapeutic Protocols",
    route: "/plans",
    category: "route",
  },
  {
    projectId: STITCH_PROJECT_ID,
    screenId: "e4be16728fa3442d88c96a63529b1b92",
    title: "Plan Configuration: 5-Day Metabolic Reset",
    route: "/plan/[planId]",
    category: "route",
  },
  {
    projectId: STITCH_PROJECT_ID,
    screenId: "21ee21b9d8e94c98927f921775b8c5f3",
    title: "Build Your Own Plan: Goal Selection",
    route: "/custom-build",
    category: "route",
  },
  {
    projectId: STITCH_PROJECT_ID,
    screenId: "b4f7b93cf4854f5eac4e1afb72efff6f",
    title: "Secure Checkout: Tanmatra OS",
    route: "/checkout",
    category: "route",
  },
  {
    projectId: STITCH_PROJECT_ID,
    screenId: "59aa3123733a4aac84001db8d6032283",
    title: "3-Day Clinical Trial Protocol",
    route: "/trial",
    category: "route",
  },
  {
    projectId: STITCH_PROJECT_ID,
    screenId: "75cf7ca6e32c4596b20c9ef59e0d9f16",
    title: "Meal Planner: Clinical Protocol Active",
    route: "/meal-planner",
    category: "route",
  },
  {
    projectId: STITCH_PROJECT_ID,
    screenId: "f49ace3e5e27464aacca6184b0432059",
    title: "Account Hub: Clinical Profile",
    route: "/account",
    category: "route",
  },
  {
    projectId: STITCH_PROJECT_ID,
    screenId: "2b29b0174cfb46b1826594928710885e",
    title: "Health Connections: Apple Health & Android Sync",
    route: "/account/connections",
    category: "route",
  },
  {
    projectId: STITCH_PROJECT_ID,
    screenId: "43952f75a4c649be9f2e947d011b6bc0",
    title: "Clinical Care: Metabolic Protocols",
    route: "/care",
    category: "route",
  },
] as const;

/**
 * Looks up the official generated Stitch screen specification for a given route.
 * Handles dynamic segments (e.g. "/dish/wild-salmon-bowl" -> "/dish/[slug]").
 */
export function getStitchScreenForRoute(pathname: string): StitchScreenSpec | undefined {
  const path = pathname.split(/[?#]/)[0] ?? "";
  const exact = STITCH_SCREEN_REGISTRY.find((s) => s.route === path);
  if (exact) return exact;

  if (path.startsWith("/dish/") || path.startsWith("/menu/")) {
    return STITCH_SCREEN_REGISTRY.find((s) => s.route === "/dish/[slug]");
  }
  if (path.startsWith("/plan/")) {
    return STITCH_SCREEN_REGISTRY.find((s) => s.route === "/plan/[planId]");
  }
  if (path.startsWith("/care/") || path.startsWith("/clinical")) {
    return STITCH_SCREEN_REGISTRY.find((s) => s.route === "/care");
  }
  if (path === "/account/wearables") {
    return STITCH_SCREEN_REGISTRY.find((s) => s.route === "/account/connections");
  }
  return undefined;
}

