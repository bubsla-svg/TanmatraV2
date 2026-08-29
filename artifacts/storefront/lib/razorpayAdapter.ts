import type { RazorpayAdapter } from "./moneyPath";
import { ACCENT_GOLD_LIGHT } from "./themes/brand";

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

/**
 * Method ordering inside Razorpay's own sheet — UPI first (plan correction #4).
 *
 * The audits this plan consolidated recommended Apple Pay / Google Pay and a
 * second PSP. That is US advice: in this market UPI is the default rail, and
 * the correction was to order UPI first INSIDE the existing single-PSP sheet
 * rather than add rails. This is that, and nothing more.
 *
 * `show_default_blocks: true` is the load-bearing half. Without it this list
 * becomes an allow-list and every other method — cards, netbanking, wallets —
 * silently disappears from checkout. Ordering a preference is the goal;
 * removing someone's only working method is not.
 *
 * Exported so the ordering is assertable without a browser: the adapter itself
 * only runs against a real `window.Razorpay`.
 */
export const RAZORPAY_DISPLAY_CONFIG = {
  display: {
    blocks: {
      upi: { name: "Pay by UPI", instruments: [{ method: "upi" }] },
    },
    sequence: ["block.upi"],
    preferences: { show_default_blocks: true },
  },
} as const;

export interface RazorpayAdapterOpts {
  name?: string;
  description?: string;
  contact?: string;
  email?: string;
}

/**
 * Everything the modal is configured with EXCEPT the outcome wiring (handler
 * + ondismiss, which belong to open()'s promise). Pure and exported so every
 * UX choice below is assertable without a browser:
 *
 *  - `prefill` — the OTP-verified phone (and email where a surface has one)
 *    lands in the sheet, so UPI collect / card flows never re-ask for what
 *    the checkout already knows.
 *  - `theme.color` — the LIGHT-arm brand gold from lib/themes/brand. The
 *    modal is a Razorpay-hosted light sheet that paints white text over this
 *    colour; the dark-arm gold would measure ~2:1 under it (see brand.ts).
 *  - `send_sms_hash` — lets Android Chrome auto-read the card-OTP SMS
 *    (WebOTP), one less transcription at the most abandonment-prone step.
 *  - `config` — UPI first, everything else still present (constant above).
 */
export function buildRazorpayOptions(
  order: { razorpayOrderId: string; amount: number; currency: string; keyId: string },
  opts?: RazorpayAdapterOpts,
) {
  return {
    key: order.keyId,
    amount: order.amount,
    currency: order.currency,
    order_id: order.razorpayOrderId,
    name: opts?.name ?? "Tanmatra",
    description: opts?.description ?? "Order",
    prefill: { contact: opts?.contact ?? "", email: opts?.email ?? "" },
    theme: { color: ACCENT_GOLD_LIGHT },
    send_sms_hash: true,
    // UPI first, every other method still present — see the constant.
    config: RAZORPAY_DISPLAY_CONFIG,
  } as const;
}

export function createRazorpayAdapter(opts?: RazorpayAdapterOpts): RazorpayAdapter {
  return {
    async open(order) {
      await loadCheckoutScript();
      const Razorpay = (window as unknown as { Razorpay?: RazorpayCtor }).Razorpay;
      if (!Razorpay) throw new Error("razorpay_unavailable");
      return new Promise((resolve, reject) => {
        const rzp = new Razorpay({
          ...buildRazorpayOptions(order, opts),
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
          // confirm_close: a backdrop tap mid-UPI-collect is far more often a
          // slip than a decision — Razorpay's own "cancel payment?" prompt
          // turns it into one. Escape/close still work; a confirmed dismissal
          // rejects exactly as before (RazorpayDismissed, before verify).
          modal: { ondismiss: () => reject(new RazorpayDismissed()), confirm_close: true },
        });
        rzp.open();
      });
    },
  };
}
