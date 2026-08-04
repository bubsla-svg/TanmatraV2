import {
  createAlacarteOrder,
  createSubscription,
  createRazorpayOrder,
  verifyPayment,
  type AlacarteOrderInput,
  type AlacarteOrderResponse,
  type CreateSubscriptionInput,
} from "./api";
import { ApiError } from "./apiClient";

// ── Verify retry ─────────────────────────────────────────────────────────────
//
// The verify step is the ONE place a transient failure costs more than an
// error message: it runs in the seconds AFTER Razorpay has captured the
// money. A network drop there used to reject all the way up as generic
// "Something went wrong. Please try again." — and the component retry
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
  input: Parameters<typeof verifyPayment>[0],
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
 * The browser Razorpay adapter — opens the UPI/checkout modal and resolves with
 * the payment ids the server needs to verify the signature, or rejects if the
 * user dismisses it. Supplied by the live integration (Razorpay checkout.js);
 * absent in the skeleton, which is why the live path is flag-gated. The adapter
 * never sees or sends an amount — the server-created order carries it.
 */
export interface RazorpayAdapter {
  open(order: {
    razorpayOrderId: string;
    amount: number;
    currency: string;
    keyId: string;
  }): Promise<{
    razorpayPaymentId: string;
    razorpayOrderId: string;
    razorpaySignature: string;
  }>;
}

export interface CheckoutResult {
  orderId: string;
  status: string;
  autopayDisclaimer?: string;
}

/** Injectable seam so the sequence is testable with fakes. */
export interface MoneyPathDeps {
  createSubscription: typeof createSubscription;
  createRazorpayOrder: typeof createRazorpayOrder;
  verifyPayment: typeof verifyPayment;
}

const DEFAULT_DEPS: MoneyPathDeps = { createSubscription, createRazorpayOrder, verifyPayment };

/**
 * The money path, in the verified order: create the plan-v2 subscription →
 * create the Razorpay order for its first-cycle order (`sub-<id>`) → open the
 * browser Razorpay modal → verify the signature server-side. Pure orchestration
 * over an injected api + adapter, so it is unit-testable without a gateway. The
 * server owns the amount at every step; this never sends a price.
 *
 * Prerequisite (not assembled here): an authenticated session from the OTP
 * flow, plus the full `subscription` payload (address + members). See
 * docs/LIVE-CUTOVER.md for the remaining client integration.
 */
/** The created subscription's payable order — captured before payment so a
 *  retry after a dismissed modal RESUMES on the same subscription instead of
 *  creating a second one. */
export interface PlanOrderRef {
  orderId: string;
  subscriptionId: number;
  /** What the server actually redeemed from the credit ledger against this
   *  subscription's first bill (0 when the account had no balance). Optional
   *  so a caller resuming payment with a bare {orderId, subscriptionId} still
   *  type-checks. */
  creditAppliedPaise?: number;
}

export async function runCheckout(
  params: {
    subscription: CreateSubscriptionInput;
    razorpay: RazorpayAdapter;
    /** Fired with the created subscription's order the instant it exists —
     *  BEFORE any payment step — so the caller can resume payment on a retry. */
    onCreated?: (ref: PlanOrderRef) => void;
    /** Fired when the modal resolves paid and verify begins (see finishPlanPayment). */
    onVerifying?: () => void;
  },
  deps: MoneyPathDeps = DEFAULT_DEPS,
): Promise<CheckoutResult> {
  const created = await deps.createSubscription(params.subscription);
  const ref: PlanOrderRef = {
    orderId: created.subscription.externalOrderId ?? `sub-${created.subscription.id}`,
    subscriptionId: created.subscription.id,
    creditAppliedPaise: created.creditAppliedPaise ?? 0,
  };
  params.onCreated?.(ref);
  return finishPlanPayment(ref, params.razorpay, deps, { onVerifying: params.onVerifying });
}

/**
 * The payment leg for an ALREADY-created subscription: create the Razorpay order
 * for its first cycle → open the modal → verify. Shared by runCheckout and used
 * directly to resume payment after a dismissed modal (so no duplicate
 * subscription is created). The server owns the amount; this sends only ids.
 */
