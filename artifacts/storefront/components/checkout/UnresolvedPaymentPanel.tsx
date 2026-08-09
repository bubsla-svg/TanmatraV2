"use client";
// Client: purely presentational, but the parent's retry handler is a live callback.
import { Button } from "@/components/ui/button";

/**
 * The terminal state after Razorpay has captured money but verify could not be
 * confirmed even after moneyPath's bounded in-flow retries (network down for
 * the whole window, or the response never arrived). Shown by PlanCheckout /
 * AlacarteCheckout INSTEAD OF the normal details form + "Continue to payment"
 * CTA — that CTA, if re-enabled here, would call createRazorpayOrder again and
 * risk a second, genuine charge for a payment that may have already gone
 * through. The only action offered re-asks the already-idempotent verify
 * endpoint (safe to tap repeatedly) via retryVerifyPayment.
 */
export function UnresolvedPaymentPanel({
  checking,
  onCheckStatus,
}: {
  checking: boolean;
  onCheckStatus: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-6">
      <h1 className="text-xl font-semibold text-ink">Confirming your payment</h1>
      <p className="text-sm text-ink-muted">
        Your payment may have already gone through, so please don&rsquo;t try to pay
        again. We lost the connection while confirming it — tap below to check
        the latest status.
      </p>
      <Button
        type="button"
        disabled={checking}
        onClick={onCheckStatus}
        shape="pill"
        size="fluid"
        className="px-6 py-3 font-semibold disabled:opacity-40"
      >
        {checking ? "Checking…" : "Check payment status"}
      </Button>
      <p className="text-xs text-ink-muted">
        Still stuck after a few tries? Contact support with the phone number on
        this order — we can look it up on our end, and you will never be charged
        twice for it.
      </p>
    </div>
  );
}
