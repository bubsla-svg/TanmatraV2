"use client";
// Client: one axis (veg/nonveg) and a Start that routes into the same Breeze
// checkout as a plan. The trio itself is fixed — the toggle only swaps which
// track's three dishes are shown, never lets the buyer compose their own.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { emitFunnel } from "@/lib/funnel";
import { formatPaise } from "@/lib/format";
import { TRIAL_COPY } from "@/lib/trial";

export interface TrioDish {
  slug: string;
  name: string;
  image: string;
}

type TrialTrack = "veg" | "nonveg";
const TRACKS: { id: TrialTrack; label: string }[] = [
  { id: "veg", label: "Veg" },
  { id: "nonveg", label: "Non-veg" },
];

/**
 * The 3-Day Taste Test starter (02b). The trio is pre-decided (02e §3.5) — this
 * only picks the track and hands off to checkout with the trial plan. The trial
 * price is spine-quoted and passed in; this component never states an amount of
 * its own. Start emits the same `cuj_checkout_start` a plan does — the trial is
 * a checkout, not a separate funnel.
 */
export function TrialStart({
  trios,
  pricePaise,
}: {
  trios: Record<TrialTrack, TrioDish[]>;
  pricePaise: number;
}) {
  const router = useRouter();
  const [track, setTrack] = useState<TrialTrack>("veg");
  const trio = trios[track];

  function start() {
    emitFunnel("cuj_checkout_start", { planId: "trial_3day", track });
    router.push(`/checkout?plan=trial_3day&track=${track}`);
  }

  return (
    <section className="flex flex-col gap-5" aria-label="Start the 3-day taste test">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Preference</p>
        <div className="inline-flex rounded-xl border border-line p-1">
          {TRACKS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={track === t.id}
              onClick={() => setTrack(t.id)}
              className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              style={
                track === t.id
                  ? { background: "var(--gold)", color: "var(--gold-ink)" }
                  : { color: "var(--ink-muted)" }
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <ul className="grid grid-cols-3 gap-3">
        {trio.map((dish) => (
          <li
            key={dish.slug}
            className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface"
          >
            <div className="relative aspect-square w-full overflow-hidden bg-surface-raised">
              {/* eslint-disable-next-line @next/next/no-img-element -- fixed
                  aspect box for zero CLS; next/image lands in a later phase. */}
              <img
                src={dish.image}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </div>
            <p className="p-2 text-xs font-medium leading-snug text-ink">{dish.name}</p>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={start}
        className="rounded-xl bg-gold px-5 py-4 text-center text-base font-semibold text-[var(--gold-ink)] transition-transform active:scale-[0.98]"
      >
        Start the taste test · {formatPaise(pricePaise)}
      </button>
      <p className="text-center text-xs text-ink-muted">{TRIAL_COPY.noAutoConvert}</p>
    </section>
  );
}
