"use client";
// Client: presentational subscription row + status-driven actions.
import { formatPaise } from "@/lib/format";
import type { Subscription, SubscriptionStatus } from "@/lib/subscriptionsApi";

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
}: {
  sub: Subscription;
  busy: boolean;
  onAction: (action: SubAction) => void;
}) {
  return (
    <li className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink">
          {sub.cadence} · {sub.mealsPerDelivery} meals / delivery
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[sub.status]}`}>
          {STATUS_LABEL[sub.status]}
        </span>
      </div>
      <p className="tabular mt-1 text-sm text-ink-muted">
        {formatPaise(sub.pricePerDeliveryPaise)} / delivery · {sub.deliveryWindow}
      </p>
      {sub.status !== "cancelled" && (
        <p className="mt-0.5 text-xs text-ink-faint">
          {sub.status === "paused" ? "Paused" : "Next delivery"}: {fmtDate(sub.status === "paused" ? sub.pausedAt : sub.nextDeliveryAt)}
        </p>
      )}
      {sub.addressLine && (
        <p className="mt-0.5 text-xs text-ink-faint">{[sub.addressLine, sub.city, sub.pincode].filter(Boolean).join(", ")}</p>
      )}
      {actionsFor(sub.status).length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm font-medium">
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
        </div>
      )}
    </li>
  );
}
