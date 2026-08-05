import { PaymentAttempt, QuoteSnapshot, Order } from "../domain/types";

const paymentAttemptsByIdempotency: Map<string, PaymentAttempt> = new Map();
const paymentAttemptsById: Map<string, PaymentAttempt> = new Map();
const quotesById: Map<string, QuoteSnapshot> = new Map();

export const CheckoutService = {
  createPaymentAttempt(quote: QuoteSnapshot, idempotencyKey: string): PaymentAttempt {
    quotesById.set(quote.quoteId, quote);

    // Rule: Server-level idempotency key enforcement
    const existing = paymentAttemptsByIdempotency.get(idempotencyKey);
    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const attempt: PaymentAttempt = {
      paymentAttemptId: `pa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      quoteId: quote.quoteId,
      idempotencyKey,
      status: "created",
      createdAt: now,
      updatedAt: now,
    };

    paymentAttemptsByIdempotency.set(idempotencyKey, attempt);
    paymentAttemptsById.set(attempt.paymentAttemptId, attempt);
    return attempt;
  },

  confirmPaymentAndCreateOrder(paymentAttemptId: string): Order {
    const attempt = paymentAttemptsById.get(paymentAttemptId);
    const quoteId = attempt?.quoteId || "quote_default";

    if (attempt) {
      attempt.status = "succeeded";
      attempt.updatedAt = new Date().toISOString();
    }

    return {
      orderId: `ord_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      quoteId,
      paymentAttemptId,
      type: "subscription",
      status: "confirmed",
      createdAt: new Date().toISOString(),
    };
  },
};
