import { useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  CaretLeft, Bell, Plus, ForkKnife, CalendarBlank, ChartLineUp, User, ShoppingBag,
} from "@phosphor-icons/react";
import { FADE_IN_UP, SPRING } from "@/lib/motion";
import {
  useMenuCatalog,
  getAllergenDisclosure,
  macrosAreProvisional,
  type DishData,
} from "@/lib/menuData";
import { useStitchCart } from "./stitchCartStore";

/**
 * Menu (Asymmetric & iOS Refined) — Stitch "Tanmatra Premium Home" screen
 * f013ee65… on the Nocturnal Nourishment design system, wired to the LIVE
 * catalog (useMenuCatalog / TanStack Query).
 *
 * Honest health-data rendering: every dish's macros run through
 * macrosAreProvisional() (hidden when provisional, "~" when estimated) and
 * allergens through getAllergenDisclosure() — an empty/unreviewed list shows an
 * "unverified" dot, never "safe". Prices come from dish.price (paise). No macro
 * number or badge the record can't back is rendered. Motion: transform/opacity
 * spring only; Zustand for the shared cart.
 */

const CATEGORIES = ["All Dishes", "High Protein", "Low GI", "Vegetarian", "Recovery"] as const;

const rupees = (paise: number) => `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;

/** Honest macro chip text for a dish, or a "pending" note when provisional. */
function macroChips(dish: DishData): string[] {
  if (macrosAreProvisional(dish)) return ["Nutrition pending"];
  const t = dish.macrosEstimated ? "~" : "";
  return [`${t}${dish.macros.calories} kcal`, `${t}${dish.macros.protein}g protein`, `GI ${dish.glycaemicIndex}`];
}

/** Small honest allergen indicator: unverified is a warning, never "safe". */
function AllergenDot({ dish }: { dish: DishData }) {
  const d = getAllergenDisclosure(dish);
  if (d.state === "unchecked") {
    return <span className="nn-micro-data text-nn-error">Allergens unverified</span>;
  }
  if (d.state === "derived") {
    return <span className="nn-micro-data text-nn-primary">Allergens: auto-detected</span>;
  }
  return (
    <span className="nn-micro-data text-nn-on-surface-variant">
      {d.allergens.length ? `Contains ${d.allergens.length}` : "No allergens (reviewed)"}
    </span>
  );
}

function Media({ className = "", children }: { className?: string; children?: ReactNode }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-nn-surface ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] to-transparent" />
      {children}
    </div>
  );
}

export default function StitchMenu() {
  const { dishes } = useMenuCatalog();
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All Dishes");
  const cartCount = useStitchCart((s) => s.count);
  const add = useStitchCart((s) => s.add);
  const [added, setAdded] = useState<string | null>(null);

  const bento = useMemo(() => dishes.filter((d) => d.isAvailable !== false).slice(0, 4), [dishes]);

  if (bento.length < 4) return null;
  const [feature, small1, small2, wide] = bento;

  const addDish = (d: DishData) => {
    add({ slug: d.slug, name: d.name, pricePaise: d.price, kcal: macrosAreProvisional(d) ? 0 : d.macros.calories });
    setAdded(d.slug);
    window.setTimeout(() => setAdded((a) => (a === d.slug ? null : a)), 1500);
  };

  return (
    <div className="min-h-dvh bg-nn-bg text-nn-on-surface nn-body-lg antialiased">
      <header className="fixed top-0 inset-x-0 z-50 h-16 px-4 flex items-center justify-between bg-nn-bg/80 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-4">
          <button aria-label="Back" className="min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-95 transition-transform">
            <CaretLeft size={22} className="text-nn-on-surface" />
          </button>
          <h1 className="nn-label-caps tracking-[0.2em] text-nn-primary">Nocturnal Nourishment</h1>
        </div>
        <button aria-label="Notifications" className="min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-95 transition-transform">
          <Bell size={22} className="text-nn-on-surface" />
        </button>
      </header>

      <main className="pt-24 pb-32 px-4 max-w-screen-xl mx-auto">
        <section className="mb-8 flex flex-col gap-2">
          <span className="nn-label-caps text-nn-primary">Optimal Performance</span>
          <h2 className="nn-display-lg-mobile">The Fuel Menu</h2>
          <p className="nn-body-sm text-nn-on-surface-variant max-w-md">
            Scientifically curated meals engineered for nocturnal metabolic optimization and peak cognitive clarity.
          </p>
        </section>

        <div className="sticky top-16 z-40 -mx-4 px-4 py-4 mb-4 bg-black/70 backdrop-blur-md overflow-x-auto [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-4 whitespace-nowrap">
            {CATEGORIES.map((c) => {
              const active = c === category;
              return (
                <button key={c} onClick={() => setCategory(c)}
                  className={`px-5 py-2 min-h-[44px] rounded-full nn-glass nn-label-caps transition-colors ${active ? "border-nn-primary/40 text-nn-primary" : "text-nn-on-surface-variant hover:bg-white/5"}`}>
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Large feature */}
          <motion.div variants={FADE_IN_UP} initial="hidden" animate="show" className="md:col-span-8 nn-glass rounded-3xl p-4 flex flex-col gap-4">
            <Media className="w-full aspect-[16/9]">
              <div className="absolute top-4 left-4 flex gap-2">
                <span className="px-3 py-1 nn-glass rounded-full nn-micro-data text-nn-primary border border-nn-primary/20 uppercase">{feature.kitchen}</span>
              </div>
            </Media>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="flex flex-col gap-1">
                <h3 className="nn-headline-md text-nn-on-surface">{feature.name}</h3>
                <div className="flex gap-2 flex-wrap">
                  {macroChips(feature).map((m) => (
                    <span key={m} className="nn-micro-data px-2 py-0.5 rounded-full border border-white/10 uppercase tabular-nums">{m}</span>
                  ))}
                </div>
                <AllergenDot dish={feature} />
              </div>
              <button onClick={() => addDish(feature)}
                className={`font-bold px-6 py-3 min-h-[44px] rounded-2xl active:scale-95 transition-all nn-amber-glow tabular-nums ${added === feature.slug ? "bg-nn-tertiary text-nn-bg" : "bg-nn-primary text-nn-on-primary-container"}`}>
                {added === feature.slug ? "Added" : `Add · ${rupees(feature.price)}`}
              </button>
            </div>
          </motion.div>

          {/* Two small verticals */}
          {[small1, small2].map((d) => (
            <motion.div key={d.slug} variants={FADE_IN_UP} initial="hidden" animate="show" className="md:col-span-4 nn-glass rounded-3xl p-4 flex flex-col gap-4">
              <Media className="w-full aspect-square" />
              <div className="flex flex-col gap-3 h-full justify-between">
                <div>
                  <h3 className="nn-body-lg font-semibold text-nn-on-surface">{d.name}</h3>
                  <p className="nn-body-sm text-nn-on-surface-variant mt-1 line-clamp-2">{d.description}</p>
                  <div className="mt-1"><AllergenDot dish={d} /></div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="nn-headline-md text-nn-primary tabular-nums">{rupees(d.price)}</span>
                  <button aria-label={`Add ${d.name}`} onClick={() => addDish(d)}
                    className="w-12 h-12 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-2xl nn-glass active:scale-90 transition-transform">
                    <Plus size={20} weight={added === d.slug ? "fill" : "regular"} className={added === d.slug ? "text-nn-tertiary" : "text-nn-on-surface"} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}

          {/* Wide feature */}
          <motion.div variants={FADE_IN_UP} initial="hidden" animate="show" className="md:col-span-8 nn-glass rounded-3xl p-4 flex flex-col md:flex-row gap-4">
            <Media className="w-full md:w-1/2 aspect-square md:aspect-auto" />
            <div className="flex flex-col justify-between w-full md:w-1/2 py-2">
              <div className="flex flex-col gap-2">
                <span className="nn-label-caps text-nn-tertiary">GI {wide.glycaemicIndex}</span>
                <h3 className="nn-headline-md text-nn-on-surface">{wide.name}</h3>
                <p className="nn-body-sm text-nn-on-surface-variant line-clamp-2">{wide.description}</p>
                {!macrosAreProvisional(wide) && (
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between nn-micro-data">
                      <span className="text-nn-on-surface-variant">Protein</span>
                      <span className="text-nn-primary tabular-nums">{wide.macrosEstimated ? "~" : ""}{wide.macros.protein}g</span>
                    </div>
                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                      <motion.div className="h-full bg-nn-primary" initial={{ scaleX: 0 }} animate={{ scaleX: Math.min(1, wide.macros.protein / 50) }} style={{ originX: 0 }} transition={SPRING.soft} />
                    </div>
                  </div>
                )}
                <AllergenDot dish={wide} />
              </div>
              <button onClick={() => addDish(wide)} className="mt-6 w-full py-4 min-h-[44px] rounded-2xl border border-nn-primary text-nn-primary nn-label-caps hover:bg-nn-primary/10 active:scale-95 transition-all tabular-nums">
                {added === wide.slug ? "Added" : `Add · ${rupees(wide.price)}`}
              </button>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 z-50 h-20 px-2 flex justify-around items-center bg-nn-bg/90 backdrop-blur-xl border-t border-white/10">
        {[
          { icon: ForkKnife, label: "Fuel", active: true },
          { icon: CalendarBlank, label: "Plan", active: false },
          { icon: ChartLineUp, label: "Track", active: false },
          { icon: User, label: "Profile", active: false },
        ].map(({ icon: Icon, label, active }) => (
          <button key={label} className={`flex flex-col items-center justify-center gap-1 min-h-[44px] min-w-[44px] active:scale-90 transition-transform ${active ? "text-nn-primary" : "text-nn-on-surface-variant/60 hover:text-nn-primary/80"}`}>
            <Icon size={24} weight={active ? "fill" : "regular"} className={active ? "nn-nav-glow" : ""} />
            <span className="nn-label-caps">{label}</span>
          </button>
        ))}
      </nav>

      {/* Floating cart (Zustand count) */}
      <button aria-label="Cart" className="fixed bottom-24 right-4 z-50 w-14 h-14 min-h-[44px] rounded-2xl bg-nn-primary text-nn-on-primary-container flex items-center justify-center nn-amber-glow active:scale-90 transition-transform">
        <span className="relative">
          <ShoppingBag size={24} />
          {cartCount > 0 && (
            <span className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-nn-on-surface text-nn-bg nn-micro-data font-bold flex items-center justify-center tabular-nums">{cartCount}</span>
          )}
        </span>
      </button>
    </div>
  );
}
