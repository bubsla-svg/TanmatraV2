"use client";
// Client: presentational subscription row + status-driven actions.
import { useState } from "react";
import { Info } from "lucide-react";
import { formatPaise } from "@/lib/format";
import type { Subscription, SubscriptionStatus } from "@/lib/subscriptionsApi";
import { DeliveryList } from "./DeliveryList";
import { ChangePlanPanel } from "./ChangePlanPanel";

export type SubAction = "pause" | "resume" | "cancel" | "reactivate-billing";

const STATUS_STYLE: Record<SubscriptionStatus, string> = {
  active: "bg-sage-soft text-sage-text",
  paused: "border border-line text-ink-muted",
  halted: "text-[var(--danger)] border border-[var(--danger)]",
  cancelled: "border border-line text-ink-faint",
};
const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  active: "Active", paused: "Paused", halted: "Billing halted", cancelled: "Cancelled",
};

/** The transitions the server allows from each status (it 409s anything else). */
function actionsFor(status: SubscriptionStatus): SubAction[] {
  if (status === "active") return ["pause", "cancel"];
  if (status === "paused") return ["resume", "cancel"];
  if (status === "halted") return ["reactivate-billing", "cancel"];
  return [];
}
const ACTION_LABEL: Record<SubAction, string> = {
  pause: "Pause", resume: "Resume", cancel: "Cancel", "reactivate-billing": "Reactivate billing",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
export function SubscriptionCard({
  sub,
  busy,
  onAction,
  onChanged,
}: {
  sub: Subscription;
  busy: boolean;
  onAction: (action: SubAction) => void;
  /** A change-plan request settled (applied, or reauthorised) — reload the list. */
  onChanged: () => void;
}) {
  // Deliveries and the change-plan form each load/render lazily — a closed
  // card costs no request either way.
  const [showDeliveries, setShowDeliveries] = useState(false);
  const [showChangePlan, setShowChangePlan] = useState(false);
  return (
    <li className="rounded-3xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-base font-semibold text-ink">
          {sub.cadence} · {sub.mealsPerDelivery} meals / delivery
        </span>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-2xs font-semibold uppercase tracking-wide ${STATUS_STYLE[sub.status]}`}
        >
          {STATUS_LABEL[sub.status]}
        </span>
      </div>
      <p className="tabular mt-2 text-sm text-ink">
        {formatPaise(sub.pricePerDeliveryPaise)}
        <span className="text-ink-muted"> / delivery · {sub.deliveryWindow}</span>
      </p>
      {sub.status !== "cancelled" && (
        <p className="mt-1 text-xs text-ink-faint">
          {sub.status === "paused" ? "Paused" : "Next delivery"}:{" "}
          <span className="tabular text-ink-muted">
            {fmtDate(sub.status === "paused" ? sub.pausedAt : sub.nextDeliveryAt)}
          </span>
        </p>
      )}
      {sub.addressLine && (
        <p className="mt-1 text-xs text-ink-muted">{[sub.addressLine, sub.city, sub.pincode].filter(Boolean).join(", ")}</p>
      )}

      {sub.pendingCadence && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-sage-soft px-3 py-2.5 text-xs font-medium text-sage-text">
          <Info aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            Plan change to {sub.pendingCadence} · {sub.pendingMealsPerDelivery} meals
            {sub.pendingChangeReauthRequired ? " awaiting authorisation — " : " takes effect next cycle."}
            {sub.pendingChangeReauthRequired && (
              <button type="button" onClick={() => setShowChangePlan(true)} className="underline">
                Complete authorisation
              </button>
            )}
          </p>
        </div>
      )}
      {(actionsFor(sub.status).length > 0 || sub.status !== "cancelled") && (
        <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-line pt-3 text-sm font-medium">
          {actionsFor(sub.status).map((a) => (
            <button
              key={a}
              type="button"
              disabled={busy}
              onClick={() => onAction(a)}
              className={`-m-1 p-1 hover:underline disabled:opacity-40 ${a === "cancel" ? "text-[var(--danger)]" : "text-gold-text"}`}
            >
              {ACTION_LABEL[a]}
            </button>
          ))}
          {sub.status === "active" && !showChangePlan && (
            <button type="button" onClick={() => setShowChangePlan(true)} className="-m-1 p-1 text-gold-text hover:underline">
              Change plan
            </button>
          )}
          {sub.status !== "cancelled" && (
            <button
              type="button"
              onClick={() => setShowDeliveries((s) => !s)}
              aria-expanded={showDeliveries}
              className="-m-1 p-1 text-gold-text hover:underline"
            >
              {showDeliveries ? "Hide deliveries" : "Deliveries"}
            </button>
          )}
        </div>
      )}
      {showChangePlan && (
        <ChangePlanPanel sub={sub} onDone={() => { onChanged(); setShowChangePlan(false); }} />
      )}
      {showDeliveries && sub.status !== "cancelled" && <DeliveryList subscriptionId={sub.id} />}
    </li>
  );
}
