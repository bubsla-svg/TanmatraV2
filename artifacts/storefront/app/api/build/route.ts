import { NextResponse } from "next/server";

// Deploy-truth endpoint (TNM-UIF-01 §9 / the TNM-OPS-01 assertion pattern):
// every claim about "what is deployed" is settled by curling this route and
// comparing `sha` to the pushed commit. The legacy SPA serves the same
// contract from its static server (static-server.mjs); this is the rebuild
// storefront's own. Registered as a filesystem route, so it wins over the
// `/api/:path*` -> api-server rewrite (afterFiles) in next.config.
//
// force-dynamic: BUILD_SHA is injected by Cloud Run at *deploy* time
// (`--update-env-vars`), not baked at image build. A statically-optimized GET
// would freeze whatever the builder saw ("unknown") — the exact staleness this
// endpoint exists to expose. VERCEL_GIT_COMMIT_SHA is honoured as a fallback
// so the route stays truthful on any future preview host.
export const dynamic = "force-dynamic";

// Server boot, not per-request: "when was this process's build stamped live."
const bootedAt = new Date().toISOString();

export function GET(): NextResponse {
  return NextResponse.json(
    {
      sha: process.env.BUILD_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown",
      builtAt: bootedAt,
      app: "tanmatra-web",
    },
    { headers: { "cache-control": "no-store" } },
  );
}
