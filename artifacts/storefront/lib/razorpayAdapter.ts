import type { RazorpayAdapter } from "./moneyPath";

/**
 * The concrete browser Razorpay adapter (SF-05). Loads checkout.js on demand
 * and opens the modal for an order the SERVER already created — every value
 * (amount, currency, order id, AND keyId) comes from that server response, so
 * no Razorpay key ever ships in the bundle. The client never authors an amount.
 */

const SCRIPT_ID = "__rzp_checkout_js";
const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

/** Thrown when the customer dismisses the modal, so runAlacarteCheckout rejects
 *  BEFORE verifyPayment is ever called (the money-path test contract). */
export class RazorpayDismissed extends Error {
  constructor() {
    super("payment_dismissed");
    this.name = "RazorpayDismissed";
  }
}

function loadCheckoutScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById(SCRIPT_ID)) return resolve();
    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.src = SCRIPT_SRC;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("razorpay_script_unavailable"));
    document.head.appendChild(s);
  });
}

interface RazorpayCtor {
  new (opts: unknown): { open(): void };
}

export function createRazorpayAdapter(opts?: {
  name?: string;
  description?: string;
  contact?: string;
}): RazorpayAdapter {
  return {
    async open(order) {
      await loadCheckoutScript();
      const Razorpay = (window as unknown as { Razorpay?: RazorpayCtor }).Razorpay;
      if (!Razorpay) throw new Error("razorpay_unavailable");
      return new Promise((resolve, reject) => {
        const rzp = new Razorpay({
          key: order.keyId,
          amount: order.amount,
          currency: order.currency,
          order_id: order.razorpayOrderId,
          name: opts?.name ?? "Tanmatra",
          description: opts?.description ?? "Order",
          prefill: { contact: opts?.contact ?? "" },
          handler: (r: {
            razorpay_payment_id: string;
            razorpay_order_id: string;
            razorpay_signature: string;
          }) =>
            resolve({
              razorpayPaymentId: r.razorpay_payment_id,
              razorpayOrderId: r.razorpay_order_id,
              razorpaySignature: r.razorpay_signature,
            }),
          modal: { ondismiss: () => reject(new RazorpayDismissed()) },
        });
        rzp.open();
      });
    },
  };
}
