import { NextResponse, type NextRequest } from "next/server";
import { REF_COOKIE_NAME, REF_COOKIE_MAX_AGE_SEC, extractRefFromQuery } from "./lib/refCookie";

/**
 * Next.js App Router middleware (L-1 & L-7).
 * Checks incoming requests for attribution ref query parameters and persists
 * them to a 30-day cookie so server components (like DTR personalized hero on /)
 * and lead/checkout workflows can read them reliably.
 */
export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const ref = extractRefFromQuery(url.searchParams);
  const response = NextResponse.next();

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

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