export async function finishPlanPayment(
  ref: PlanOrderRef,
  razorpay: RazorpayAdapter,
  deps: Pick<MoneyPathDeps, "createRazorpayOrder" | "verifyPayment"> = DEFAULT_DEPS,
  opts?: {
    /** Fired the instant the modal resolves — money is CAPTURED, verify is
     *  starting. Lets the caller swap its busy copy to a confirming state so
     *  a slow verify never looks like a failed payment. */
    onVerifying?: () => void;
  },
): Promise<CheckoutResult> {
  const order = await deps.createRazorpayOrder({
    orderId: ref.orderId,
    subscriptionId: ref.subscriptionId,
  });

  const paid = await razorpay.open(order);
  opts?.onVerifying?.();

  const verified = await verifyWithRetry(deps.verifyPayment, {
    orderId: ref.orderId,
    razorpayPaymentId: paid.razorpayPaymentId,
    razorpayOrderId: paid.razorpayOrderId,
    razorpaySignature: paid.razorpaySignature,
  });

  return {
    orderId: verified.orderId,
    status: verified.status,
    autopayDisclaimer: verified.autopayDisclaimer,
  };
}

// ── À-la-carte (SF-05 / CUJ-01) ──────────────────────────────────────────────

export interface AlacartePathDeps {
  createAlacarteOrder: typeof createAlacarteOrder;
  createRazorpayOrder: typeof createRazorpayOrder;
  verifyPayment: typeof verifyPayment;
}

const ALC_DEFAULT_DEPS: AlacartePathDeps = {
  createAlacarteOrder,
  createRazorpayOrder,
  verifyPayment,
};

export interface AlacarteCheckoutResult extends CheckoutResult {
  /** The SERVER's billed total — the only number the UI may show. */
  totalPaise: number;
  etaMinutes: number;
}

/**
 * The à-la-carte money path, same verified order as the plan path: create the
 * guest order (server prices it; DPDP consent + serviceable pincode enforced
 * server-side) → create the Razorpay order for it (server bills the DB row's
 * amount — the body carries only the order id) → open the modal → verify the
 * signature. The client never sends a price at any step; a dismissed modal
 * rejects before verify is ever called.
 */
export async function runAlacarteCheckout(
  params: {
    order: AlacarteOrderInput;
    razorpay: RazorpayAdapter;
    /** Fired with the server order the instant it is created — BEFORE any
     *  payment step. Lets the caller persist the id so a retry after a
     *  dismissed modal RESUMES payment on the same order instead of creating a
     *  second one (the server 409s a reused externalOrderId, so a re-create is
     *  never the right retry). */
    onCreated?: (order: AlacarteOrderResponse) => void;
    /** Fired when the modal resolves paid and verify begins (see finishAlacartePayment). */
    onVerifying?: () => void;
  },
  deps: AlacartePathDeps = ALC_DEFAULT_DEPS,
): Promise<AlacarteCheckoutResult> {
  const created = await deps.createAlacarteOrder(params.order);
  params.onCreated?.(created);
  return finishAlacartePayment(created, params.razorpay, deps, { onVerifying: params.onVerifying });
}

/**
 * The payment leg on its own: create the Razorpay order for an ALREADY-created
 * guest order → open the modal → verify. Shared by runAlacarteCheckout and used
 * directly to RESUME payment for an order a prior attempt already created (so a
 * dismissed modal never spawns a duplicate row). Still price-free — only the
 * server order id threads through.
 */
export async function finishAlacartePayment(
  order: Pick<AlacarteOrderResponse, "orderId" | "totalPaise" | "etaMinutes">,
  razorpay: RazorpayAdapter,
  deps: Pick<AlacartePathDeps, "createRazorpayOrder" | "verifyPayment"> = ALC_DEFAULT_DEPS,
  opts?: {
    /** Fired the instant the modal resolves — money is CAPTURED, verify is
     *  starting (see finishPlanPayment for the full rationale). */
    onVerifying?: () => void;
  },
): Promise<AlacarteCheckoutResult> {
  const rzpOrder = await deps.createRazorpayOrder({ orderId: order.orderId });

  const paid = await razorpay.open(rzpOrder);
  opts?.onVerifying?.();

  const verified = await verifyWithRetry(deps.verifyPayment, {
    orderId: order.orderId,
    razorpayPaymentId: paid.razorpayPaymentId,
    razorpayOrderId: paid.razorpayOrderId,
    razorpaySignature: paid.razorpaySignature,
  });

  return {
    orderId: verified.orderId,
    status: verified.status,
    totalPaise: order.totalPaise,
    etaMinutes: order.etaMinutes,
  };
}
