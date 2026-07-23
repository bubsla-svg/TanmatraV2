/**
 * SF-05 — the browser Razorpay adapter's contract, tested with a stubbed
 * checkout.js. The invariants that matter to the money path (moneyPath.ts):
 * a successful modal resolves the SERVER's payment ids, and a DISMISSED modal
 * rejects with RazorpayDismissed so runAlacarteCheckout never reaches verify.
 * Run: node --test --import tsx ./lib/razorpayAdapter.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createRazorpayAdapter, RazorpayDismissed } from "./razorpayAdapter";

interface RzpOpts {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  handler: (r: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  modal: { ondismiss: () => void };
}

const ORDER = { razorpayOrderId: "rzp_1", amount: 41800, currency: "INR", keyId: "key_x" };

/** Run `body` with checkout.js stubbed to either pay or dismiss on open(). */
async function withStubbedRazorpay(
  behaviour: "pay" | "dismiss",
  body: () => Promise<void>,
): Promise<void> {
  const g = globalThis as Record<string, unknown>;
  const prevWindow = g.window;
  const prevDocument = g.document;
  class FakeRazorpay {
    private opts: RzpOpts;
    constructor(opts: RzpOpts) {
      this.opts = opts;
    }
    open(): void {
      if (behaviour === "dismiss") {
        this.opts.modal.ondismiss();
      } else {
        this.opts.handler({
          razorpay_payment_id: "pay_1",
          razorpay_order_id: this.opts.order_id,
          razorpay_signature: "sig_1",
        });
      }
    }
  }
  // getElementById truthy → loadCheckoutScript treats the script as present and
  // resolves without touching the DOM (no real injection under test).
  g.document = { getElementById: () => ({}) };
  g.window = { Razorpay: FakeRazorpay };
  try {
    await body();
  } finally {
    g.window = prevWindow;
    g.document = prevDocument;
  }
}

test("resolves with the mapped payment ids when the modal succeeds", async () => {
  await withStubbedRazorpay("pay", async () => {
    const paid = await createRazorpayAdapter().open(ORDER);
    assert.deepEqual(paid, {
      razorpayPaymentId: "pay_1",
      razorpayOrderId: "rzp_1",
      razorpaySignature: "sig_1",
    });
  });
});

test("rejects with RazorpayDismissed when the modal is dismissed", async () => {
  await withStubbedRazorpay("dismiss", async () => {
    await assert.rejects(
      createRazorpayAdapter().open(ORDER),
      (err) => err instanceof RazorpayDismissed && /payment_dismissed/.test((err as Error).message),
    );
  });
});
