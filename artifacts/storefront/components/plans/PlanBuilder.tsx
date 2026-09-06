"use client";
// Client: the builder is interactive (track axis + confirm) and emits funnel
// events — the configure-by-exception decision the CUJ needs.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatPaise } from "@/lib/format";
import { planDisplay, planQuoteView } from "@/lib/plans";
import { planAllowsAddOn, addOnView } from "@/lib/addons";
import { emitFunnel } from "@/lib/funnel";
import { planValueAnchor } from "@/lib/planValueAnchor";
import { Button } from "@/components/ui/button";
import { OrderBump } from "./OrderBump";
import { RD_SERVICES_ENABLED } from "@/lib/flags";
import type { PlanId, DietTrack, PlanCycle } from "@workspace/subscription-rules";
import type { PlanBuilderData } from "@/lib/plans";
import { Leaf, Egg, Bone, Check } from "lucide-react";

const TRACK_LABEL: Record<DietTrack, string> = { veg: "Veg", egg: "Egg", nonveg: "Non-veg" };

/** D-16: keyed per-plan (not global) — configuring two different plans in the
 *  same tab must not cross-contaminate each other's draft. Mirrors
 *  AlacarteCheckout's PHONE_DRAFT_KEY/ADDRESS_DRAFT_KEY pattern: without it,
 *  FocusHeader's "Back to plan" (real history navigation, not a fresh push)
 *  still remounts this component with fresh useState defaults — verified
 *  empirically, not assumed; a plain router.back() alone does NOT preserve
 *  React state here the way it might look like it should. */
function draftKey(planId: PlanId): string {
  return `plan_builder_draft_v1:${planId}`;
}

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

  // D-16: restore a draft written before navigating away (see draftKey's
  // comment), once — a customer who's already started picking wins over a
  // stale draft only if they hadn't touched anything yet, same "restore into
  // untouched state" rule AlacarteDetails' address draft follows.
  const restoredDraft = useRef(false);
  useEffect(() => {
    if (restoredDraft.current) return;
    restoredDraft.current = true;
    try {
      const raw = sessionStorage.getItem(draftKey(planId));
      if (!raw) return;
      const saved = JSON.parse(raw) as { track?: DietTrack; cycle?: PlanCycle; bump?: boolean };
      if (saved.track && builderData.servedTracks.some((t) => t.track === saved.track)) setTrack(saved.track);
      if (saved.cycle) setCycle(saved.cycle);
      if (typeof saved.bump === "boolean") setBump(saved.bump);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(draftKey(planId), JSON.stringify({ track, cycle, bump }));
    } catch {}
  }, [planId, track, cycle, bump]);

  // The RD bump is the only upsell here (02d stage 4), offered only where the
  // plan permits it. RD identity is blocked on #3, so OrderBump renders the
  // honest generic offer — no fabricated name/face.
  // Gated, not deleted: `rd_bump` is a priced spine entry and the offer is a
  // PAID service. It is not offered while no dietitian is on board.
  const canBump = RD_SERVICES_ENABLED && planAllowsAddOn(planId, "rd_bump");
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
          {currentQuote.mealsPerCycle} lunches a {cycle === "weekly" ? "week" : cycle === "quarterly" ? "quarter" : "month"} · delivered on weekdays · pause or skip anytime
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
                className={`inline-flex min-h-11 items-center rounded-lg border-2 px-4 text-sm font-medium transition-colors ${
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
                  className={`flex min-h-11 items-center gap-1.5 rounded-lg border-2 px-4 text-sm font-medium transition-colors ${
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
      {/* T-21: "₹199/meal on plan · ₹199 avg à la carte" told the customer the
          plan saved nothing — and for many tracks it was true. The comparison
          now prints only when the saving is real (lib/planValueAnchor, ≥ 5%);
          otherwise the line says what the plan is FOR. Both figures are the
          spine's; nothing is computed here beyond the difference. */}
      {(() => {
        const anchor = planValueAnchor({
          perMealPaise: currentQuote.pricePerMealPaise,
          alacarteMedianPaise: trackConfig.poolMedianPaise,
        });
        return anchor.kind === "saving" ? (
          <div className="flex flex-wrap items-center gap-x-2 rounded-lg bg-surface px-4 py-2.5 text-sm font-medium text-ink-muted">
            <span className="tabular text-ink">{formatPaise(anchor.perMealPaise)}/meal</span> on plan
            <span aria-hidden>·</span>
            <span className="tabular text-sage-text">
              save {formatPaise(anchor.savingPaise)} a meal ({anchor.savingPct}%) vs à la carte
            </span>
          </div>
        ) : (
          <div className="rounded-lg bg-surface px-4 py-2.5 text-sm font-medium text-ink-muted">
            {currentQuote.mealsPerCycle} lunches sorted · skip or pause any delivery up to 24 h before · no lock-in
          </div>
        );
      })()}

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

      {/* Sticky bottom CTA bar — Stitch plan-config design (route-05).
          `bottom-16` is the tab bar's 4rem box, but MobileBottomNav also pads
          `env(safe-area-inset-bottom)` beneath it, so on a notched phone this
          bar overlapped that strip. Same calc StickyCtaBar uses. */}
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 flex flex-col gap-2 rounded-xl border border-line bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] p-3 backdrop-blur-xl md:bottom-4">
        <Button
          type="button"
          onClick={confirm}
          shape="xl"
          size="fluid"
          className="px-5 py-3 text-center font-semibold"
        >
          Continue to checkout
        </Button>
        <p className="text-center text-3xs uppercase tracking-wide text-ink-faint">
          No platform fee. No surge. Prices include all taxes.
        </p>
      </div>
    </section>
  );
}
