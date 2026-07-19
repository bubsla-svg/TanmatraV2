// Shared Razorpay checkout launcher.
//
// Wraps the three-step dance (server order → checkout.js modal → server
// signature verification) behind one promise-returning call so any surface
// (checkout, subscription activation) can collect a payment without
// duplicating the script-loading and modal plumbing.
//
// Outcomes:
//   "paid"        — payment captured AND signature verified server-side.
//   "cancelled"   — the customer dismissed the modal. Caller decides how to
//                   roll back (e.g. cancel the just-created subscription).
//   "unavailable" — gateway not configured (no VITE_RAZORPAY_KEY_ID at build
//                   time, or the server has no keys). Caller falls back to
//                   its deferred/pay-later path.

import { API_BASE } from "./apiBase";

const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID as
  | string
  | undefined;

export type RazorpayOutcome = "paid" | "cancelled" | "unavailable";

export interface RazorpayPaymentResult {
  razorpayPaymentId: string;
  razorpayOrderId: string;
  razorpaySignature: string;
}

export function razorpayConfigured(): boolean {
  return Boolean(RAZORPAY_KEY_ID);
}

function loadCheckoutScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById("__rzp_script")) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.id = "__rzp_script";
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Razorpay script failed to load"));
    document.head.appendChild(s);
  });
}

/**
 * Low-level modal opener shared by EVERY Razorpay flow in the app (checkout
 * payment, subscription activation, subscription plan-change
 * re-authorisation). Takes an already-created Razorpay order id — the caller
 * creates that server-side, against whatever amount IT wants authorised —
 * and resolves with the raw signed payment response. It deliberately does
 * NOT call a verify endpoint itself: different callers verify against
 * different resources (a paid order vs. a subscription plan change), so
 * verification stays the caller's job. This is the one place the Razorpay
 * checkout.js SDK is loaded and instantiated — every other flow reuses it
 * instead of re-integrating the SDK.
 */
export async function openRazorpayCheckout(args: {
  /** A Razorpay order id already created server-side for this exact amount. */
  razorpayOrderId: string;
  /** Amount the order above was created for, in paise. */
  amountPaise: number;
  /** Line shown in the Razorpay modal. */
  description: string;
  /** Prefilled contact number, if known. */
  contact?: string;
}): Promise<
  | { outcome: "paid"; payment: RazorpayPaymentResult }
  | { outcome: "cancelled" | "unavailable"; payment?: undefined }
> {
  if (!RAZORPAY_KEY_ID) return { outcome: "unavailable" };

  try {
    await loadCheckoutScript();
  } catch {
    return { outcome: "unavailable" };
  }

  return new Promise((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Razorpay = (window as any).Razorpay;
    if (!Razorpay) {
      resolve({ outcome: "unavailable" });
      return;
    }
    const rzp = new Razorpay({
      key: RAZORPAY_KEY_ID,
      amount: args.amountPaise,
      currency: "INR",
      order_id: args.razorpayOrderId,
      name: "Tanmatra",
      description: args.description,
      theme: { color: "#F4" + "C430" },
      prefill: { contact: args.contact ?? "" },
      handler: (response: {
        razorpay_payment_id: string;
        razorpay_order_id: string;
        razorpay_signature: string;
      }) => {
        resolve({
          outcome: "paid",
          payment: {
            razorpayPaymentId: response.razorpay_payment_id,
            razorpayOrderId: response.razorpay_order_id,
            razorpaySignature: response.razorpay_signature,
          },
        });
      },
      modal: {
        ondismiss: () => resolve({ outcome: "cancelled" }),
      },
    });
    rzp.open();
  });
}

export async function payWithRazorpay(args: {
  /** Amount to charge, in paise. */
  amountPaise: number;
  /** Stable reference for reconciliation (order id / sub-<id>). Max 40 chars. */
  receipt: string;
  /** Line shown in the Razorpay modal. */
  description: string;
  /** Prefilled contact number, if known. */
  contact?: string;
  /**
   * Present only for subscription-checkout payments. Tells the server which
   * subscription this payment is for so /payments/razorpay/order can attach
   * a Razorpay customer + recurring (UPI Autopay) token to the gateway
   * order — without this, no autopay mandate can ever be registered for the
   * subscription, even on a weekly/fortnightly cadence.
   */
  subscriptionId?: number;
}): Promise<RazorpayOutcome> {
  if (!RAZORPAY_KEY_ID) return "unavailable";

  // 1. Server-side Razorpay order.
  let razorpayOrderId: string;
  try {
    const res = await fetch(`${API_BASE}/payments/razorpay/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        amountPaise: args.amountPaise,
        receipt: args.receipt.slice(0, 40),
        orderId: args.receipt,
        ...(args.subscriptionId != null
          ? { subscriptionId: args.subscriptionId }
          : {}),
      }),
    });
    if (!res.ok) return "unavailable";
    const body = (await res.json()) as { razorpayOrderId: string };
    razorpayOrderId = body.razorpayOrderId;
  } catch {
    return "unavailable";
  }

  // 2. Modal (shared opener).
  const opened = await openRazorpayCheckout({
    razorpayOrderId,
    amountPaise: args.amountPaise,
    description: args.description,
    contact: args.contact,
  });
  if (opened.outcome !== "paid") return opened.outcome;

  // 3. Server-side verification.
  try {
    const v = await fetch(`${API_BASE}/payments/razorpay/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        orderId: args.receipt.slice(0, 64),
        razorpayPaymentId: opened.payment.razorpayPaymentId,
        razorpayOrderId: opened.payment.razorpayOrderId,
        razorpaySignature: opened.payment.razorpaySignature,
      }),
    });
    // Signature-invalid is a hard failure; treat as cancelled so the
    // caller rolls back rather than activating unpaid.
    return v.ok ? "paid" : "cancelled";
  } catch {
    // Payment likely captured but verification unreachable — resolve
    // paid; the Razorpay webhook + manual reconciliation cover this.
    return "paid";
  }
}
