import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { PLAN_CATALOG, type PlanId, type DietTrack } from "@workspace/subscription-rules";
import { Price, SegmentedControl, type SegmentedOption } from "@/components/primitives";
import { resolveBuilderDefaults } from "./cuj";
import { usePlanQuote, type PlanQuoteData, type PlanWaitlist } from "./usePlanQuote";

interface PlanBuilderProps {
  planId: PlanId;
  onConfirm: (selection: { planId: PlanId; track: DietTrack; quote: PlanQuoteData }) => void;
  onWaitlist: (waitlist: PlanWaitlist) => void;
  className?: string;
}

const TRACK_LABEL: Record<DietTrack, string> = {
  veg: "Veg",
  egg: "Egg",
  nonveg: "Non-veg",
};

/**
 * `<PlanBuilder>` — 02d §3 / 02f §2.4: confirm, don't construct. Everything
 * ships pre-selected (02e §5 defaults); the user APPROVES or adjusts by
 * exception. The plan fixes its cycle (monthly · N lunches), so that is shown as
 * a settled line, not a control (weekly entry tiers are a follow-up); the diet
 * preference is the one adjustable axis, on a segmented control (no dropdowns),
 * offering only the tracks the plan can actually serve (02e §2). The total
 * updates in place from the server quote — no layout shift, no spinner over the
 * number. A blocked plan/track surfaces the zero-dead-end waitlist.
 */
export function PlanBuilder({ planId, onConfirm, onWaitlist, className }: PlanBuilderProps) {
  const plan = PLAN_CATALOG[planId];
  const defaults = resolveBuilderDefaults(planId);
  const [dietTrack, setDietTrack] = useState<DietTrack>(defaults.track);

  const trackOptions: SegmentedOption<DietTrack>[] = plan.dietTracks.map((t) => ({
    value: t,
    label: TRACK_LABEL[t],
  }));

  const q = usePlanQuote(planId, dietTrack);

  useEffect(() => {
    track("cuj_builder_open", { planId });
  }, [planId]);

  useEffect(() => {
    if (q.data?.kind === "waitlist") onWaitlist(q.data);
  }, [q.data, onWaitlist]);

  const quote = q.data?.kind === "quote" ? q.data : null;
  const slotLabel = plan.slots[0] === "lunch" ? "lunches" : "meals";

  return (
    <section className={cn("flex flex-col gap-4 p-4", className)} aria-label="Configure your plan">
      {/* Settled cycle — the plan fixes duration + meal count (02e §2). */}
      <div
        className="flex items-center justify-between rounded-xl px-4 py-3"
        style={{ backgroundColor: "var(--color-ink-800)" }}
      >
        <span className="text-sm" style={{ color: "var(--color-ink-500)" }}>Plan</span>
        <span className="text-sm font-medium" style={{ textTransform: "capitalize" }}>
          {defaults.duration} · {plan.mealsPerCycle} {slotLabel}
        </span>
      </div>

      {/* Preference — the plan's served tracks only (never widened, 02e §2). */}
      {trackOptions.length > 1 && (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm" style={{ color: "var(--color-ink-500)" }}>Preference</span>
          <SegmentedControl<DietTrack>
            ariaLabel="Dietary preference"
            options={trackOptions}
            value={dietTrack}
            onChange={setDietTrack}
          />
        </label>
      )}

      {/* Total — server-quoted, updates in place. Height reserved so the number
          never causes layout shift while the quote refetches. */}
      <div
        className="flex items-baseline justify-between rounded-xl px-4"
        style={{ minHeight: 56, backgroundColor: "var(--color-ink-800)" }}
      >
        <span className="text-sm" style={{ color: "var(--color-ink-500)" }}>Monthly total</span>
        {quote ? (
          <Price paise={quote.totalPaise} size="lg" aria-label="Monthly total" />
        ) : (
          <span className="text-sm" style={{ color: "var(--color-ink-500)" }}>
            {q.data?.kind === "waitlist" ? "Not available yet" : "…"}
          </span>
        )}
      </div>

      <button
        type="button"
        disabled={!quote}
        onClick={() => {
          if (!quote) return;
          track("cuj_builder_confirm", { planId, track: dietTrack, totalPaise: quote.totalPaise });
          onConfirm({ planId, track: dietTrack, quote });
        }}
        className="rounded-xl px-4 py-3 text-center font-semibold transition-transform active:scale-[0.98] disabled:opacity-50"
        style={{ backgroundColor: "var(--color-saffron-500)", color: "var(--color-saffron-on)" }}
      >
        Review
      </button>
    </section>
  );
}
