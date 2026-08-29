/**
 * Public referral-offer lookup for the acquisition landing.
 *
 * A cold visitor arriving on `/r/<code>` (or on a placement whose print run
 * carried a referral) is shown who sent them and what they get BEFORE any ask.
 * Law 1 — and the amount has to be the SERVER's, because it is the same
 * `getLoyaltyConstantsSnapshot()` figure the redemption row is later written
 * with. A landing that stated a number the browser made up could promise
 * something the ledger never credits.
 *
 * NEVER THROWS. An unknown code, a rate limit, a dead API — all of them return
 * `null`, and the landing renders its standing offer with no referral line at
 * all. A friend's bad link must not cost the visit (Law 10).
 *
 * NO "@/" ALIAS IMPORTS (storefront lib rule).
 */
import { normalizeReferralCode } from "./qrPlacement";

export interface ReferralOffer {
  valid: boolean;
  code?: string;
  /** First name only — enough for "Rohit sent you …", nothing more. Absent
   *  when the referrer never filled one in; render "a friend" then. */
  referrerFirstName?: string;
  /** What the referee is credited, in paise. Server-owned. */
  refereeAwardPaise: number;
}

const OFFER_TIMEOUT_MS = 2000;

export async function fetchReferralOffer(
  rawCode: string,
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ReferralOffer | null> {
  const code = normalizeReferralCode(rawCode);
  if (!code) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OFFER_TIMEOUT_MS);
  try {
    const res = await fetchImpl(
      `${baseUrl}/api/referral/offer/${encodeURIComponent(code)}`,
      { cache: "no-store", signal: controller.signal },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as Partial<ReferralOffer>;
    if (typeof body.refereeAwardPaise !== "number" || body.refereeAwardPaise < 0) return null;
    return {
      valid: body.valid === true,
      ...(typeof body.code === "string" ? { code: body.code } : {}),
      ...(typeof body.referrerFirstName === "string" && body.referrerFirstName.trim()
        ? { referrerFirstName: body.referrerFirstName.trim() }
        : {}),
      refereeAwardPaise: body.refereeAwardPaise,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
