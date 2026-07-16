import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, SealCheck, Check, X, Prohibit, Warning, ShieldCheck } from "@phosphor-icons/react";
import { SPRING } from "@/lib/motion";
import {
  useMenuCatalog,
  getAllergenDisclosure,
  macrosAreProvisional,
  type DishData,
  type AllergenDisclosure,
} from "@/lib/menuData";
import { useCartStore } from "@/lib/cartContext";

/**
 * Dish Detail (Customise) — Stitch "Tanmatra Premium Home" screen 9cde04bc… on
 * the Nocturnal Nourishment design system, wired to the LIVE catalog.
 *
 * Honest health-data rendering (non-negotiable):
 *  - Allergens go through getAllergenDisclosure(): an empty/unreviewed list is
 *    rendered as "unverified — held for safety", NEVER as "safe/none".
 *  - Macros are hidden when provisional and prefixed "~" + labelled "Estimated"
 *    when macrosEstimated. No "RD Verified/Checked" badge is shown — no dish
 *    carries a review record to back it (audit T2.1), so the claim is omitted.
 *  - Prices come from the dish record (paise), never a hardcoded ₹ literal.
 * Motion: only transform/opacity, spring physics. Zustand for the shared cart.
 */

const PORTIONS = [
  { id: "light", label: "Light (0.75×)", mult: 0.75 },
  { id: "standard", label: "Standard (1×)", mult: 1 },
  { id: "large", label: "Large (1.5×)", mult: 1.5 },
] as const;

const ADDONS = [
  { id: "avocado", label: "Extra Avocado", kcal: 50 },
  { id: "seeds", label: "Hemp Seeds", kcal: 30 },
];

