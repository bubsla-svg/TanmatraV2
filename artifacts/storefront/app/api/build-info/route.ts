import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const bootedAt = new Date().toISOString();

export function GET(): NextResponse {
  return NextResponse.json(
    {
      sha: process.env.BUILD_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown",
      builtAt: bootedAt,
      application: "tanmatra-storefront",
      uiGeneration: "stitch-74",
      totalScreens: 74,
      canonicalRoutes: 42,
      stitchCanvas: "dark",
    },
    { headers: { "cache-control": "no-store" } },
  );
}
