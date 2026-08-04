import { NextResponse, type NextRequest } from "next/server";
import { REF_COOKIE_NAME, REF_COOKIE_MAX_AGE_SEC, extractRefFromQuery } from "./lib/refCookie";
import { PLAN_CATALOG, planIsSelfServiceLaunchable, type PlanId } from "@workspace/subscription-rules";

function withRefCookie(response: NextResponse, ref: string | null): NextResponse {
  if (ref) {
    response.cookies.set({
      name: REF_COOKIE_NAME,
      value: ref,
      maxAge: REF_COOKIE_MAX_AGE_SEC,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
  return response;
}

/**
 * /checkout's own invalid/non-launchable-plan redirects (app/checkout/page.tsx)
 * are correct but arrive too late: that page is an async Server Component
 * with a sibling loading.tsx, so Next always streams the "Loading checkout…"
 * skeleton as the FIRST chunk of the response before the page function (and
 * its `redirect()` call) has even run — a real, measured flash-then-bounce
 * for a visitor who was never going to see checkout at all. Running the exact
 * same two checks here, in middleware, happens before any React rendering or
 * Suspense boundary exists, so an invalid `plan` redirects instantly with no
 * loading UI. `mode=alacarte` (guest checkout, no plan) is exempt — it is a
 * genuinely different, valid path this check doesn't apply to.
 */
function checkoutPlanRedirect(request: NextRequest): NextResponse | null {
  const url = request.nextUrl;
  if (url.pathname !== "/checkout" || url.searchParams.get("mode") === "alacarte") return null;

  const plan = url.searchParams.get("plan");
  const id = plan && plan in PLAN_CATALOG ? (plan as PlanId) : null;
  if (!id) return NextResponse.redirect(new URL("/plans", request.url));
  if (!planIsSelfServiceLaunchable(id)) {
    return NextResponse.redirect(new URL(`/plan/${id}?waitlist=1`, request.url));
  }
  return null;
}

/**
 * Next.js App Router middleware (L-1 & L-7).
 * Checks incoming requests for attribution ref query parameters and persists
 * them to a 30-day cookie so server components (like DTR personalized hero on /)
 * and lead/checkout workflows can read them reliably. Also short-circuits
 * /checkout's invalid-plan bounce before it ever reaches React — see
 * checkoutPlanRedirect above.
 */
export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const ref = extractRefFromQuery(url.searchParams);

  const planRedirect = checkoutPlanRedirect(request);
  if (planRedirect) return withRefCookie(planRedirect, ref);

  return withRefCookie(NextResponse.next(), ref);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
