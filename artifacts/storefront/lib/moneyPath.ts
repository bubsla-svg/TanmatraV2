import {
  createAlacarteOrder,
  createSubscription,
  createRazorpayOrder,
  verifyPayment,
  type AlacarteOrderInput,
  type AlacarteOrderResponse,
  type CreateSubscriptionInput,
} from "./api";

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
export async function runCheckout(
  params: { subscription: CreateSubscriptionInput; razorpay: RazorpayAdapter },
  deps: MoneyPathDeps = DEFAULT_DEPS,
): Promise<CheckoutResult> {
  const created = await deps.createSubscription(params.subscription);
  const orderId = created.subscription.externalOrderId ?? `sub-${created.subscription.id}`;

  const order = await deps.createRazorpayOrder({
    orderId,
    subscriptionId: created.subscription.id,
  });

  const paid = await params.razorpay.open(order);

  const verified = await deps.verifyPayment({
    orderId,
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
  },
  deps: AlacartePathDeps = ALC_DEFAULT_DEPS,
): Promise<AlacarteCheckoutResult> {
  const created = await deps.createAlacarteOrder(params.order);
  params.onCreated?.(created);
  return finishAlacartePayment(created, params.razorpay, deps);
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
): Promise<AlacarteCheckoutResult> {
  const rzpOrder = await deps.createRazorpayOrder({ orderId: order.orderId });

  const paid = await razorpay.open(rzpOrder);

  const verified = await deps.verifyPayment({
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
