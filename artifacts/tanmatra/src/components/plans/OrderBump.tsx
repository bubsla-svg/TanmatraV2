import { cn } from "@/lib/utils";
import { Price, RdBadge } from "@/components/primitives";

interface OrderBumpProps {
  rdName: string;
  credential: string;
  rdPhoto?: string;
  /** Add-on price in paise (+₹499/mo). */
  pricePaise: number;
  /** Clinic rate in paise, shown ADJACENT (never a strikethrough — it is
   *  someone else's price, not a former price). */
  clinicRatePaise: number;
  /** Two-line value proposition. */
  valueLines: [string, string];
  accepted: boolean;
  onAccept: () => void;
  onRemove: () => void;
  className?: string;
}

/**
 * `<OrderBump>` — 02f §2.5, the RD offer at plan review. A bordered, raised card
 * (NOT a checkbox row). Declining is doing nothing — there is no decline button.
 * Accepted → collapses to one confirmed line + "Remove". The reassurance
 * "Your plan is complete without it" is always visible while unaccepted.
 */
export function OrderBump({
  rdName,
  credential,
  rdPhoto,
  pricePaise,
  clinicRatePaise,
  valueLines,
  accepted,
  onAccept,
  onRemove,
  className,
}: OrderBumpProps) {
  if (accepted) {
    return (
      <div
        className={cn("flex items-center justify-between rounded-xl px-4 py-3", className)}
        style={{
          backgroundColor: "var(--color-clinical-sage-light)",
          border: "1px solid var(--color-sage-700)",
        }}
      >
        <span className="inline-flex items-center gap-2 text-sm font-medium">
          <i className="ph-fill ph-check-circle" aria-hidden="true" style={{ color: "var(--color-clinical-sage)" }} />
          {rdName} added · <Price paise={pricePaise} size="sm" />/mo
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="text-sm underline-offset-2 hover:underline"
          style={{ color: "var(--color-ink-500)", background: "none", border: "none" }}
        >
          Remove
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn("flex flex-col gap-3 rounded-2xl p-4", className)}
      style={{
        backgroundColor: "var(--color-ink-700)",
        border: "1px solid var(--color-sage-700)",
        boxShadow: "var(--shadow-raised)",
      }}
    >
      <RdBadge rdName={`Add your dietitian — ${rdName}`} credential={credential} photo={rdPhoto} />

      <p className="text-sm" style={{ margin: 0 }}>
        {valueLines[0]}
        <br />
        {valueLines[1]}
      </p>

      <div className="flex items-baseline gap-2">
        <Price paise={pricePaise} size="lg" />
        <span className="text-sm" style={{ color: "var(--color-ink-500)" }}>
          /mo
        </span>
        <span className="text-xs" style={{ color: "var(--color-ink-500)" }}>
          · clinic rate <Price paise={clinicRatePaise} size="sm" />+
        </span>
      </div>

      <p className="text-xs" style={{ color: "var(--color-ink-500)", margin: 0 }}>
        Your plan is complete without it.
      </p>

      <button
        type="button"
        onClick={onAccept}
        className="rounded-xl px-4 py-2.5 text-center font-semibold transition-transform active:scale-[0.98]"
        style={{ backgroundColor: "var(--color-sage-500)", color: "var(--color-sage-50)" }}
      >
        Add
      </button>
    </div>
  );
}
