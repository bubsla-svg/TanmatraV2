"use client";
// Client: the builder is interactive (track axis + confirm) and emits funnel
// events — the configure-by-exception decision the CUJ needs.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatPaise } from "@/lib/format";
import { planDisplay, planQuoteView } from "@/lib/plans";
import { planAllowsAddOn, addOnView } from "@/lib/addons";
import { emitFunnel } from "@/lib/funnel";
import { OrderBump } from "./OrderBump";
import type { PlanId, DietTrack, PlanCycle } from "@workspace/subscription-rules";
import type { PlanBuilderData } from "@/lib/plans";

const TRACK_LABEL: Record<DietTrack, string> = { veg: "Veg", egg: "Egg", nonveg: "Non-veg" };

/** Reference clinic rate shown adjacent to the bump price (02f §2.5 — "₹1,999+",
 *  someone else's price, never a strikethrough of a former price). */
const CLINIC_RATE_PAISE = 199900;
/** Bump value proposition, verbatim (02f §2.5). */
const RD_VALUE_LINES: [string, string] = ["2 video sessions a month", "Weekly tuning on WhatsApp"];

/**
 * Configure-by-exception builder (02d §4). Everything is pre-decided and shown
 * (monthly cycle, 1 lunch/day); the single axis the buyer touches is their
 * preference track, offered only for tracks the kitchen actually serves. The
 * total is spine-quoted and never shifts on track change (per-meal price is
 * flat), so there's no layout jump. The server re-quotes authoritatively at
 * checkout — this figure is the honest preview.
 */
export function PlanBuilder({ planId, defaultTrack, builderData }: { planId: PlanId; defaultTrack: DietTrack; builderData: PlanBuilderData }) {
  const d = planDisplay(planId);
  const router = useRouter();
  
  const [track, setTrack] = useState<DietTrack>(defaultTrack);
  const trackConfig = builderData.servedTracks.find(t => t.track === track) ?? builderData.servedTracks[0]!;
  
  const hasMonthly = trackConfig.quotes.some(q => q.cycle === "monthly");
  const [cycle, setCycle] = useState<PlanCycle>(hasMonthly ? "monthly" : trackConfig.quotes[0]!.cycle);
  
  const currentQuote = trackConfig.quotes.find(q => q.cycle === cycle) ?? trackConfig.quotes[0]!;

  const [bump, setBump] = useState(false);

  // The RD bump is the only upsell here (02d stage 4), offered only where the
  // plan permits it. RD identity is blocked on #3, so OrderBump renders the
  // honest generic offer — no fabricated name/face.
  const canBump = planAllowsAddOn(planId, "rd_bump");
  const rdBump = addOnView("rd_bump");
  const total = currentQuote.cycleTotalPaise + (bump ? rdBump.pricePaise : 0);

  function confirm() {
    emitFunnel("cuj_builder_confirm", { planId, track, cycle, bump });
    emitFunnel("cuj_checkout_start", { planId, track, cycle, bump });
    router.push(`/checkout?plan=${planId}&track=${track}&cycle=${cycle}${bump ? "&bump=1" : ""}`);
  }

  return (
    <section className="flex flex-col gap-5" aria-label={`Build ${d.name}`}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{d.name}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {currentQuote.mealsPerCycle} lunches a {cycle === "weekly" ? "week" : cycle === "quarterly" ? "quarter" : "month"} · delivered 12:30&ndash;1:30 · pause or skip anytime
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <p id="pref-label" className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Preference</p>
          <div role="group" aria-labelledby="pref-label" className="inline-flex flex-wrap gap-2 rounded-xl border border-line p-1">
            {builderData.servedTracks.map((t) => (
              <button
                key={t.track}
                type="button"
                aria-pressed={track === t.track}
                onClick={() => {
                  setTrack(t.track);
                  // Preserve cycle if available in new track, else fallback
                  const newTrackConfig = builderData.servedTracks.find(st => st.track === t.track)!;
                  if (!newTrackConfig.quotes.some(q => q.cycle === cycle)) {
                    setCycle(newTrackConfig.quotes[0]!.cycle);
                  }
                  emitFunnel("cuj_track_selected", { planId, track: t.track });
                }}
                className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                style={
                  track === t.track
                    ? { background: "var(--gold)", color: "var(--gold-ink)" }
                    : { color: "var(--ink-muted)" }
                }
              >
                {TRACK_LABEL[t.track]}
              </button>
            ))}
          </div>
        </div>

        {trackConfig.quotes.length > 1 && (
          <div>
            <p id="cycle-label" className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Duration</p>
            <div role="group" aria-labelledby="cycle-label" className="inline-flex flex-wrap gap-2 rounded-xl border border-line p-1">
              {trackConfig.quotes.map((q) => (
                <button
                  key={q.cycle}
                  type="button"
                  aria-pressed={cycle === q.cycle}
                  onClick={() => setCycle(q.cycle)}
                  className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                  style={
                    cycle === q.cycle
                      ? { background: "var(--gold)", color: "var(--gold-ink)" }
                      : { color: "var(--ink-muted)" }
                  }
                >
                  {q.cycle.charAt(0).toUpperCase() + q.cycle.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {currentQuote.pricePerMealPaise != null && trackConfig.poolMedianPaise != null && (
        <div className="flex items-center gap-2 rounded-lg bg-surface-muted px-4 py-2 text-sm font-medium text-ink-muted">
          <span className="text-ink">₹{Math.round(currentQuote.pricePerMealPaise / 100)}/meal</span> on plan
          <span>·</span>
          <span>₹{Math.round(trackConfig.poolMedianPaise / 100)} avg à la carte</span>
        </div>
      )}

      <div className="flex items-baseline justify-between rounded-xl bg-surface px-4 py-3 shadow-[var(--shadow-card)]">
        <span className="text-sm text-ink-muted capitalize">{cycle} total</span>
        <span className="tabular text-xl font-semibold text-ink">{formatPaise(total)}</span>
      </div>

      {canBump && (
        <OrderBump
          accepted={bump}
          pricePaise={rdBump.pricePaise}
          clinicRatePaise={CLINIC_RATE_PAISE}
          valueLines={RD_VALUE_LINES}
          onAccept={() => setBump(true)}
          onRemove={() => setBump(false)}
        />
      )}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={confirm}
          className="rounded-xl bg-gold px-5 py-3 text-center text-sm font-semibold text-[var(--gold-ink)] transition-transform active:scale-[0.98]"
        >
          Continue to checkout
        </button>
        <p className="text-center text-[10px] uppercase tracking-wide text-ink-faint">
          No platform fee. No surge. Prices include all taxes.
        </p>
      </div>
    </section>
  );
}
