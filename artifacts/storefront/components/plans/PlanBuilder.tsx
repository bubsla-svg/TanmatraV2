"use client";
// Client: the builder is interactive (track axis + confirm) and emits funnel
// events — the configure-by-exception decision the CUJ needs.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatPaise } from "@/lib/format";
import { planDisplay, planQuoteView } from "@/lib/plans";
import { emitFunnel } from "@/lib/funnel";
import type { PlanId, DietTrack } from "@workspace/subscription-rules";

const TRACK_LABEL: Record<DietTrack, string> = { veg: "Veg", egg: "Egg", nonveg: "Non-veg" };

/**
 * Configure-by-exception builder (02d §4). Everything is pre-decided and shown
 * (monthly cycle, 1 lunch/day); the single axis the buyer touches is their
 * preference track, offered only for tracks the kitchen actually serves. The
 * total is spine-quoted and never shifts on track change (per-meal price is
 * flat), so there's no layout jump. The server re-quotes authoritatively at
 * checkout — this figure is the honest preview.
 */
export function PlanBuilder({ planId, defaultTrack }: { planId: PlanId; defaultTrack: DietTrack }) {
  const d = planDisplay(planId);
  const q = planQuoteView(planId);
  const router = useRouter();
  const [track, setTrack] = useState<DietTrack>(defaultTrack);

  function confirm() {
    emitFunnel("cuj_builder_confirm", { planId, track });
    emitFunnel("cuj_checkout_start", { planId, track });
    router.push(`/checkout?plan=${planId}`);
  }

  return (
    <section className="flex flex-col gap-5" aria-label={`Build ${d.name}`}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{d.name}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {q.mealsPerCycle} lunches a month · delivered 12:30&ndash;1:30 · pause or skip anytime
        </p>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Preference</p>
        <div className="inline-flex rounded-xl border border-line p-1">
          {q.servedTracks.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={track === t}
              onClick={() => {
                setTrack(t);
                emitFunnel("cuj_track_selected", { planId, track: t });
              }}
              className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              style={
                track === t
                  ? { background: "var(--gold)", color: "var(--gold-ink)" }
                  : { color: "var(--ink-muted)" }
              }
            >
              {TRACK_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-baseline justify-between rounded-xl bg-surface px-4 py-3 shadow-[var(--shadow-card)]">
        <span className="text-sm text-ink-muted">Monthly total</span>
        <span className="tabular text-xl font-semibold text-ink">{formatPaise(q.cycleTotalPaise)}</span>
      </div>

      <button
        type="button"
        onClick={confirm}
        className="rounded-xl bg-gold px-5 py-3 text-center text-sm font-semibold text-[var(--gold-ink)] transition-transform active:scale-[0.98]"
      >
        Continue to checkout
      </button>
    </section>
  );
}
