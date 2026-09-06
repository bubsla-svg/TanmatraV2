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
  halted: "text-danger border border-danger",
  cancelled: "border border-line text-ink-faint",
};
const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  active: "Active", paused: "Paused", halted: "Billing halted", cancelled: "Cancelled",
};

/** The transitions the server allows from each status (it 409s anything else). */
/** The headline used to print the raw cadence enum ("monthly · 12 meals /
 *  delivery") on the card that owns pause and cancel. */
const CADENCE_TITLE: Record<string, string> = {
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
  quarterly: "Quarterly",
};

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
  // Replaces window.confirm (invisible to assistive tech, and silent about the
  // remainder of a paid cycle) — 2026-09-06 audit.
  const [confirmCancel, setConfirmCancel] = useState(false);
  return (
    <li className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="font-display text-lg font-semibold leading-tight text-primary">
          {CADENCE_TITLE[sub.cadence] ?? sub.cadence} plan · {sub.mealsPerDelivery} meals a delivery
        </span>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[.16em] ${STATUS_STYLE[sub.status]}`}
        >
          {STATUS_LABEL[sub.status]}
        </span>
      </div>
      <p className="mt-2 text-sm text-ink-muted">
        <span className="font-data font-bold text-primary">{formatPaise(sub.pricePerDeliveryPaise)}</span>
        <span> / delivery · {sub.deliveryWindow}</span>
      </p>
      {sub.status !== "cancelled" && (
        <p className="mt-1 text-xs text-ink-faint">
          {sub.status === "paused" ? "Paused" : "Next delivery"}:{" "}
          <span className="font-data font-bold text-primary">
            {fmtDate(sub.status === "paused" ? sub.pausedAt : sub.nextDeliveryAt)}
          </span>
        </p>
      )}
      {sub.addressLine && (
        <p className="mt-1 text-xs text-ink-muted">{[sub.addressLine, sub.city, sub.pincode].filter(Boolean).join(", ")}</p>
      )}

      {sub.pendingCadence && (
        <div className="mt-3 flex items-start gap-2 rounded-2xl bg-sage-soft px-4 py-3 text-xs font-medium leading-relaxed text-sage-text">
          <Info aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            Plan change to {sub.pendingCadence} · {sub.pendingMealsPerDelivery} meals
            {sub.pendingChangeReauthRequired ? " awaiting authorisation — " : " takes effect next cycle."}
            {sub.pendingChangeReauthRequired && (
              <button type="button" onClick={() => setShowChangePlan(true)} className="font-semibold underline underline-offset-4">
                Complete authorisation
              </button>
            )}
          </p>
        </div>
      )}
      {confirmCancel && (
        <div role="group" aria-label="Confirm cancellation" className="mt-4 flex flex-col gap-3 rounded-2xl border border-danger/40 bg-surface-raised p-4">
          <p className="text-sm text-ink">
            Cancel this plan? Upcoming deliveries stop and billing ends. Deliveries already paid for in this cycle still arrive; skipped meals stay as credit.
          </p>
          <div className="flex flex-wrap items-center gap-4 text-sm font-semibold">
            <button type="button" disabled={busy} onClick={() => { setConfirmCancel(false); onAction("cancel"); }} className="inline-flex min-h-11 items-center text-danger underline-offset-4 hover:underline disabled:opacity-40">
              Yes, cancel the plan
            </button>
            <button type="button" onClick={() => setConfirmCancel(false)} className="inline-flex min-h-11 items-center text-ink-muted underline-offset-4 hover:underline">
              Keep it
            </button>
          </div>
        </div>
      )}

      {(actionsFor(sub.status).length > 0 || sub.status !== "cancelled") && (
        <div className="mt-4 flex flex-wrap items-center gap-x-5 border-t border-line pt-1 text-sm font-semibold">
          {actionsFor(sub.status).map((a) =>
            a === "cancel" ? (
              <button
                key={a}
                type="button"
                disabled={busy}
                onClick={() => setConfirmCancel(true)}
                className="inline-flex min-h-11 items-center text-danger underline-offset-4 hover:underline disabled:opacity-40"
              >
                {ACTION_LABEL[a]}
              </button>
            ) : (
              <button
                key={a}
                type="button"
                disabled={busy}
                onClick={() => onAction(a)}
                className="inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline disabled:opacity-40"
              >
                {ACTION_LABEL[a]}
              </button>
            ),
          )}
          {sub.status === "active" && !showChangePlan && (
            <button type="button" onClick={() => setShowChangePlan(true)} className="inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline">
              Change plan
            </button>
          )}
          {sub.status !== "cancelled" && (
            <button
              type="button"
              onClick={() => setShowDeliveries((s) => !s)}
              aria-expanded={showDeliveries}
              className="inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline"
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
