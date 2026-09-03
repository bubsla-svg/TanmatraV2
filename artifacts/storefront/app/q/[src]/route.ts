import { NextResponse, type NextRequest } from "next/server";
import {
  FUNNEL_SESSION_COOKIE_NAME,
  FUNNEL_SESSION_MAX_AGE_SEC,
  SRC_COOKIE_NAME,
  SRC_COOKIE_MAX_AGE_SEC,
  isValidFunnelSessionId,
  newFunnelSessionId,
} from "@/lib/acquisition";
import { buildLandingPath, GENERIC_LANDING, normalizeReferralCode } from "@/lib/qrPlacement";
import { resolveScan } from "@/lib/qrScanApi";

/**
 * `tanmatra.food/q/<src>` — what every printed QR in the wild actually points
 * at. Resolve the placement, log the scan, 302 to the landing with `src`
 * attached. One hop, no interstitial, no app-store detour: a cold scanner who
 * has to install something is gone.
 *
 * ALWAYS REDIRECTS. Unknown code, retired placement, api-server down, garbage
 * in the path — every one of them ends on the generic landing, which sells the
 * same offer (Law 10). There is no branch here that renders an error, because
 * there is no error a person holding a phone in front of a poster can act on.
 *
 * The redirect is 302, not 308: the destination is a mutable row in
 * `qr_placements` and the entire point of the indirection is that it can be
 * repointed. A permanent redirect would be cached by browsers and proxies and
 * would outlive the campaign it pointed at — permanently, on hardware we do
 * not control.
 */

// Never prerendered, never cached: this handler writes a scan row and mints a
// per-visit id, both of which are wrong if replayed from a cache.
export const dynamic = "force-dynamic";

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:3000";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ src: string }> },
) {
  const { src } = await params;
  const url = request.nextUrl;

  // Reuse the visit id when one exists so a second scan in the same session
  // (a poster, then the box it arrived in) joins onto the same funnel rows
  // instead of forking into two visits that each look like a half-conversion.
  const existingSid = request.cookies.get(FUNNEL_SESSION_COOKIE_NAME)?.value;
  const sessionId = isValidFunnelSessionId(existingSid) ? existingSid : newFunnelSessionId();

  // A referral can ride on a printed code (a card that is both an invite and a
  // placement). `tnm_ref` is the storefront's existing 30-day attribution
  // cookie — read it as the fallback so a scan that follows a referral link
  // still carries the friend's code into the landing's price.
  const refParam = url.searchParams.get("ref") ?? request.cookies.get("tnm_ref")?.value ?? null;
  const ref = refParam ? normalizeReferralCode(refParam) : null;

  const resolution = await resolveScan(
    { code: src, ref, sessionId },
    API_BASE,
    fetch,
  );

  const landing = buildLandingPath(resolution.destination || GENERIC_LANDING, {
    src: resolution.src,
    ref,
  });
  const response = NextResponse.redirect(new URL(landing, request.url), 302);

  const secure = process.env.NODE_ENV === "production";
  if (resolution.src) {
    response.cookies.set({
      name: SRC_COOKIE_NAME,
      value: resolution.src,
      maxAge: SRC_COOKIE_MAX_AGE_SEC,
      path: "/",
      sameSite: "lax",
      secure,
    });
  }
  response.cookies.set({
    name: FUNNEL_SESSION_COOKIE_NAME,
    value: sessionId,
    maxAge: FUNNEL_SESSION_MAX_AGE_SEC,
    path: "/",
    sameSite: "lax",
    secure,
  });
  return response;
}
