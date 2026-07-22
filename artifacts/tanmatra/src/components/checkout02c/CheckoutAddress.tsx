import { cn } from "@/lib/utils";
import { Price, StepDots } from "@/components/primitives";

export interface SavedAddress {
  id: string;
  label: string;
  line: string;
}

interface CheckoutAddressProps {
  /** Sticky total carried from the quote (identical on every screen). */
  totalPaise: number;
  savedAddresses: SavedAddress[];
  onSelect: (id: string) => void;
  onAddNew: () => void;
  className?: string;
}

/**
 * `<CheckoutAddress>` — 02c §3 S2. Skipped for returning users with a saved
 * address (it renders pre-selected on pay). Element inventory: step dots, the
 * sticky total, saved-address cards OR the new-address entry, one CTA. One
 * decision: where. NO delivery-slot picker — the lunch window is stated, not
 * chosen (02c §2).
 */
export function CheckoutAddress({
  totalPaise,
  savedAddresses,
  onSelect,
  onAddNew,
  className,
}: CheckoutAddressProps) {
  return (
    <section className={cn("flex flex-col gap-4 p-4", className)} aria-label="Delivery address">
      <StepDots current={2} total={3} />

      <div className="flex items-baseline justify-between">
        <span className="text-sm" style={{ color: "var(--color-ink-500)" }}>Total</span>
        <Price paise={totalPaise} size="md" />
      </div>

      <p className="text-sm" style={{ color: "var(--color-ink-500)", margin: 0 }}>
        Delivered 12:30–1:30.
      </p>

      <div className="flex flex-col gap-2">
        {savedAddresses.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onSelect(a.id)}
            className="rounded-xl px-4 py-3 text-left transition-transform active:scale-[0.98]"
            style={{
              backgroundColor: "var(--color-ink-800)",
              border: "1px solid var(--color-ink-600)",
            }}
          >
            <span className="block font-medium">{a.label}</span>
            <span className="block text-sm" style={{ color: "var(--color-ink-500)" }}>{a.line}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onAddNew}
        className="rounded-xl px-4 py-3 text-center font-semibold transition-transform active:scale-[0.98]"
        style={{
          backgroundColor: savedAddresses.length ? "transparent" : "var(--color-saffron-500)",
          color: savedAddresses.length ? "var(--color-saffron-300)" : "var(--color-saffron-on)",
          border: savedAddresses.length ? "1px solid var(--color-saffron-700)" : "none",
        }}
      >
        {savedAddresses.length ? "Add a new address" : "Deliver here"}
      </button>
    </section>
  );
}
