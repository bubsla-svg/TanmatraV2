import { Order, PaymentAttempt, QuoteSnapshot } from "../domain/types";

export class CheckoutService {
  private static paymentAttemptsStore = new Map<string, PaymentAttempt>();
  private static ordersStore = new Map<string, Order>();

  /**
   * Creates an idempotent PaymentAttempt for an active QuoteSnapshot.
   */
  static createPaymentAttempt(quote: QuoteSnapshot, idempotencyKey: string): PaymentAttempt {
    // 1. Check if quote is active
    if (quote.status !== "active") {
      throw new Error(`Cannot pay for quote in status: ${quote.status}`);
    }

    if (new Date(quote.expiresAt) < new Date()) {
      throw new Error("Quote has expired. Please refresh your quote.");
    }

    // 2. Check Idempotency Key (Rule 16: Return existing attempt if matching key exists)
    const existing = Array.from(this.paymentAttemptsStore.values()).find(
      p => p.idempotencyKey === idempotencyKey
    );

    if (existing) {
      return existing;
    }

    const attemptId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newAttempt: PaymentAttempt = {
      paymentAttemptId: attemptId,
      quoteId: quote.quoteId,
      idempotencyKey,
      status: "created",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.paymentAttemptsStore.set(attemptId, newAttempt);
    return newAttempt;
  }

  /**
   * Confirms payment attempt and creates an Order atomically.
   */
  static confirmPaymentAndCreateOrder(paymentAttemptId: string): Order {
    const attempt = this.paymentAttemptsStore.get(paymentAttemptId);
    if (!attempt) {
      throw new Error(`Payment attempt ${paymentAttemptId} not found.`);
    }

    if (attempt.status === "succeeded") {
      // Return existing order if already processed
      const existingOrder = Array.from(this.ordersStore.values()).find(
        o => o.paymentAttemptId === paymentAttemptId
      );
      if (existingOrder) return existingOrder;
    }

    // Update attempt status
    attempt.status = "succeeded";
    attempt.updatedAt = new Date().toISOString();

    const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newOrder: Order = {
      orderId,
      quoteId: attempt.quoteId,
      paymentAttemptId,
      type: "subscription",
      status: "confirmed",
      createdAt: new Date().toISOString(),
    };

    this.ordersStore.set(orderId, newOrder);
    return newOrder;
  }
}
