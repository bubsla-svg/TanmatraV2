/**
 * The three secondary money paths, expressed as PurchaseSteps so they run on
 * the SAME checkout page, through the same state machine, as the plan and
 * à-la-carte legs.
 *
 * Each factory is a pure function over an injectable `fetchImpl`, so the whole
 * create → pay → verify → recover sequence is node-testable with fakes and no
 * gateway. The client never authors an amount at any step: every one of these
 * sends ids only, and the server prices, bills and verifies.
 */

import type { FetchImpl } from "./apiClient";
import type { PaidFacts, RazorpayAdapter } from "./moneyPath";
import { withVerifyRetry } from "./verifyRetry";
import { retryVerifyPayment } from "./moneyPath";
import {
  checkout as marketplaceCheckout,
  finishMarketplacePayment,
  type MarketplaceItem,
  type MarketplaceOrder,
} from "./marketplaceApi";
import {
  checkoutPremium,
  getPremium,
  verifyPremium,
  type PremiumCheckoutOrder,
} from "./premiumApi";
import {
  checkoutAppointment,
  getMyAppointments,
  verifyAppointment,
  type Appointment,
} from "./rdBookingApi";

/**
 * A money path reduced to the four steps that actually differ between them.
 * Everything else — the auth gate, the busy/verifying split, what a dismissed
 * modal means, and above all what happens when money is captured but verify
 * never confirms — is identical for every purchase and lives in
 * components/checkout/PurchaseRunner.tsx.
 */
export interface PurchaseSteps<H> {
  /** Create the payable thing server-side. Called AT MOST ONCE per attempt —
   *  a retry resumes on the stored handle, never creates a second one. */
  create(): Promise<H>;
  /**
   * Gateway order → modal → verify, for an already-created handle. `onCaptured`
   * MUST be called the instant the modal resolves — that is the runner's only
   * signal that money has actually moved, and what stops a later failure from
   * re-offering the pay CTA. Paths whose verify endpoint is idempotent pass the
   * signature facts along so recovery can re-ask it; the rest call it bare.
   */
  pay(handle: H, razorpay: RazorpayAdapter, onCaptured: (facts?: PaidFacts) => void): Promise<void>;
  /** Ask the SERVER whether this purchase already landed — the only safe
   *  recovery once money is captured. */
  settled(handle: H | null, captured: PaidFacts | null): Promise<boolean>;
  /** Where a confirmed purchase lands. */
  destination(handle: H | null): string;
  /** Copy for the pay CTA in its resting state. */
  payLabel: string;
}

// ── Pantry / marketplace ─────────────────────────────────────────────────────

/**
 * A single pantry item, bought on its own. `idempotencyKey` is minted ONCE per
 * checkout attempt by the caller and held across retries: `payForMarketplace`
 * minted a fresh one per call, so a create retried after a dropped connection
 * was a second order, a second stock decrement and a second charge.
 */
export function marketplaceSteps(
  item: Pick<MarketplaceItem, "id" | "name">,
  qty: number,
  idempotencyKey: string,
  payLabel: string,
  fetchImpl?: FetchImpl,
): PurchaseSteps<MarketplaceOrder> {
  return {
    payLabel,
    async create() {
      const { order } = await marketplaceCheckout(
        {
          idempotencyKey,
          items: [{ itemId: item.id, qty }],
          deliveryMode: "ship",
          bundleWithOrderId: null,
        },
        fetchImpl ?? fetch,
      );
      return order;
    },
    pay(order, razorpay, onCaptured) {
      return finishMarketplacePayment(order, razorpay, { onCaptured }, fetchImpl).then(() => undefined);
    },
    async settled(_order, captured) {
      // The shared `/payments/razorpay/verify` IS idempotent — an
      // already-confirmed order answers {ok:true} however often it is asked —
      // so re-asking it is both safe and authoritative here.
      if (!captured) return false;
      await retryVerifyPayment(captured);
      return true;
    },
    destination(order) {
      return order
        ? `/order/confirmed/${encodeURIComponent(order.externalOrderId)}`
        : "/account/orders";
    },
  };
}

// ── Premium membership ───────────────────────────────────────────────────────

/**
 * Tanmatra Premium. `POST /premium/checkout` is server-idempotent (a pending
 * row that already carries a gateway order is reused, never re-ordered), so
 * `create` is safe to reach twice.
 */
export function premiumSteps(payLabel: string, fetchImpl?: FetchImpl): PurchaseSteps<PremiumCheckoutOrder> {
  return {
    payLabel,
    create() {
      return checkoutPremium(fetchImpl);
    },
    async pay(order, razorpay, onCaptured) {
      const paid = await razorpay.open(order);
      // Bare: `/premium/verify` takes the razorpay payload, not the shared
      // verify's {orderId, …} facts, and there is no Tanmatra order id to
      // honestly put in one. The runner only needs to know money moved.
      onCaptured();
      // Previously a single naked attempt: a blip here left the customer
      // charged, un-activated, and looking at a re-enabled Join button.
      await withVerifyRetry((p) => verifyPremium(p, fetchImpl), paid);
    },
    async settled() {
      // `/premium/verify` binds on a pending_payment guard and answers a
      // replay with 409, so re-verifying cannot distinguish "already active"
      // from "never applied". The membership read can.
      const me = await getPremium(fetchImpl);
      return me.isPremium === true;
    },
    destination() {
      return "/premium";
    },
  };
}

// ── RD consult ───────────────────────────────────────────────────────────────

/**
 * A paid dietitian consult, for an appointment whose slot is ALREADY held. The
 * booking (which reserves the slot) stays on the RD's page; only the payment
 * moves here, so `create` has nothing left to create.
 */
export function consultSteps(
  appointment: Appointment,
  payLabel: string,
  fetchImpl?: FetchImpl,
): PurchaseSteps<Appointment> {
  return {
    payLabel,
    create() {
      return Promise.resolve(appointment);
    },
    async pay(appt, razorpay, onCaptured) {
      const order = await checkoutAppointment(appt.id, fetchImpl);
      const paid = await razorpay.open(order);
      onCaptured(); // bare, for the same reason as Premium
      await withVerifyRetry((p) => verifyAppointment(appt.id, p, fetchImpl), paid);
    },
    async settled(appt) {
      // Same pending→paid guard as Premium: read the appointment, don't replay
      // the verify.
      const id = appt?.id ?? appointment.id;
      const mine = await getMyAppointments(fetchImpl);
      return mine.some((a) => a.id === id && a.paymentStatus === "paid");
    },
    destination() {
      return "/account/appointments";
    },
  };
}
