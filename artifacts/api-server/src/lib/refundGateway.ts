/**
 * The one Razorpay refund call, shared by the finance console
 * (routes/refunds.ts) and the ops agent's refund_order tool (lib/ai/agents/
 * ops.ts). Both callers cap the amount against the order's remaining
 * refundable balance BEFORE calling this; this only moves the money.
 *
 * `speed: "normal"` is asynchronous — a 200 means Razorpay ACCEPTED the
 * instruction (entity status usually `pending`), and the refund.processed /
 * refund.failed webhooks in routes/payments.ts settle or unwind it later.
 * The Idempotency-Key makes a retry return the same refund, never a second.
 */
export interface GatewayRefundRequest {
  razorpayPaymentId: string;
  amountPaise: number;
  /** Stable per logical refund: `refund-<requestId>` for the console,
   *  `refund-ops-<orderId>-<eventKey>` for the agent. */
  idempotencyKey: string;
  notes: Record<string, string>;
}

export type GatewayRefundResult =
  | { ok: true; refundId: string; status: string | null }
  | { ok: false; kind: "gateway_error"; status: number; body: unknown }
  | { ok: false; kind: "unreachable"; error: unknown };

export async function issueRazorpayRefund(
  req: GatewayRefundRequest,
  creds: [string, string],
  fetchImpl: typeof fetch = fetch,
): Promise<GatewayRefundResult> {
  const [keyId, keySecret] = creds;
  try {
    const rpRes = await fetchImpl(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(req.razorpayPaymentId)}/refund`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
          "Content-Type": "application/json",
          "Idempotency-Key": req.idempotencyKey,
        },
        body: JSON.stringify({ amount: req.amountPaise, speed: "normal", notes: req.notes }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!rpRes.ok) {
      let body: unknown;
      try {
        body = await rpRes.json();
      } catch {
        body = await rpRes.text();
      }
      return { ok: false, kind: "gateway_error", status: rpRes.status, body };
    }
    const refund = (await rpRes.json()) as { id: string; status?: string };
    return { ok: true, refundId: refund.id, status: typeof refund.status === "string" ? refund.status : null };
  } catch (error) {
    return { ok: false, kind: "unreachable", error };
  }
}
