// Change-plan is disabled — DEFECT-CHANGE-PLAN-PRICING-001. This panel used to
// preview and submit a new price computed by computeDeliveryPricePaise, a
// retired per-meal formula that diverges wildly from the plan catalog a
// plan-v2 subscription is actually billed against (measured: ~3.7x on a
// same-cadence/same-meals no-op — see docs/DEFECT-CHANGE-PLAN-PRICING-001.md
// and docs/audit/P0-2-PLAN-CHANGE-CONTRACT-TRACE.md). Showing that preview, or
// letting a customer confirm against it, is an overcharge risk, so this is now
// a truthful "unavailable" notice instead of a form. The server enforces the
// same block independently — POST /subscriptions/:id/change-plan and both of
// its re-authorisation follow-ups return 503 regardless of this UI — so this
// is not a client-only hide.
import type { Subscription } from "@/lib/subscriptionsApi";

export function ChangePlanPanel(
  _props: { sub: Subscription; onDone: () => void },
) {
  return (
    <div className="mt-4 flex flex-col gap-1 rounded-2xl bg-secondary px-4 py-3">
      <p className="text-sm leading-relaxed text-ink">
        Plan changes are temporarily unavailable while we fix a pricing issue.
      </p>
      <p className="text-xs leading-relaxed text-ink-muted">
        Your current plan and billing are unaffected. Contact support if you need to change your plan now.
      </p>
    </div>
  );
}
