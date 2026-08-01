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

/**
 * Load checkout.js, RETRYABLY. The naive version ("tag exists → resolve") had
 * a failure mode that bricked payment retries: on a dropped connection the
 * first attempt left its DEAD script tag in the DOM, so every later attempt
 * short-circuited on the tag's existence, resolved, and then hit the
 * `!Razorpay` throw below — forever, until a full page reload. The order was
 * already created by then, so the customer was stuck at pay with a "Try
 * again" that could never work. Three states, each handled:
 *
 *  - tag present and USABLE (global there, or our loaded marker set): resolve.
 *    Marker without global means the script ran but the library is broken —
 *    resolving lets open() throw `razorpay_unavailable` LOUDLY rather than
 *    hanging a listener that will never fire.
 *  - tag present, still in flight (a concurrent open()): piggyback on its
 *    load/error outcome instead of double-injecting.
 *  - tag absent: inject. On error the tag REMOVES ITSELF before rejecting,
 *    which is the whole fix — the next attempt finds no tag and re-injects.
 */
function loadCheckoutScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    const w = window as unknown as { Razorpay?: unknown };
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      if (w.Razorpay || existing.getAttribute("data-loaded") === "1") return resolve();
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => {
          existing.remove();
          reject(new Error("razorpay_script_unavailable"));
        },
        { once: true },
      );
      return;
    }
    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.src = SCRIPT_SRC;
    s.onload = () => {
      s.setAttribute("data-loaded", "1");
      resolve();
    };
    s.onerror = () => {
      s.remove();
      reject(new Error("razorpay_script_unavailable"));
    };
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
