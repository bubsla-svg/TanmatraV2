import type { DishData } from "@workspace/menu-catalog";

export function ThermalInstructions({ dish }: { dish: DishData }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 flex flex-col gap-6 shadow-sm">
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-gold-text">
          Thermal & Storage Protocols
        </span>
        <h2 className="text-lg font-semibold text-ink mt-1">
          Reheating & Shelf Life Guide
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-line p-4 flex flex-col gap-2">
          <div className="text-xs font-bold uppercase text-ink">&bull; Cold Storage (Refrigerate)</div>
          <p className="text-xs text-ink-muted leading-relaxed">
            Store immediately upon arrival at 4&deg;C or lower. Consume within 48 hours to maintain active phytonutrients and micro-vitamin viability.
          </p>
        </div>

        <div className="rounded-xl border border-line p-4 flex flex-col gap-2">
          <div className="text-xs font-bold uppercase text-ink">&bull; Eco Container Safety</div>
          <p className="text-xs text-ink-muted leading-relaxed">
            Delivered in certified BPA-free unbleached plant fiber pulp trays. 100% microwave and conventional oven safe up to 180&deg;C.
          </p>
        </div>
      </div>

      <div className="border-t border-line pt-4 flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-ink">Recommended Microwave Reheating Sequence</h3>
        <ol className="flex flex-col gap-2.5 text-xs text-ink-muted leading-relaxed">
          <li className="flex items-start gap-2.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gold text-[var(--gold-ink)] font-bold shrink-0 text-[10px]">1</span>
            <span>Remove any fresh cold garnish tubs, chilled dressings, or fermented dips prior to thermal activation.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gold text-[var(--gold-ink)] font-bold shrink-0 text-[10px]">2</span>
            <span>Cover tray loosely with eco-lid and microwave on high (800W) for exactly <strong className="text-ink">2 minutes and 30 seconds</strong>.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gold text-[var(--gold-ink)] font-bold shrink-0 text-[10px]">3</span>
            <span>Allow to rest for 60 seconds so thermal heat disperses evenly without breaking delicate cold-pressed oil emulsions.</span>
          </li>
        </ol>
      </div>
    </div>
  );
}
