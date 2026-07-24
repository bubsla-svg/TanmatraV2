/**
 * Referral client (Wave-3). GET /referral/me lazily allocates + returns the
 * caller's own code, the current award amounts, and the list of redemptions
 * BY people who used that code (not the caller's own redemption of a
 * friend's code — there's no client-visible flag for that). POST
 * /referral/redeem records a friend's code against the caller as referee;
 * it never issues credit itself — the award is server-owned and fires only
 * inside finalizeOrder, on the referee's first-ever qualifying order (see
 * loyaltyEngine.ts's awardPendingReferralInTx). Kept out of lib/api.ts to
 * stay under the file cap.
 */
import { apiGet, apiPost, type FetchImpl } from "./apiClient";

export interface ReferralRedemption {
  id: number;
  codeId: number;
  referrerUserId: string;
  refereeUserId: string;
  refereeAwardPaise: number;
  referrerAwardPaise: number;
  /** Set only once the referee's first order clears finalizeOrder — null
   *  means still pending. */
  awardedAt: string | null;
  firstOrderId: string | null;
  createdAt: string;
}

export interface ReferralMe {
  code: string;
  awards: { referrerPaise: number; refereePaise: number };
  redemptions: ReferralRedemption[];
}

export function getMyReferral(fetchImpl?: FetchImpl): Promise<ReferralMe> {
  return apiGet("/referral/me", fetchImpl);
}

export interface RedeemReferralResponse {
  redemption: ReferralRedemption;
  awardedPaise: 0;
  status: "pending_first_order";
}

/**
 * Redeem a friend's code. Always comes back pending — no credit lands until
 * the caller's OWN first qualifying order. The server rejects with a typed
 * ApiError: 400 for a caller's own code, 404 for an unknown code, 409 if the
 * caller has already redeemed one before (per-referee, not per-code — a
 * second attempt 409s even against a different code).
 */
export function redeemReferralCode(
  code: string,
  fetchImpl?: FetchImpl,
): Promise<RedeemReferralResponse> {
  return apiPost("/referral/redeem", { code }, fetchImpl);
}
