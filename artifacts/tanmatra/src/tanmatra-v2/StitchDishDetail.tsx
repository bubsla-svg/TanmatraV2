import { useMemo, useState } from "react";
import { ArrowLeft, SealCheck, Check, X, Prohibit } from "@phosphor-icons/react";

/**
 * Dish Detail (Customise) — ported from the Stitch "Tanmatra Premium Home"
 * project (screen 9cde04bc…) on the Nocturnal Nourishment design system.
 * The PDP with an iOS bottom-sheet customiser (portion / add-ons / removals)
 * and a live calorie recompute on the CTA. Dish content is demo data — wire
 * to `useMenuCatalog()` / `/dish/:slug` next.
 */

const PORTIONS = [
  { id: "light", label: "Light (0.75x)", kcal: 195 },
  { id: "standard", label: "Standard (1x)", kcal: 260 },
  { id: "large", label: "Large (1.5x)", kcal: 390 },
] as const;

const ADDONS = [
  { id: "avocado", label: "Extra Avocado", kcal: 50 },
  { id: "hemp", label: "Hemp Seeds", kcal: 30 },
];

const REMOVALS = ["No Cilantro", "No Chili Flakes"];

const OPTIONS = [
  { id: "classic", name: "Classic", blurb: "Whole grain bread, Avocado, Lemon juice, and more." },
  { id: "sunny", name: "Sunny-Side Egg", blurb: "Adds 70 kcal, 6g protein." },
  { id: "poached", name: "Poached Egg", blurb: "Adds 70 kcal, 6g protein." },
];

const STATS = [
  { label: "Calories", value: "260" },
  { label: "Protein", value: "12g" },
  { label: "Glycemic", value: "Medium" },
];

