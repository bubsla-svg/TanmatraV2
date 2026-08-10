"use client";
// Client: the builder is interactive (track axis + confirm) and emits funnel
// events — the configure-by-exception decision the CUJ needs.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatPaise } from "@/lib/format";
import { planDisplay, planQuoteView } from "@/lib/plans";
import { planAllowsAddOn, addOnView } from "@/lib/addons";
import { emitFunnel } from "@/lib/funnel";
import { Button } from "@/components/ui/button";
import { OrderBump } from "./OrderBump";
import type { PlanId, DietTrack, PlanCycle } from "@workspace/subscription-rules";
import type { PlanBuilderData } from "@/lib/plans";
import { Leaf, Egg, Bone, Check } from "lucide-react";

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
  // trackConfig.quotes can legitimately be empty — PLAN_PRICE_TABLE keys some
  // plans (glp1_companion, teams) by "intro"/"regular"/"default" rather than by
  // diet track. The host page only renders this component for a launchable
  // plan today, so the array is never empty in practice, but a non-null
  // assertion here would crash if that host check ever changed — fall back to
  // "monthly" rather than dereferencing a quote that doesn't exist.
  const [cycle, setCycle] = useState<PlanCycle>(
    hasMonthly || trackConfig.quotes.length === 0 ? "monthly" : trackConfig.quotes[0]!.cycle,
  );

  const currentQuote = trackConfig.quotes.find(q => q.cycle === cycle) ?? trackConfig.quotes[0];

  const [bump, setBump] = useState(false);

  // The RD bump is the only upsell here (02d stage 4), offered only where the
  // plan permits it. RD identity is blocked on #3, so OrderBump renders the
  // honest generic offer — no fabricated name/face.
  const canBump = planAllowsAddOn(planId, "rd_bump");
  const rdBump = addOnView("rd_bump");
  const total = (currentQuote?.cycleTotalPaise ?? 0) + (bump ? rdBump.pricePaise : 0);

  function confirm() {
    emitFunnel("cuj_builder_confirm", { planId, track, cycle, bump });
    emitFunnel("cuj_checkout_start", { planId, track, cycle, bump });
    router.push(`/checkout?plan=${planId}&track=${track}&cycle=${cycle}${bump ? "&bump=1" : ""}`);
  }

  // Same "never a dead end" contract PlanCard applies to a blocked plan: a
  // launchable plan whose price table has no entry for this track (the
  // glp1_companion/teams shape) still needs somewhere honest to land, not a
  // crash on an assumed quote.
  if (!currentQuote) {
    return (
      <section className="flex flex-col gap-3" aria-label={`Build ${d.name}`}>
        <p className="text-sm text-ink-muted">
          Pricing for this plan isn&rsquo;t set up for the {TRACK_LABEL[track]} preference yet.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-5" aria-label={`Build ${d.name}`}>
      <div>
        {/* Plan name is now the page's FocusHeader h1 (app/(focus)/plan/[planId]/page.tsx) —
            this used to duplicate it as a second h1. */}
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
                // D-08: selection state, not a second action colour — border +
                // tint + marker (SquircleOptionCard's established pattern),
                // never a solid --gold fill. "Continue to checkout" below stays
                // the one gold action on this screen.
                className={`rounded-lg border-2 px-4 py-2 text-sm font-medium transition-colors ${
                  track === t.track
                    ? "border-gold bg-gold/10 text-gold-text"
                    : "border-transparent text-ink-muted"
                }`}
              >
                <div className="flex items-center gap-2">
                  {t.track === "veg" && <Leaf size={16} className={track === t.track ? "text-gold-text" : "text-ink-muted"} />}
                  {t.track === "egg" && <Egg size={16} className={track === t.track ? "text-gold-text" : "text-ink-muted"} />}
                  {t.track === "nonveg" && <Bone size={16} className={track === t.track ? "text-gold-text" : "text-ink-muted"} />}
                  <span>{TRACK_LABEL[t.track]}</span>
                  {track === t.track && <Check size={14} className="text-gold-text" aria-hidden />}
                </div>
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
                  // D-08: same selection treatment as the track pills above.
                  className={`flex items-center gap-1.5 rounded-lg border-2 px-4 py-2 text-sm font-medium transition-colors ${
                    cycle === q.cycle
                      ? "border-gold bg-gold/10 text-gold-text"
                      : "border-transparent text-ink-muted"
                  }`}
                >
                  {q.cycle.charAt(0).toUpperCase() + q.cycle.slice(1)}
                  {cycle === q.cycle && <Check size={14} className="text-gold-text" aria-hidden />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* The on-plan-vs-à-la-carte chip. Its fill was `bg-surface-muted`, and no
          --surface-muted token exists anywhere — so the chip painted nothing and
          its rounded, padded geometry was invisible. Nor is --surface-subtle the
          answer: that aliases --bg, and this whole section sits directly on --bg
          (app/plan/[planId]/page.tsx wraps it in bg-[var(--bg)]), so it would be
          a second invisible fill. --surface is the one step up from the canvas,
          the same fill the cycle-total row below uses. */}
      {currentQuote.pricePerMealPaise != null && trackConfig.poolMedianPaise != null && (
        <div className="flex items-center gap-2 rounded-lg bg-surface px-4 py-2 text-sm font-medium text-ink-muted">
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

      {/* Sticky bottom CTA bar — Stitch plan-config design (route-05). Classes only. */}
      <div className="sticky bottom-16 z-40 flex flex-col gap-2 rounded-xl border border-line bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] p-3 backdrop-blur-xl md:bottom-4">
        <Button
          type="button"
          onClick={confirm}
          shape="xl"
          size="fluid"
          className="px-5 py-3 text-center font-semibold"
        >
          Continue to checkout
        </Button>
        <p className="text-center text-[10px] uppercase tracking-wide text-ink-faint">
          No platform fee. No surge. Prices include all taxes.
        </p>
      </div>
    </section>
  );
}