const rupees = (paise: number) => `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;

function AllergenDisclosureBar({ disclosure }: { disclosure: AllergenDisclosure }) {
  if (disclosure.state === "unchecked") {
    // Fail closed: an empty/unreviewed list is UNVERIFIED, not "no allergens".
    return (
      <div className="nn-glass rounded-lg p-3 flex items-center gap-3 border border-nn-error/30 bg-nn-error/5">
        <Warning size={18} weight="fill" className="text-nn-error shrink-0" />
        <span className="nn-body-sm text-nn-error">
          Allergen data unverified — held back for safety
        </span>
      </div>
    );
  }
  if (disclosure.state === "derived") {
    return (
      <div className="nn-glass rounded-lg p-3 flex items-center gap-3 border border-nn-primary/20 bg-nn-primary/5">
        <span className="nn-label-caps text-nn-primary shrink-0">Auto-detected:</span>
        <span className="nn-body-sm text-white">
          {disclosure.allergens.length ? disclosure.allergens.join(", ") : "none"} · not RD-confirmed
        </span>
      </div>
    );
  }
  // reviewed
  return (
    <div className="nn-glass rounded-lg p-3 flex items-center gap-3 border border-white/10">
      <span className="nn-label-caps text-nn-on-surface-variant shrink-0">
        {disclosure.allergens.length ? "Contains:" : "Allergens:"}
      </span>
      <span className="nn-body-sm text-white">
        {disclosure.allergens.length ? disclosure.allergens.join(", ") : "None declared (reviewed)"}
      </span>
    </div>
  );
}

export default function StitchDishDetail() {
  const { dishes } = useMenuCatalog();
  // Representative real dish (prefer avocado-toast, else the first live dish).
  const dish: DishData | undefined =
    dishes.find((d) => d.slug === "avocado-toast") ?? dishes[0];

  const [sheetOpen, setSheetOpen] = useState(false);
  const [portion, setPortion] = useState<(typeof PORTIONS)[number]["id"]>("standard");
  const [addons, setAddons] = useState<Set<string>>(new Set());
  const [removals, setRemovals] = useState<Set<string>>(new Set());
  // Production cart — same store /cart and checkout read.
  const cartCount = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0));
  const addItem = useCartStore((s) => s.addItem);

  const disclosure = useMemo(
    () => getAllergenDisclosure(dish ?? { allergens: [] }),
    [dish],
  );
  const provisional = dish ? macrosAreProvisional(dish) : true;
  const estimated = !!dish?.macrosEstimated;
  const tilde = estimated ? "~" : "";

  const totalKcal = useMemo(() => {
    if (!dish || provisional) return null;
    const mult = PORTIONS.find((p) => p.id === portion)?.mult ?? 1;
    const add = ADDONS.filter((a) => addons.has(a.id)).reduce((s, a) => s + a.kcal, 0);
    return Math.round(dish.macros.calories * mult) + add;
  }, [dish, provisional, portion, addons]);

  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  };

  if (!dish) return null;

  return (
    <div className="relative min-h-dvh bg-nn-bg text-nn-on-surface overflow-hidden">
      {/* Main content — dims/blurs (non-animated) behind the sheet */}
      <main className={`h-full w-full overflow-y-auto pb-32 ${sheetOpen ? "blur-md brightness-50 pointer-events-none" : ""}`}>
        {/* Hero — fixed height reserves space (CLS = 0) */}
        <div className="relative w-full h-[442px] md:h-[530px] max-w-screen-md mx-auto">
          <div className="w-full h-full rounded-b-3xl bg-gradient-to-b from-nn-surface to-nn-bg" />
          <div className="absolute top-0 inset-x-0 flex justify-between items-center p-4 bg-gradient-to-b from-black/60 to-transparent">
            <button aria-label="Back" className="w-11 h-11 rounded-full nn-glass flex items-center justify-center hover:bg-white/10 transition-colors">
              <ArrowLeft size={20} className="text-white" />
            </button>
          </div>
          <div className="absolute top-4 right-4">
            <span className="nn-glass px-3 py-1.5 rounded-full nn-label-caps text-white">{dish.category}</span>
          </div>
        </div>

        {/* Details */}
        <div className="max-w-screen-md mx-auto px-4 py-8 space-y-8">
          <div className="space-y-4">
            <div>
              <h1 className="nn-display-lg-mobile text-white mb-2">{dish.name}</h1>
              <p className="nn-body-sm text-nn-secondary">{dish.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="nn-glass px-3 py-1 rounded-full flex items-center gap-1.5 nn-label-caps text-white">
                <span className={`w-2 h-2 rounded-full ${dish.isVeg ? "bg-clinical-sage" : "bg-nn-error"}`} />
                {dish.isVeg ? "Veg" : "Non-veg"}
              </span>
              <span className="nn-glass px-3 py-1 rounded-full nn-label-caps text-white">GI {dish.glycaemicIndex}</span>
            </div>
            <AllergenDisclosureBar disclosure={disclosure} />
          </div>

          {/* Nutrition — honest: hidden when provisional, ~ when estimated, no RD-Checked badge */}
          {provisional ? (
            <div className="nn-glass rounded-xl p-4 flex items-center gap-3 border border-nn-primary/20">
              <Warning size={18} className="text-nn-primary shrink-0" />
              <span className="nn-body-sm text-nn-on-surface-variant">Nutrition profile pending verification.</span>
            </div>
          ) : (
            <div className="nn-glass rounded-xl p-4 grid grid-cols-4 gap-4 divide-x divide-white/10">
              {[
                { label: "Calories", value: `${tilde}${dish.macros.calories}` },
                { label: "Protein", value: `${tilde}${dish.macros.protein}g` },
                { label: "Glycemic", value: dish.glycaemicIndex },
              ].map((s) => (
                <div key={s.label} className="text-center first:pl-0 pl-4">
                  <div className="nn-micro-data text-nn-secondary uppercase mb-1">{s.label}</div>
                  <div className="nn-body-lg font-semibold text-white tabular-nums">{s.value}</div>
                </div>
              ))}
              {/* Honest trust signal: the allergen-review state (backed), not an RD badge */}
              <div className="text-center pl-4">
                <div className="nn-micro-data text-nn-secondary uppercase mb-1">Source</div>
                <div className={`flex items-center justify-center gap-1 ${estimated ? "text-nn-secondary" : "text-nn-primary"}`}>
                  {estimated ? <Warning size={14} /> : <SealCheck size={14} weight="fill" />}
                  <span className="nn-micro-data font-bold uppercase">{estimated ? "Est." : "Measured"}</span>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={() => setSheetOpen(true)}
            className="w-full h-14 min-h-[44px] rounded-xl border border-nn-primary text-nn-primary nn-label-caps hover:bg-nn-primary/10 active:scale-95 transition-all"
          >
            Customise Meal
          </button>
        </div>
      </main>

      {/* Bottom sheet — Framer Motion spring (transform/opacity only) */}
      <AnimatePresence>
        {sheetOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSheetOpen(false)}
            />
            <motion.div
              className="fixed bottom-0 inset-x-0 z-50 bg-nn-surface-low rounded-t-3xl border-t border-white/10 shadow-[0_-8px_32px_rgba(0,0,0,0.8)] flex flex-col max-h-[85dvh]"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={SPRING.soft}
            >
              <div className="flex justify-center pt-4 pb-2 shrink-0">
                <div className="w-12 h-1.5 rounded-full bg-white/20" />
              </div>
              <div className="px-4 pb-4 flex justify-between items-center shrink-0 border-b border-white/5">
                <div>
                  <h2 className="nn-headline-md text-white">Customise Meal</h2>
                  <p className="nn-body-sm text-nn-secondary">Adjust portions and ingredients</p>
                </div>
                <button aria-label="Close" onClick={() => setSheetOpen(false)} className="w-11 h-11 min-h-[44px] rounded-full bg-white/5 flex items-center justify-center text-nn-secondary hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="px-4 py-4 overflow-y-auto flex-1 space-y-8">
                <section className="space-y-4">
                  <h3 className="nn-label-caps text-nn-secondary tracking-widest">Portion Size</h3>
                  <div className="nn-glass rounded-xl divide-y divide-white/5">
                    {PORTIONS.map((p) => {
                      const active = p.id === portion;
                      const kcal = provisional ? null : Math.round(dish.macros.calories * p.mult);
                      return (
                        <button key={p.id} onClick={() => setPortion(p.id)} className="w-full flex items-center justify-between p-4 min-h-[60px] hover:bg-white/5 transition-colors">
                          <span className="flex items-center gap-3">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center ${active ? "border-2 border-nn-primary" : "border border-white/20"}`}>
                              {active && <span className="w-2.5 h-2.5 rounded-full bg-nn-primary" />}
                            </span>
                            <span className="nn-body-lg text-white">{p.label}</span>
                          </span>
                          <span className="nn-body-sm text-nn-secondary tabular-nums">{kcal !== null ? `${tilde}${kcal} kcal` : "—"}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="space-y-4">
                  <h3 className="nn-label-caps text-nn-secondary tracking-widest">Add-ons</h3>
                  <div className="nn-glass rounded-xl divide-y divide-white/5">
                    {ADDONS.map((a) => {
                      const on = addons.has(a.id);
                      return (
                        <button key={a.id} onClick={() => setAddons((s) => toggle(s, a.id))} className="w-full flex items-center justify-between p-4 min-h-[60px] hover:bg-white/5 transition-colors">
                          <span className="flex items-center gap-3">
                            <span className={`w-5 h-5 rounded flex items-center justify-center ${on ? "bg-nn-primary" : "border border-white/20"}`}>
                              {on && <Check size={16} weight="bold" className="text-nn-on-primary-container" />}
                            </span>
                            <span className="nn-body-lg text-white">{a.label}</span>
                          </span>
                          <span className="nn-body-sm text-nn-secondary tabular-nums">+{a.kcal} kcal</span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="space-y-4">
                  <h3 className="nn-label-caps text-nn-secondary tracking-widest">Remove Ingredients</h3>
                  <div className="flex flex-wrap gap-3">
                    {["No Cilantro", "No Chili Flakes"].map((r) => {
                      const on = removals.has(r);
                      return (
                        <button key={r} onClick={() => setRemovals((s) => toggle(s, r))} className={`h-11 min-h-[44px] px-4 rounded-full nn-glass flex items-center gap-2 transition-colors ${on ? "border border-nn-primary bg-nn-primary/10" : "border border-white/10 hover:border-white/30"}`}>
                          <Prohibit size={18} className={on ? "text-nn-primary" : "text-nn-secondary"} />
                          <span className={`nn-body-sm ${on ? "text-nn-primary" : "text-white"}`}>{r}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
                <div className="h-24" />
              </div>

              <div className="absolute bottom-0 inset-x-0 p-4 pt-8 bg-gradient-to-t from-nn-surface-low via-nn-surface-low to-transparent">
                <button
                  onClick={() => {
                    addItem({
                      dishId: dish.id,
                      slug: dish.slug,
                      name: dish.name,
                      image: dish.image ?? "",
                      basePrice: dish.price,
                      unitPrice: dish.price,
                      quantity: 1,
                      kitchen: dish.kitchen,
                      isVeg: dish.isVeg,
                      rdVerified: dish.rdVerified,
                      macros: {
                        protein: dish.macros.protein,
                        carbs: dish.macros.carbs,
                        fat: dish.macros.fat,
                        fiber: dish.macros.fiber,
                        calories: dish.macros.calories,
                      },
                      // Carry the buyer's customise selections onto the cart line.
                      customizations: [
                        portion !== "standard"
                          ? PORTIONS.find((p) => p.id === portion)?.label ?? ""
                          : "",
                        ...ADDONS.filter((a) => addons.has(a.id)).map((a) => `+ ${a.label}`),
                        ...[...removals],
                      ].filter(Boolean),
                    });
                    setSheetOpen(false);
                  }}
                  className="w-full h-14 min-h-[44px] rounded-xl bg-nn-primary text-nn-on-primary-container flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(251,191,36,0.25)] hover:brightness-110 active:scale-[0.98] transition-all"
                >
                  <span className="font-semibold">Add · {rupees(dish.price)}</span>
                  {totalKcal !== null && (
                    <span className="nn-body-sm opacity-80 border-l border-nn-on-primary-container/20 pl-2 ml-2 tabular-nums">{totalKcal} kcal</span>
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Cart badge (Zustand count) */}
      {cartCount > 0 && (
        <div className="fixed top-4 right-4 z-30 flex items-center gap-1.5 nn-glass rounded-full px-3 py-1.5">
          <ShieldCheck size={16} className="text-nn-primary" />
          <span className="nn-micro-data text-white tabular-nums">{cartCount} in cart</span>
        </div>
      )}
    </div>
  );
}
