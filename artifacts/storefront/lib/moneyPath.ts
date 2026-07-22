import {
  createSubscription,
  createRazorpayOrder,
  verifyPayment,
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
