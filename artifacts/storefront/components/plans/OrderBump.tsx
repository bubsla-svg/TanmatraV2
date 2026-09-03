import Image from "next/image";
import { formatPaise } from "@/lib/format";

/** A concrete, RD-signed identity for the bump. When absent (blocked on
 *  master-index #3 — RD sign-off), the offer renders honestly WITHOUT a
 *  fabricated person. Never invent a name or a face here. */
export interface RdIdentity {
  name: string;
  credential: string;
  photo?: string;
}

interface OrderBumpProps {
  accepted: boolean;
  /** +₹499/mo — spine-priced, passed in. */
  pricePaise: number;
  /** Clinic rate (₹1,999+, 02f §2.5) shown ADJACENT — someone else's price,
   *  never a strikethrough of a former price. */
  clinicRatePaise: number;
  valueLines: [string, string];
  onAccept: () => void;
  onRemove: () => void;
  /** Omitted until a real RD identity is signed off (#3). */
  rd?: RdIdentity;
}

/**
 * `<OrderBump>` — the RD offer at plan review (02f §2.5, 02d stage 4). A
 * bordered raised card, NOT a checkbox row. Declining is doing nothing — there
 * is no decline button. Accepted → collapses to one confirmed line + "Remove".
 * "Your plan is complete without it" stays visible while unaccepted.
 */
export function OrderBump({
  accepted,
  pricePaise,
  clinicRatePaise,
  valueLines,
  onAccept,
  onRemove,
  rd,
}: OrderBumpProps) {
  if (accepted) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-sage/40 bg-[color-mix(in_srgb,var(--sage)_12%,transparent)] px-4 py-3">
        <span className="text-sm font-medium text-ink">
          {rd ? `${rd.name} added` : "Dietitian added"} ·{" "}
          <span className="tabular">{formatPaise(pricePaise)}</span>/mo
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex min-h-11 items-center px-2 text-sm text-ink-muted underline-offset-2 hover:underline"
        >
          Remove
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-sage/40 bg-surface-raised p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3">
        {rd?.photo ? (
          // Fixed 56px circle at every viewport — no `sizes`, so next/image
          // emits the 1x/2x pair rather than the full width ladder.
          <Image
            src={rd.photo}
            alt=""
            width={56}
            height={56}
            className="h-14 w-14 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--sage)_18%,transparent)] text-xs font-semibold text-sage"
            aria-hidden="true"
          >
            RD
          </span>
        )}
        <div>
          <p className="text-sm font-semibold text-ink">
            {rd ? `Add your dietitian — ${rd.name}` : "Add your dietitian"}
          </p>
          <p className="text-xs text-ink-muted">
            {rd ? rd.credential : "Paired with a registered dietitian when you start."}
          </p>
        </div>
      </div>

      <p className="text-sm leading-relaxed text-ink-muted">
        {valueLines[0]}
        <br />
        {valueLines[1]}
      </p>

      <div className="flex items-baseline gap-2">
        <span className="tabular text-lg font-semibold text-ink">{formatPaise(pricePaise)}</span>
        <span className="text-sm text-ink-muted">/mo</span>
        <span className="tabular text-xs text-ink-faint">
          · clinic rate {formatPaise(clinicRatePaise)}+
        </span>
      </div>

      <p className="text-xs text-ink-faint">Your plan is complete without it.</p>

      {/* Outlined gold, not a sage fill (T-21): gold is the only action
          colour, and this is a secondary action beside "Continue to checkout"
          — the card's sage border is the signal, the button is not. */}
      <button
        type="button"
        onClick={onAccept}
        className="min-h-11 rounded-xl border border-gold bg-surface px-4 text-center text-sm font-semibold text-gold-text transition-transform active:scale-[0.98]"
      >
        Add dietitian
      </button>
    </div>
  );
}
