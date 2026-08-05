import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    sha: process.env.BUILD_SHA || process.env.NEXT_PUBLIC_BUILD_SHA || "a64fad66",
    application: "tanmatra-storefront",
    uiGeneration: "stitch-74-production-refactor",
    totalScreens: 74,
    canonicalRoutes: 42,
    stitchCanvas: "dark",
    timestamp: new Date().toISOString(),
  });
}
