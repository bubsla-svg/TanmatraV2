import type { DishData } from "@workspace/menu-catalog";

export function ThermalInstructions({ dish }: { dish: DishData }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-6 flex flex-col gap-6 shadow-sm">
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-gold-text">
          Thermal & Storage Protocols
        </span>
        <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-ink mt-1">
          Reheating & Shelf Life Guide
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface-raised p-4 flex flex-col gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-ink">Cold Storage (Refrigerate)</h3>
          <p className="text-sm text-ink-muted leading-relaxed">
            Store immediately upon arrival at 4&deg;C or lower. Consume within 48 hours to maintain active phytonutrients and micro-vitamin viability.
          </p>
        </div>

        <div className="rounded-xl border border-line bg-surface-raised p-4 flex flex-col gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-ink">Eco Container Safety</h3>
          <p className="text-sm text-ink-muted leading-relaxed">
            Delivered in certified BPA-free unbleached plant fiber pulp trays. 100% microwave and conventional oven safe up to 180&deg;C.
          </p>
        </div>
      </div>

      <div className="border-t border-line pt-6 flex flex-col gap-4">
        <h3 className="text-base font-semibold text-ink">Recommended Microwave Reheating Sequence</h3>
        <ol className="flex flex-col gap-4 text-sm text-ink-muted leading-relaxed">
          <li className="flex items-start gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold text-[var(--gold-ink)] font-bold shrink-0 text-sm">1</span>
            <span className="pt-1">Remove any fresh cold garnish tubs, chilled dressings, or fermented dips prior to thermal activation.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold text-[var(--gold-ink)] font-bold shrink-0 text-sm">2</span>
            <span className="pt-1">Cover tray loosely with eco-lid and microwave on high (800W) for exactly <strong className="text-ink">2 minutes and 30 seconds</strong>.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold text-[var(--gold-ink)] font-bold shrink-0 text-sm">3</span>
            <span className="pt-1">Allow to rest for 60 seconds so thermal heat disperses evenly without breaking delicate cold-pressed oil emulsions.</span>
          </li>
        </ol>
      </div>
    </div>
  );
}
