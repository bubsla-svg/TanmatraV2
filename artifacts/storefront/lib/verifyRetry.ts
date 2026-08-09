import { verifyPayment } from "./api";
import { ApiError } from "./apiClient";

// ── Confirming a CAPTURED payment ────────────────────────────────────────────
//
// Everything in this file runs in the seconds AFTER Razorpay has taken the
// customer's money, which is the one window where a transient failure costs
// more than an error message. Split out of moneyPath.ts (which keeps the
// create → pay → verify orchestration) because it is its own concern and the
// file-cap gate is a fair proxy for that; moneyPath re-exports all of it, so
// importers are unaffected.
//
// A network drop here used to reject all the way up as a generic "Something
// went wrong. Please try again." — and the component retry
// (finishPlanPayment / finishAlacartePayment) re-runs createRazorpayOrder and
// REOPENS THE PAY MODAL at a customer who has already paid.
//
// Retrying verify in place is safe because the server made it idempotent by
// design: an already-confirmed order returns `{ok:true}` (webhook-race
// handling in payments.ts), the signature check is deterministic, and the
// request carries only ids — no amount. So: retry transport failures and 5xx,
// NEVER 4xx — an invalid signature does not become valid by asking again.

/** Total attempts for the verify step (1 original + 2 retries). */
export const VERIFY_ATTEMPTS = 3;
/** Backoff before attempts 2 and 3 — short, because the customer is watching. */
const VERIFY_BACKOFF_MS = [400, 1200] as const;

type Sleep = (ms: number) => Promise<void>;
const realSleep: Sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The signature facts Razorpay's modal resolves with — everything
 *  `/payments/razorpay/verify` needs, and nothing `createRazorpayOrder` /
 *  `razorpay.open` would need to run again. Callers keep these around (e.g. in
 *  a ref) so a post-capture verify failure can be retried with
 *  {@link retryVerifyPayment} WITHOUT re-opening the pay modal. */
export type PaidFacts = Parameters<typeof verifyPayment>[0];

/** The confirmed outcome of a verify call. */
export interface VerifiedPayment {
  orderId: string;
  status: string;
  autopayDisclaimer?: string;
}

/** A verify failure worth retrying: the network died before a response (fetch
 *  rejects with a non-ApiError) or the server blipped (5xx). A 4xx is a real
 *  VERDICT and must surface immediately. */
export function isRetryableVerifyError(e: unknown): boolean {
  return e instanceof ApiError ? e.status >= 500 : true;
}

/** Run the verify call with bounded in-place retry. Exported for tests;
 *  `sleep` is injectable so backoff is testable without real waits. */
export async function verifyWithRetry(
  verify: typeof verifyPayment,
  input: PaidFacts,
  sleep: Sleep = realSleep,
): ReturnType<typeof verifyPayment> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= VERIFY_ATTEMPTS; attempt++) {
    try {
      return await verify(input);
    } catch (e) {
      lastErr = e;
      if (!isRetryableVerifyError(e) || attempt === VERIFY_ATTEMPTS) throw e;
      await sleep(VERIFY_BACKOFF_MS[attempt - 1] ?? VERIFY_BACKOFF_MS[1]);
    }
  }
  throw lastErr; // Unreachable — the loop always returns or throws.
}

/**
 * Retry verify ALONE, for a payment already captured by Razorpay (facts from
 * finishPlanPayment's / finishAlacartePayment's onCaptured). Use this — never
 * createRazorpayOrder + razorpay.open again — when verifyWithRetry's bounded
 * in-flow retries were exhausted: the customer's card may already be charged,
 * and /payments/razorpay/verify is idempotent (an already-confirmed order
 * returns {ok:true} regardless of how many times it's asked), so re-asking it
 * later is always safe. Re-opening the modal instead would risk a second,
 * genuine charge for the same order.
 */
export async function retryVerifyPayment(
  facts: PaidFacts,
  deps: { verifyPayment: typeof verifyPayment } = { verifyPayment },
): Promise<VerifiedPayment> {
  const verified = await verifyWithRetry(deps.verifyPayment, facts);
  return {
    orderId: verified.orderId,
    status: verified.status,
    autopayDisclaimer: verified.autopayDisclaimer,
  };
}
