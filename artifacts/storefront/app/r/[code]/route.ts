import { NextResponse, type NextRequest } from "next/server";
import { REF_COOKIE_NAME, REF_COOKIE_MAX_AGE_SEC } from "@/lib/refCookie";
import {
  FUNNEL_SESSION_COOKIE_NAME,
  FUNNEL_SESSION_MAX_AGE_SEC,
  isValidFunnelSessionId,
  newFunnelSessionId,
} from "@/lib/acquisition";
import { buildLandingPath, GENERIC_LANDING, normalizeReferralCode } from "@/lib/qrPlacement";

/**
 * `tanmatra.food/r/<code>` — the link a customer shares, and the QR printed on
 * the card that ships with their first box.
 *
 * Deliberately NOT a call to the api-server. A referral link has nothing to
 * resolve: the code IS the payload, and the landing looks up the offer itself
 * (`/api/referral/offer/:code`) so it can state the amount the SERVER owns. Not
 * making a blocking call here keeps the share link the fastest hop in the
 * product, which matters because it is the one people forward over WhatsApp.
 *
 * A malformed code still lands (Law 10) — on the same offer, minus the friend's
 * name and discount, rather than on a 404 that reads as "your friend lied".
 *
 * `src=referral` is stamped so the placement scoreboard can compare word of
 * mouth against paid print on the same axis. Referrals are a channel; without
 * a src they were the one channel with no row.
 */

export const dynamic = "force-dynamic";

/** The channel name a referral scan is counted under. Shaped like a placement
 *  code so it sorts alongside `box` and `gym12` in the same query. */
const REFERRAL_SRC = "referral";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const ref = normalizeReferralCode(code);

  const existingSid = request.cookies.get(FUNNEL_SESSION_COOKIE_NAME)?.value;
  const sessionId = isValidFunnelSessionId(existingSid) ? existingSid : newFunnelSessionId();

  const landing = buildLandingPath(GENERIC_LANDING, { src: REFERRAL_SRC, ref });
  const response = NextResponse.redirect(new URL(landing, request.url), 302);

  const secure = process.env.NODE_ENV === "production";
  if (ref) {
    // The same cookie middleware sets from `?ref=` — set here too so the code
    // survives even if the visitor leaves the landing before the query string
    // has done anything.
    response.cookies.set({
      name: REF_COOKIE_NAME,
      value: ref,
      maxAge: REF_COOKIE_MAX_AGE_SEC,
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
