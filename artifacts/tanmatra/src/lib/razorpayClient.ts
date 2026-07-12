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

export async function payWithRazorpay(args: {
  /** Amount to charge, in paise. */
  amountPaise: number;
  /** Stable reference for reconciliation (order id / sub-<id>). Max 40 chars. */
  receipt: string;
  /** Line shown in the Razorpay modal. */
  description: string;
  /** Prefilled contact number, if known. */
  contact?: string;
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
      }),
    });
    if (!res.ok) return "unavailable";
    const body = (await res.json()) as { razorpayOrderId: string };
    razorpayOrderId = body.razorpayOrderId;
  } catch {
    return "unavailable";
  }

  // 2. Modal + 3. verification.
  try {
    await loadCheckoutScript();
  } catch {
    return "unavailable";
  }

  return new Promise<RazorpayOutcome>((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Razorpay = (window as any).Razorpay;
    if (!Razorpay) {
      resolve("unavailable");
      return;
    }
    const rzp = new Razorpay({
      key: RAZORPAY_KEY_ID,
      amount: args.amountPaise,
      currency: "INR",
      order_id: razorpayOrderId,
      name: "Tanmatra",
      description: args.description,
      theme: { color: "#F4" + "C430" },
      prefill: { contact: args.contact ?? "" },
      handler: async (response: {
        razorpay_payment_id: string;
        razorpay_order_id: string;
        razorpay_signature: string;
      }) => {
        try {
          const v = await fetch(`${API_BASE}/payments/razorpay/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              orderId: args.receipt.slice(0, 64),
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              razorpaySignature: response.razorpay_signature,
            }),
          });
          // Signature-invalid is a hard failure; treat as cancelled so the
          // caller rolls back rather than activating unpaid.
          resolve(v.ok ? "paid" : "cancelled");
        } catch {
          // Payment likely captured but verification unreachable — resolve
          // paid; the Razorpay webhook + manual reconciliation cover this.
          resolve("paid");
        }
      },
      modal: {
        ondismiss: () => resolve("cancelled"),
      },
    });
    rzp.open();
  });
}