export default function StitchDishDetail() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [option, setOption] = useState("classic");
  const [portion, setPortion] = useState<(typeof PORTIONS)[number]["id"]>("standard");
  const [addons, setAddons] = useState<Set<string>>(new Set(["hemp"]));
  const [removals, setRemovals] = useState<Set<string>>(new Set(["No Chili Flakes"]));

  const totalKcal = useMemo(() => {
    const base = PORTIONS.find((p) => p.id === portion)?.kcal ?? 260;
    const add = ADDONS.filter((a) => addons.has(a.id)).reduce((s, a) => s + a.kcal, 0);
    return base + add;
  }, [portion, addons]);

  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  };

  return (
    <div className="relative min-h-dvh bg-nn-bg text-nn-on-surface overflow-hidden">
      {/* Main content (blurs when the sheet is open) */}
      <main
        className={`h-full w-full overflow-y-auto pb-32 transition-all duration-300 ${
          sheetOpen ? "blur-md brightness-50 pointer-events-none" : ""
        }`}
      >
        {/* Hero */}
        <div className="relative w-full h-[442px] md:h-[530px] max-w-screen-md mx-auto">
          <div className="w-full h-full rounded-b-3xl bg-gradient-to-b from-nn-surface to-nn-bg" />
          <div className="absolute top-0 inset-x-0 flex justify-between items-center p-4 bg-gradient-to-b from-black/60 to-transparent">
            <button
              aria-label="Back"
              className="w-10 h-10 rounded-full nn-glass flex items-center justify-center hover:bg-white/10 transition-colors"
            >
              <ArrowLeft size={20} className="text-white" />
            </button>
          </div>
          <div className="absolute top-4 right-4">
            <span className="nn-glass px-3 py-1.5 rounded-full nn-label-caps text-white">Breakfast</span>
          </div>
          <div className="absolute bottom-4 inset-x-0 flex justify-center gap-2">
            <span className="w-4 h-1 rounded-full bg-nn-primary" />
            <span className="w-1 h-1 rounded-full bg-white/30" />
            <span className="w-1 h-1 rounded-full bg-white/30" />
            <span className="w-1 h-1 rounded-full bg-white/30" />
          </div>
        </div>

        {/* Details */}
        <div className="max-w-screen-md mx-auto px-4 py-8 space-y-8">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-nn-primary/10 border border-nn-primary/20 nn-label-caps text-nn-primary">
              <SealCheck size={14} weight="fill" /> Recommended for your goal
            </span>
            <div>
              <h1 className="nn-display-lg-mobile text-white mb-2">Avocado Toast</h1>
              <p className="nn-body-sm text-nn-secondary">
                A fresh morning plate — balanced, lightly seasoned, with wholesome accents.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="nn-glass px-3 py-1 rounded-full flex items-center gap-1.5 nn-label-caps text-white">
                <span className="w-2 h-2 rounded-full bg-clinical-sage" /> Veg
              </span>
              <span className="nn-glass px-3 py-1 rounded-full nn-label-caps text-white">GI Med</span>
            </div>
            {/* Allergen alert (ties to the fail-closed safety engine) */}
            <div className="nn-glass rounded-lg p-3 flex items-center gap-3 border border-nn-error/20 bg-nn-error/5">
              <span className="nn-label-caps text-nn-error">Allergen Safety:</span>
              <span className="nn-body-sm text-white">Gluten</span>
            </div>
          </div>

          {/* Nutrition quick stats */}
          <div className="nn-glass rounded-xl p-4 grid grid-cols-4 gap-4 divide-x divide-white/10">
            {STATS.map((s) => (
              <div key={s.label} className="text-center first:pl-0 pl-4">
                <div className="nn-micro-data text-nn-secondary uppercase mb-1">{s.label}</div>
                <div className="nn-body-lg font-semibold text-white">{s.value}</div>
              </div>
            ))}
            <div className="text-center pl-4">
              <div className="nn-micro-data text-nn-secondary uppercase mb-1">RD Review</div>
              <div className="flex items-center justify-center gap-1 text-nn-primary">
                <Check size={14} weight="bold" />
                <span className="nn-micro-data font-bold uppercase">Checked</span>
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-4">
            <h3 className="nn-label-caps text-nn-secondary">Select Option</h3>
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 snap-x [&::-webkit-scrollbar]:hidden">
              {OPTIONS.map((o) => {
                const active = o.id === option;
                return (
                  <button
                    key={o.id}
                    onClick={() => setOption(o.id)}
                    className={`snap-start shrink-0 w-[200px] text-left nn-glass rounded-xl p-4 transition-opacity ${
                      active ? "border border-nn-primary bg-nn-primary/5" : "opacity-70 hover:opacity-100"
                    }`}
                  >
                    <div className="nn-body-lg text-white mb-2">{o.name}</div>
                    <div className="nn-body-sm text-nn-secondary line-clamp-2">{o.blurb}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => setSheetOpen(true)}
            className="w-full h-14 rounded-xl border border-nn-primary text-nn-primary nn-label-caps hover:bg-nn-primary/10 active:scale-95 transition-all"
          >
            Customise Meal
          </button>
        </div>
      </main>

      {/* Bottom sheet */}
      {sheetOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setSheetOpen(false)} />
      )}
      <div
        className={`fixed bottom-0 inset-x-0 z-50 bg-nn-surface-low rounded-t-3xl border-t border-white/10 shadow-[0_-8px_32px_rgba(0,0,0,0.8)] flex flex-col max-h-[85dvh] transition-transform duration-300 ${
          sheetOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="flex justify-center pt-4 pb-2 shrink-0">
          <div className="w-12 h-1.5 rounded-full bg-white/20" />
        </div>
        <div className="px-4 pb-4 flex justify-between items-center shrink-0 border-b border-white/5">
          <div>
            <h2 className="nn-headline-md text-white">Customise Meal</h2>
            <p className="nn-body-sm text-nn-secondary">Adjust portions and ingredients</p>
          </div>
          <button
            aria-label="Close"
            onClick={() => setSheetOpen(false)}
            className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-nn-secondary hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-4 py-4 overflow-y-auto flex-1 space-y-8">
          {/* Portion */}
          <section className="space-y-4">
            <h3 className="nn-label-caps text-nn-secondary tracking-widest">Portion Size</h3>
            <div className="nn-glass rounded-xl divide-y divide-white/5">
              {PORTIONS.map((p) => {
                const active = p.id === portion;
                return (
                  <label
                    key={p.id}
                    className="flex items-center justify-between p-4 h-[60px] cursor-pointer hover:bg-white/5 transition-colors"
                    onClick={() => setPortion(p.id)}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center ${
                          active ? "border-2 border-nn-primary" : "border border-white/20"
                        }`}
                      >
                        {active && <span className="w-2.5 h-2.5 rounded-full bg-nn-primary" />}
                      </span>
                      <span className="nn-body-lg text-white">{p.label}</span>
                    </span>
                    <span className="nn-body-sm text-nn-secondary tabular-nums">{p.kcal} kcal</span>
                  </label>
                );
              })}
            </div>
          </section>

          {/* Add-ons */}
          <section className="space-y-4">
            <h3 className="nn-label-caps text-nn-secondary tracking-widest">Add-ons</h3>
            <div className="nn-glass rounded-xl divide-y divide-white/5">
              {ADDONS.map((a) => {
                const on = addons.has(a.id);
                return (
                  <label
                    key={a.id}
                    className="flex items-center justify-between p-4 h-[60px] cursor-pointer hover:bg-white/5 transition-colors"
                    onClick={() => setAddons((s) => toggle(s, a.id))}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className={`w-5 h-5 rounded flex items-center justify-center ${
                          on ? "bg-nn-primary" : "border border-white/20"
                        }`}
                      >
                        {on && <Check size={16} weight="bold" className="text-nn-on-primary-container" />}
                      </span>
                      <span className="nn-body-lg text-white">{a.label}</span>
                    </span>
                    <span className="nn-body-sm text-nn-secondary tabular-nums">+{a.kcal} kcal</span>
                  </label>
                );
              })}
            </div>
          </section>

          {/* Removals */}
          <section className="space-y-4">
            <h3 className="nn-label-caps text-nn-secondary tracking-widest">Remove Ingredients</h3>
            <div className="flex flex-wrap gap-3">
              {REMOVALS.map((r) => {
                const on = removals.has(r);
                return (
                  <button
                    key={r}
                    onClick={() => setRemovals((s) => toggle(s, r))}
                    className={`h-11 px-4 rounded-full nn-glass flex items-center gap-2 transition-colors ${
                      on ? "border border-nn-primary bg-nn-primary/10" : "border border-white/10 hover:border-white/30"
                    }`}
                  >
                    <Prohibit size={18} className={on ? "text-nn-primary" : "text-nn-secondary"} />
                    <span className={`nn-body-sm ${on ? "text-nn-primary" : "text-white"}`}>{r}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="h-24" />
        </div>

        {/* Sticky CTA */}
        <div className="absolute bottom-0 inset-x-0 p-4 pt-8 bg-gradient-to-t from-nn-surface-low via-nn-surface-low to-transparent">
          <button
            onClick={() => setSheetOpen(false)}
            className="w-full h-14 rounded-xl bg-nn-primary text-nn-on-primary-container flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(251,191,36,0.25)] hover:brightness-110 active:scale-[0.98] transition-all"
          >
            <span className="font-semibold">Update Selection</span>
            <span className="nn-body-sm opacity-80 border-l border-nn-on-primary-container/20 pl-2 ml-2 tabular-nums">
              {totalKcal} kcal
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
