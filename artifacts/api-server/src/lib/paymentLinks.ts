import { razorpayBasicAuth, razorpayCredentials } from "./razorpayRecurring";

/**
 * Razorpay Payment Links (UPI-only), shared by POST /payments/upi/intent and
 * the abandonment-recovery sweep (T9). The amount is ALWAYS the caller's
 * server-resolved charge — this helper never sees a client number.
 */
export interface PaymentLinkRequest {
  /** Our externalOrderId — becomes the link's reference_id, which is what the
   *  webhook's payment-link capture branch reconciles on. */
  externalOrderId: string;
  amountPaise: number;
  phone: string;
  /** Seconds until Razorpay expires the link. */
  expireInSec: number;
  description?: string;
}

export interface PaymentLink {
  id: string;
  shortUrl: string;
  expiresAt: Date;
}

export interface PaymentLinkDeps {
  fetchImpl?: typeof fetch;
  credentials?: [string, string] | null;
  now?: () => number;
}

export class PaymentLinkError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = "PaymentLinkError";
  }
}

export async function createUpiPaymentLink(
  req: PaymentLinkRequest,
  deps: PaymentLinkDeps = {},
): Promise<PaymentLink> {
  const creds = deps.credentials === undefined ? razorpayCredentials() : deps.credentials;
  if (!creds) throw new PaymentLinkError("payment gateway not configured", null, null);
  const [keyId, keySecret] = creds;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const nowMs = deps.now?.() ?? Date.now();

  const rpRes = await fetchImpl("https://api.razorpay.com/v1/payment_links", {
    method: "POST",
    headers: {
      Authorization: `Basic ${razorpayBasicAuth(keyId, keySecret)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: req.amountPaise,
      currency: "INR",
      description: req.description ?? "Tanmatra Order",
      reference_id: req.externalOrderId,
      customer: { contact: req.phone },
      options: { checkout: { method: { upi: 1 } } },
      expire_by: Math.floor(nowMs / 1000) + req.expireInSec,
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!rpRes.ok) {
    let body: unknown;
    try {
      body = await rpRes.json();
    } catch {
      body = await rpRes.text();
    }
    throw new PaymentLinkError("Razorpay payment link creation failed", rpRes.status, body);
  }
  const link = (await rpRes.json()) as { id: string; short_url: string; expire_by: number };
  return { id: link.id, shortUrl: link.short_url, expiresAt: new Date(link.expire_by * 1000) };
}
