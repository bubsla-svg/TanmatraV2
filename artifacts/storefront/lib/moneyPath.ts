import {
  createAlacarteOrder,
  createSubscription,
  createRazorpayOrder,
  verifyPayment,
  type AlacarteOrderInput,
  type AlacarteOrderResponse,
  type CreateSubscriptionInput,
} from "./api";
import { verifyWithRetry, type PaidFacts } from "./verifyRetry";

// The post-capture verify concern (bounded retry + the standalone
// retryVerifyPayment recovery call) lives in ./verifyRetry — re-exported here
// so `@/lib/moneyPath` stays the single import surface for the money path.
export {
  VERIFY_ATTEMPTS,
  isRetryableVerifyError,
  verifyWithRetry,
  retryVerifyPayment,
  type PaidFacts,
  type VerifiedPayment,
} from "./verifyRetry";

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
  /** True when the server settled the first cycle entirely from credit at
   *  creation (chargePaise === 0) — see finishPlanPayment. Absent/false is
   *  the safe default: always pay via the gateway unless the server
   *  explicitly says otherwise. */
  settled?: boolean;
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
    /** Fired at the same instant as onVerifying, with the verify input — see
     *  finishPlanPayment's onCaptured for the full rationale. */
    onCaptured?: (facts: PaidFacts) => void;
    /** Idempotency key for the CREATE step, stable across retries of this
     *  checkout attempt so a network retry replays the original subscription
     *  instead of creating a second one. See api.ts createSubscription. */
    idempotencyKey?: string;
  },
  deps: MoneyPathDeps = DEFAULT_DEPS,
): Promise<CheckoutResult> {
  const created = await deps.createSubscription(
    params.subscription,
    undefined,
    params.idempotencyKey,
  );
  const ref: PlanOrderRef = {
    orderId: created.subscription.externalOrderId ?? `sub-${created.subscription.id}`,
    subscriptionId: created.subscription.id,
    creditAppliedPaise: created.creditAppliedPaise ?? 0,
    settled: created.settled === true,
  };
  params.onCreated?.(ref);
  return finishPlanPayment(ref, params.razorpay, deps, {
    onVerifying: params.onVerifying,
    onCaptured: params.onCaptured,
  });
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
    /** Fired at the SAME instant as onVerifying, with the verify input. Keep
     *  this around (e.g. in a ref): if verifyWithRetry's bounded retries are
     *  exhausted and this promise still rejects, the caller has already-paid
     *  facts to retry verify alone via {@link retryVerifyPayment} — never
     *  re-run createRazorpayOrder/razorpay.open for a captured payment. */
    onCaptured?: (facts: PaidFacts) => void;
  },
): Promise<CheckoutResult> {
  // §12 (docs/reconciliation): a verified zero-charge settlement must never
  // create a Razorpay order — POST /payments/razorpay/order 409s outright
  // for one (DEF-RECON-ZEROPAYABLE-001). ref.settled is server-computed
  // (moneyPath's createSubscription call, above) and only ever true when
  // credit fully covered the first cycle at creation, so this order's
  // status is already "preparing" — nothing left to verify against the
  // gateway. The confirmation page (goToConfirmation → /order/confirmed)
  // fetches the order's authoritative status itself; no need to duplicate
  // that fetch here.
  if (ref.settled) {
    return { orderId: ref.orderId, status: "preparing" };
  }

  const order = await deps.createRazorpayOrder({
    orderId: ref.orderId,
    subscriptionId: ref.subscriptionId,
  });

  const paid = await razorpay.open(order);
  const facts: PaidFacts = {
    orderId: ref.orderId,
    razorpayPaymentId: paid.razorpayPaymentId,
    razorpayOrderId: paid.razorpayOrderId,
    razorpaySignature: paid.razorpaySignature,
  };
  opts?.onVerifying?.();
  opts?.onCaptured?.(facts);

  const verified = await verifyWithRetry(deps.verifyPayment, facts);

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
    /** Fired at the same instant as onVerifying, with the verify input — see
     *  finishPlanPayment's onCaptured for the full rationale. */
    onCaptured?: (facts: PaidFacts) => void;
  },
  deps: AlacartePathDeps = ALC_DEFAULT_DEPS,
): Promise<AlacarteCheckoutResult> {
  const created = await deps.createAlacarteOrder(params.order);
  params.onCreated?.(created);
  return finishAlacartePayment(created, params.razorpay, deps, {
    onVerifying: params.onVerifying,
    onCaptured: params.onCaptured,
  });
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
    /** Fired at the same instant as onVerifying, with the verify input — see
     *  finishPlanPayment's onCaptured for the full rationale. */
    onCaptured?: (facts: PaidFacts) => void;
  },
): Promise<AlacarteCheckoutResult> {
  const rzpOrder = await deps.createRazorpayOrder({ orderId: order.orderId });

  const paid = await razorpay.open(rzpOrder);
  const facts: PaidFacts = {
    orderId: order.orderId,
    razorpayPaymentId: paid.razorpayPaymentId,
    razorpayOrderId: paid.razorpayOrderId,
    razorpaySignature: paid.razorpaySignature,
  };
  opts?.onVerifying?.();
  opts?.onCaptured?.(facts);

  const verified = await verifyWithRetry(deps.verifyPayment, facts);

  return {
    orderId: verified.orderId,
    status: verified.status,
    totalPaise: order.totalPaise,
    etaMinutes: order.etaMinutes,
  };
}
