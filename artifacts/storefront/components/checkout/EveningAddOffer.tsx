"use client";
// Client: the post-purchase attach. Live POST against the api-server when a
// subscriptionId is wired (SF-11); the flag-dark skeleton's local stub
// otherwise — same surface, so the two builds never diverge visually.

import { useState } from "react";
import { formatPaise } from "@/lib/format";
import { attachAddOn } from "@/lib/addonsApi";
import { ApiError } from "@/lib/apiClient";

/**
 * Evening Add — the post-purchase upsell on the confirmation screen (02d stage
 * 8, +₹599/week). Skippable by construction: doing nothing leaves it
 * unattached, so there is no decline button. With a subscriptionId the tap is
 * the real attach (idempotent server-side — a re-tap returns the existing row);
 * failures state what happened and where to finish the job (Account → Plans),
 * never a dead end.
 */
export function EveningAddOffer({
  pricePaise,
  subscriptionId,
}: {
  pricePaise: number;
  /** When present, the tap POSTs the live attach; absent = skeleton stub. */
  subscriptionId?: number;
}) {
  const [state, setState] = useState<"idle" | "busy" | "added">("idle");
  const [error, setError] = useState<string | null>(null);

  async function add() {
    if (subscriptionId === undefined) {
      // Skeleton stub (flag-dark build) — a confirmed line, same as pay upstream.
      setState("added");
      return;
    }
    setState("busy");
    setError(null);
    try {
      await attachAddOn(subscriptionId, "evening_add");
      setState("added");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setError("Your session expired — you can add evening meals anytime from Account → Plans.");
      } else if (e instanceof ApiError && e.code === "addon_not_allowed") {
        setError("Evening meals aren't available on this plan.");
      } else {
        setError("Couldn't add evening meals just now — try again, or add it from Account → Plans.");
      }
      setState("idle");
    }
  }

  if (state === "added") {
    return (
      <div className="rounded-2xl border border-sage/40 bg-[color-mix(in_srgb,var(--sage)_12%,transparent)] px-4 py-3 text-sm font-medium text-ink">
        Evening meals added — we&rsquo;ll set it up before your first dinner.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Add dinner to your plan?</h3>
        <span className="font-mono tabular text-sm font-semibold text-ink">{formatPaise(pricePaise)}/wk</span>
      </div>
      <p className="text-sm text-ink-muted">An evening meal each weekday. Cancel anytime.</p>
      {error && <p role="alert" className="text-xs font-medium text-[var(--danger)]">{error}</p>}
      <button
        type="button"
        disabled={state === "busy"}
        onClick={() => void add()}
        className="mt-1 self-start rounded-full border border-sage/50 px-4 py-2 text-sm font-semibold text-sage-text transition-colors hover:bg-[color-mix(in_srgb,var(--sage)_10%,transparent)] active:scale-[0.98] disabled:opacity-40"
      >
        {state === "busy" ? "Adding…" : "Add evening meals"}
      </button>
    </div>
  );
}
