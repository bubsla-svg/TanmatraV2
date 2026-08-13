import { NextResponse, type NextRequest } from "next/server";
import { REF_COOKIE_NAME, REF_COOKIE_MAX_AGE_SEC, extractRefFromQuery } from "./lib/refCookie";
import { PLAN_CATALOG, planIsSelfServiceLaunchable, type PlanId } from "@workspace/subscription-rules";
import { checkMenuSource } from "./lib/catalog";

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
  // Mirrors app/checkout/page.tsx's redirect target: /plans can't reflect a
  // real cart and has no empty-cart state, where the à-la-carte leg has both.
  if (!id) return NextResponse.redirect(new URL("/checkout?mode=alacarte", request.url));
  if (!planIsSelfServiceLaunchable(id)) {
    return NextResponse.redirect(new URL(`/plan/${id}?waitlist=1`, request.url));
  }
  return null;
}

/** D-06(c): true for the two routes that render fetchMenu() output — the
 *  only place middleware needs to spend a fetch on checkMenuSource(). */
function rendersMenuData(pathname: string): boolean {
  return pathname === "/menu" || pathname.startsWith("/dish/");
}

/**
 * Next.js App Router middleware (L-1 & L-7).
 * Checks incoming requests for attribution ref query parameters and persists
 * them to a 30-day cookie so server components (like DTR personalized hero on /)
 * and lead/checkout workflows can read them reliably. Also short-circuits
 * /checkout's invalid-plan bounce before it ever reaches React — see
 * checkoutPlanRedirect above.
 *
 * On /menu and /dish/[slug] it also stamps `x-menu-source` for ops (D-06c).
 * This has to live here, not in the page: Server Components cannot set
 * outgoing response headers (`next/headers`'s `headers()` is read-only), and
 * middleware is the only App Router layer that can. checkMenuSource() hits
 * the exact URL + revalidate window fetchMenu() itself uses, so it shares
 * Next's fetch cache with the page's own call — a real network round-trip
 * only on a true cache-miss, a cache read otherwise.
 */
export async function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const ref = extractRefFromQuery(url.searchParams);

  const planRedirect = checkoutPlanRedirect(request);
  if (planRedirect) return withRefCookie(planRedirect, ref);

  const response = NextResponse.next();
  if (rendersMenuData(url.pathname)) {
    response.headers.set("x-menu-source", await checkMenuSource());
  }
  return withRefCookie(response, ref);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
