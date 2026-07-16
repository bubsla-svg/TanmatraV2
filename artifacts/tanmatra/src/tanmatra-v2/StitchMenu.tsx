import { useState, type ReactNode } from "react";
import {
  CaretLeft,
  Bell,
  Plus,
  ForkKnife,
  CalendarBlank,
  ChartLineUp,
  User,
  ShoppingBag,
} from "@phosphor-icons/react";

/**
 * Menu (Asymmetric & iOS Refined)
 * Ported from the Stitch "Tanmatra Premium Home" project
 * (screen projects/9545397915295144685/screens/f013ee65…) on the approved
 * **Nocturnal Nourishment** design system.
 *
 * Tokens: index.css @theme (`--color-nn-*`, `--font-nn-label`) + the `.nn-*`
 * type/surface classes. Icons are Phosphor (CLAUDE.md: Phosphor on new customer
 * surfaces). Dish content + prices below are representative demo data — wiring
 * live `useMenuCatalog()` dishes into the bento slots is the next step.
 */

const CATEGORIES = [
  "All Dishes",
  "High Protein",
  "Ketogenic",
  "Cognitive Boost",
  "Recovery",
] as const;

// Prices are paise (never a `₹NNN` literal — lint:prices) and demo-only.
const rupees = (paise: number) =>
  `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;

const FEATURE = {
  name: "Black Ginger Glazed Salmon",
  tag: "BIO-ENGINEERED",
  macros: ["620 kcal", "42g Protein", "Low Carb"],
};
const SMALLS = [
  {
    name: "Precision Keto Bowl",
    blurb: "High-fat, ultra-low carb focus for sustained focus.",
    pricePaise: 149000,
  },
  {
    name: "Dark Nocturne Mousse",
    blurb: "Magnesium-rich recovery dessert with 20g whey.",
    pricePaise: 116000,
  },
];
const WIDE = {
  eyebrow: "Peak Cognitive",
  name: "Truffle Wagyu Stack",
  blurb:
    "Creatine-dense premium cut paired with neuro-supportive mushroom complex.",
  proteinG: 52,
  proteinPct: 85,
};

/** Faithful dark-glass media slot (swap for <img src={dish.image}/> when wired). */
function Media({
  className = "",
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-nn-surface ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] to-transparent" />
      {children}
    </div>
  );
}

export default function StitchMenu() {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All Dishes");
  const [added, setAdded] = useState<string | null>(null);
  const [cart, setCart] = useState(2);

  const addToCart = (id: string) => {
    setAdded(id);
    setCart((c) => c + 1);
    window.setTimeout(() => setAdded((a) => (a === id ? null : a)), 1500);
  };

  return (
    <div className="min-h-dvh bg-nn-bg text-nn-on-surface nn-body-lg antialiased">
      {/* Header (TopAppBar) */}
      <header className="fixed top-0 inset-x-0 z-50 h-16 px-4 flex items-center justify-between bg-nn-bg/80 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-4">
          <button
            aria-label="Back"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-95 transition-transform"
          >
            <CaretLeft size={22} className="text-nn-on-surface" />
          </button>
          <h1 className="nn-label-caps tracking-[0.2em] text-nn-primary">
            Nocturnal Nourishment
          </h1>
        </div>
        <button
          aria-label="Notifications"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-95 transition-transform"
        >
          <Bell size={22} className="text-nn-on-surface" />
        </button>
      </header>

      <main className="pt-24 pb-32 px-4 max-w-screen-xl mx-auto">
        {/* Hero */}
        <section className="mb-8 flex flex-col gap-2">
          <span className="nn-label-caps text-nn-primary">Optimal Performance</span>
          <h2 className="nn-display-lg-mobile">The Fuel Menu</h2>
          <p className="nn-body-sm text-nn-on-surface-variant max-w-md">
            Scientifically curated meals engineered for nocturnal metabolic
            optimization and peak cognitive clarity.
          </p>
        </section>

        {/* Sticky category scroll */}
        <div className="sticky top-16 z-40 -mx-4 px-4 py-4 mb-4 bg-black/70 backdrop-blur-md overflow-x-auto [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-4 whitespace-nowrap">
            {CATEGORIES.map((c) => {
              const active = c === category;
              return (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`px-5 py-2 min-h-[44px] rounded-full nn-glass nn-label-caps transition-colors ${
                    active
                      ? "border-nn-primary/40 text-nn-primary"
                      : "text-nn-on-surface-variant hover:bg-white/5"
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        {/* Asymmetric bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Large feature */}
          <div className="md:col-span-8 nn-glass rounded-3xl p-4 flex flex-col gap-4">
            <Media className="w-full aspect-[16/9]">
              <div className="absolute top-4 left-4 flex gap-2">
                <span className="px-3 py-1 nn-glass rounded-full nn-micro-data text-nn-primary border border-nn-primary/20">
                  {FEATURE.tag}
                </span>
              </div>
            </Media>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="flex flex-col gap-1">
                <h3 className="nn-headline-md text-nn-on-surface">{FEATURE.name}</h3>
                <div className="flex gap-2 flex-wrap">
                  {FEATURE.macros.map((m) => (
                    <span
                      key={m}
                      className="nn-micro-data px-2 py-0.5 rounded-full border border-white/10 uppercase"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => addToCart(FEATURE.name)}
                className={`font-bold px-8 py-3 min-h-[44px] rounded-2xl active:scale-95 transition-all nn-amber-glow ${
                  added === FEATURE.name
                    ? "bg-nn-tertiary text-nn-bg"
                    : "bg-nn-primary text-nn-on-primary"
                }`}
              >
                {added === FEATURE.name ? "Added" : "Add to Cart"}
              </button>
            </div>
          </div>

          {/* Two small verticals */}
          {SMALLS.map((d) => (
            <div
              key={d.name}
              className="md:col-span-4 nn-glass rounded-3xl p-4 flex flex-col gap-4"
            >
              <Media className="w-full aspect-square" />
              <div className="flex flex-col gap-3 h-full justify-between">
                <div>
                  <h3 className="nn-body-lg font-semibold text-nn-on-surface">{d.name}</h3>
                  <p className="nn-body-sm text-nn-on-surface-variant mt-1">{d.blurb}</p>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <span className="nn-headline-md text-nn-primary tabular-nums">
                    {rupees(d.pricePaise)}
                  </span>
                  <button
                    aria-label={`Add ${d.name}`}
                    onClick={() => addToCart(d.name)}
                    className="w-12 h-12 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-2xl nn-glass active:scale-90 transition-transform"
                  >
                    <Plus
                      size={20}
                      weight={added === d.name ? "fill" : "regular"}
                      className={added === d.name ? "text-nn-tertiary" : "text-nn-on-surface"}
                    />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Wide feature */}
          <div className="md:col-span-8 nn-glass rounded-3xl p-4 flex flex-col md:flex-row gap-4">
            <Media className="w-full md:w-1/2 aspect-square md:aspect-auto" />
            <div className="flex flex-col justify-between w-full md:w-1/2 py-2">
              <div className="flex flex-col gap-2">
                <span className="nn-label-caps text-nn-tertiary">{WIDE.eyebrow}</span>
                <h3 className="nn-headline-md text-nn-on-surface">{WIDE.name}</h3>
                <p className="nn-body-sm text-nn-on-surface-variant">{WIDE.blurb}</p>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between nn-micro-data">
                    <span className="text-nn-on-surface-variant">Protein</span>
                    <span className="text-nn-primary">{WIDE.proteinG}g</span>
                  </div>
                  <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-nn-primary"
                      style={{ width: `${WIDE.proteinPct}%` }}
                    />
                  </div>
                </div>
              </div>
              <button className="mt-6 w-full py-4 min-h-[44px] rounded-2xl border border-nn-primary text-nn-primary nn-label-caps hover:bg-nn-primary/10 active:scale-95 transition-all">
                Buy Now
              </button>
            </div>
          </div>
        </div>

        {/* Featured Dietitian Pick */}
        <section className="mt-8 relative overflow-hidden rounded-3xl nn-glass p-8 flex flex-col md:flex-row items-center gap-8 border-l-4 border-nn-primary">
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-nn-primary animate-pulse" />
              <span className="nn-label-caps text-nn-on-surface-variant">Dietitian Choice</span>
            </div>
            <h3 className="nn-headline-md">Phase-2 Recovery Meal</h3>
            <p className="nn-body-sm text-nn-on-surface-variant">
              Designed to lower cortisol levels post-deep-work sessions while
              supporting muscle synthesis.
            </p>
            <button className="nn-label-caps underline decoration-nn-primary underline-offset-4 tracking-widest text-nn-primary min-h-[44px]">
              View Science Data
            </button>
          </div>
          <div className="w-24 h-24 rounded-full border-2 border-nn-primary/20 p-1">
            <div className="w-full h-full rounded-full bg-nn-surface" />
          </div>
        </section>
      </main>

      {/* Bottom nav (BottomNavBar) */}
      <nav className="fixed bottom-0 inset-x-0 z-50 h-20 px-2 flex justify-around items-center bg-nn-bg/90 backdrop-blur-xl border-t border-white/10">
        {[
          { icon: ForkKnife, label: "Fuel", active: true },
          { icon: CalendarBlank, label: "Plan", active: false },
          { icon: ChartLineUp, label: "Track", active: false },
          { icon: User, label: "Profile", active: false },
        ].map(({ icon: Icon, label, active }) => (
          <button
            key={label}
            className={`flex flex-col items-center justify-center gap-1 min-h-[44px] min-w-[44px] active:scale-90 transition-transform ${
              active
                ? "text-nn-primary"
                : "text-nn-on-surface-variant/60 hover:text-nn-primary/80"
            }`}
          >
            <Icon size={24} weight={active ? "fill" : "regular"} className={active ? "nn-nav-glow" : ""} />
            <span className="nn-label-caps">{label}</span>
          </button>
        ))}
      </nav>

      {/* Floating cart */}
      <button
        aria-label="Cart"
        className="fixed bottom-24 right-4 z-50 w-14 h-14 min-h-[44px] rounded-2xl bg-nn-primary text-nn-on-primary flex items-center justify-center nn-amber-glow active:scale-90 transition-transform"
      >
        <span className="relative">
          <ShoppingBag size={24} />
          {cart > 0 && (
            <span className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-nn-on-surface text-nn-bg nn-micro-data font-bold flex items-center justify-center">
              {cart}
            </span>
          )}
        </span>
      </button>
    </div>
  );
}
