import { useState } from "react";
import { Link, type MetaFunction } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Check,
  ArrowRight,
  Sparkles,
  Leaf,
  Activity,
  Stethoscope,
  Pause,
  RefreshCw,
  Clock,
  MapPin,
  ChevronDown,
  SlidersHorizontal,
  CalendarDays,
  Flame,
  ShieldCheck,
} from "lucide-react";
import { DISHES, getDishBySlug } from "@/lib/menuData";
import { onDishImageError } from "@/lib/imgFallback";

export const meta: MetaFunction = () => [
  { title: "Meal Plans | Tanmatra" },
  {
    name: "description",
    content:
      "Chef-made, dietitian-approved meal plans on autopilot. Start with a 3-day trial at 25% off, then subscribe weekly, fortnightly, or monthly. Pause or skip anytime.",
  },
  { property: "og:type", content: "website" },
  { property: "og:title", content: "Meal Plans | Tanmatra" },
  { property: "og:description", content: "Chef-made, dietitian-approved meal plans on autopilot. Subscribe weekly, fortnightly, or monthly — pause or skip anytime." },
  { property: "og:image", content: "https://tanmatra.food/opengraph.jpg" },
  { property: "og:url", content: "https://tanmatra.food/subscription-plans" },
  { name: "twitter:card", content: "summary_large_image" },
  { name: "twitter:title", content: "Meal Plans | Tanmatra" },
  { name: "twitter:description", content: "Chef-made, dietitian-approved meal plans on autopilot. Subscribe weekly, fortnightly, or monthly — pause or skip anytime." },
  { name: "twitter:image", content: "https://tanmatra.food/opengraph.jpg" },
  { tagName: "link", rel: "canonical", href: "https://tanmatra.food/subscription-plans" },
];

import { RD_PLANS } from "@/lib/rdPlans";

// Full curated catalog minus the trial (it has its own hero section above).
const GOAL_PLANS = RD_PLANS.filter((p) => p.slug !== "three-day-trial-pack");

// Per-meal list price mirrors the server (PER_MEAL_PAISE ₹260). Cadence
// discounts match subscriptions.ts CADENCE_DISCOUNT.
const PER_MEAL = 260;
const CADENCE_DISCOUNT = { weekly: 0.95, fortnightly: 0.9, monthly: 0.85 } as const;
type Cadence = keyof typeof CADENCE_DISCOUNT;

// D2C goal-framed plans. Each maps to a per-delivery meal count; the price
// is computed from the same primitives the configurator uses so the
// numbers never drift from what the user is actually charged.
const PLANS = [
  {
    id: "everyday",
    name: "Everyday Balanced",
    icon: Leaf,
    badge: "MOST POPULAR",
    popular: true,
    desc: "Clean, calorie-smart meals for busy weekdays. The default for most people.",
    mealsPerWeek: 5,
    features: [
      "350–550 kcal, macro-balanced",
      "Rotating veg & egg-based menu",
      "Swap any dish before it's cooked",
      "Free delivery on every drop",
    ],
    protocol: "wellness",
  },
  {
    id: "high-protein",
    name: "High-Protein",
    icon: Activity,
    badge: "TRAINING & RECOVERY",
    desc: "Protein-forward meals built around training days and muscle recovery.",
    mealsPerWeek: 6,
    features: [
      ">30g protein per meal",
      "Pre- & post-workout macro splits",
      "Lean meats & plant-protein options",
      "Weekly progress on your dashboard",
    ],
    protocol: "performance",
  },
];

export default function SubscriptionPlansLanding() {
  const [cadence, setCadence] = useState<Cadence>("weekly");
  const [sortBy, setSortBy] = useState<"popular" | "protein" | "calories" | "price">("popular");
  const [mealtimeFilter, setMealtimeFilter] = useState<"all" | "lunch_dinner" | "dinner">("all");
  const [vegOnly, setVegOnly] = useState(false);

  const priceFor = (mealsPerWeek: number) => {
    const perDelivery = Math.round(mealsPerWeek * PER_MEAL * CADENCE_DISCOUNT[cadence]);
    const deliveriesPerMonth =
      cadence === "weekly" ? 4 : cadence === "fortnightly" ? 2 : 1;
    return { perDelivery, perMonth: perDelivery * deliveriesPerMonth };
  };

  const filteredGoalPlans = GOAL_PLANS.filter((p) => {
    if (vegOnly && !p.dietaryStyles.some((d) => d === "vegetarian" || d === "vegan")) {
      return false;
    }
    return true;
  }).sort((a, b) => {
    if (sortBy === "protein") return b.proteinTargetGrams - a.proteinTargetGrams;
    if (sortBy === "calories") return a.calorieTargetPerDay - b.calorieTargetPerDay;
    if (sortBy === "price") return a.pricePerWeekPaise - b.pricePerWeekPaise;
    return 0;
  });

  return (
    <div className="bg-clinical-dark text-white min-h-screen pb-16">
      {/* Sticky Location Discovery Header */}
      <div className="sticky top-0 z-40 bg-clinical-dark/95 backdrop-blur-md border-b border-clinical-border px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 bg-clinical-surface border border-clinical-border/80 rounded-full px-3.5 py-1.5 cursor-pointer hover:border-clinical-gold/50 transition-colors max-w-sm sm:max-w-md min-w-0">
            <MapPin className="w-4 h-4 text-clinical-gold shrink-0" />
            <div className="min-w-0 text-left">
              <p className="text-[10px] uppercase font-bold tracking-wider text-clinical-zinc leading-none">Service area</p>
              <p className="text-xs font-medium text-white truncate mt-0.5">Delivering across Noida · Delhi · Gurgaon</p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-clinical-zinc shrink-0 ml-1" />
          </div>
          <Link to="/subscribe?trial=1">
            <Button size="sm" className="bg-clinical-gold text-stone-900 hover:bg-clinical-gold/90 text-xs font-semibold h-8 px-3.5 rounded-full">
              3-Day Trial
            </Button>
          </Link>
        </div>
      </div>

      {/* Hero */}
      <section className="py-12 md:py-16 px-4 text-center space-y-4 max-w-4xl mx-auto">
        <Badge className="bg-clinical-gold/15 text-clinical-gold border-clinical-gold/30 uppercase tracking-widest text-[10px] px-3 py-1">
          Healthy Subscriptions
        </Badge>
        <h1 className="text-clinical-h1 md:text-[clamp(2.25rem,1.4rem+2.6vw,3.25rem)] md:leading-[1.06] tracking-tight text-white font-extrabold">
          Healthy meals{" "}
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: "linear-gradient(to right, #" + "E7C766, var(--color-clinical-gold))" }}
          >
            delivered daily.
          </span>
        </h1>
        <p className="text-sm sm:text-base text-clinical-zinc max-w-lg mx-auto leading-relaxed">
          Chef-made, clinical dietitian-approved meals on autopilot. Pause, skip, or swap anytime up to 24 hours before delivery.
        </p>
        <div className="pt-2 flex justify-center">
          <a href="#all-kitchens">
            <Button className="bg-white text-stone-900 hover:bg-white/90 font-bold text-sm h-11 px-8 rounded-xl shadow-lg transition-transform hover:scale-[1.02] gap-2">
              Explore plans <ArrowRight className="w-4 h-4" />
            </Button>
          </a>
        </div>
      </section>

      {/* Plan Benefits Visual Showcase (Reference CRO Patterns) */}
      <section className="max-w-5xl mx-auto px-4 pb-12">
        <p className="text-xs uppercase tracking-[0.2em] font-extrabold text-clinical-gold mb-4 text-left">
          PLAN BENEFITS
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card
            className="border-clinical-border overflow-hidden relative group hover:border-clinical-gold/40 transition-all"
            style={{ background: "linear-gradient(to bottom right, var(--color-clinical-surface), var(--color-clinical-surface) 50%, #" + "0a151b)" }}
          >
            <CardContent className="p-5 flex flex-col justify-between h-48 sm:h-52">
              <div>
                <h3 className="text-lg font-extrabold text-white leading-snug">Flexibility to suit your daily mood</h3>
                <p className="text-xs text-clinical-zinc mt-1.5">Swap any dish in your schedule or pause deliveries with 1-click.</p>
              </div>
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-clinical-border/50 text-xs text-clinical-gold font-semibold">
                <CalendarDays className="w-4 h-4" /> No lock-in contracts
              </div>
            </CardContent>
          </Card>

          <Card
            className="border-clinical-border overflow-hidden relative group hover:border-clinical-gold/40 transition-all"
            style={{ background: "linear-gradient(to bottom right, var(--color-clinical-surface), var(--color-clinical-surface) 50%, #" + "0d1a12)" }}
          >
            <CardContent className="p-5 flex flex-col justify-between h-48 sm:h-52">
              <div>
                <h3 className="text-lg font-extrabold text-white leading-snug">High protein clinical meals</h3>
                <p className="text-xs text-clinical-zinc mt-1.5">Every meal signed off by clinical RDs to hit your exact macro goals.</p>
              </div>
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-clinical-border/50 text-xs text-clinical-sage font-semibold">
                <ShieldCheck className="w-4 h-4" /> FSSAI-licensed kitchen · ISO 22000-aligned processes
              </div>
            </CardContent>
          </Card>

          <Card
            className="border-clinical-border overflow-hidden relative group hover:border-clinical-gold/40 transition-all"
            style={{ background: "linear-gradient(to bottom right, var(--color-clinical-surface), var(--color-clinical-surface) 50%, #" + "1a160b)" }}
          >
            <CardContent className="p-5 flex flex-col justify-between h-48 sm:h-52">
              <div>
                <h3 className="text-lg font-extrabold text-white leading-snug">From top kitchens & RD partners</h3>
                <p className="text-xs text-clinical-zinc mt-1.5">Prepared fresh daily in temperature-controlled specialty kitchens.</p>
              </div>
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-clinical-border/50 text-xs text-clinical-gold font-semibold">
                <Stethoscope className="w-4 h-4" /> RD-partnered kitchen network
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Trial — the hero entry */}
      <section className="max-w-5xl mx-auto px-4 pb-12">
        <Card className="relative overflow-hidden border-clinical-gold/40 bg-gradient-to-br from-clinical-gold/12 via-clinical-gold/5 to-transparent rounded-2xl shadow-xl">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-clinical-gold/50 to-transparent" />
          <CardContent className="p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-1 space-y-3">
              <Badge className="bg-clinical-gold text-stone-900 text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5">
                Start here
              </Badge>
              <h2 className="text-2xl md:text-3xl font-bold text-white">
                3-Day Trial —{" "}
                <span className="text-clinical-gold">25% off</span>
              </h2>
              <p className="text-sm text-clinical-zinc max-w-md leading-relaxed">
                Nine meals over three days, matched to your goals. One-off, no commitment — see if Tanmatra fits your week before you subscribe.
              </p>
              <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-clinical-zinc pt-1">
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-clinical-gold" /> Breakfast, lunch & dinner
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-clinical-gold" /> Does not auto-renew
                </li>
              </ul>
            </div>
            <div className="shrink-0 md:text-right space-y-3">
              <div>
                <span className="text-3xl font-bold text-clinical-gold tabular-nums">
                  ₹{Math.round(9 * PER_MEAL * 0.75).toLocaleString("en-IN")}
                </span>
                <span className="text-sm text-clinical-zinc line-through tabular-nums ml-2">
                  ₹{(9 * PER_MEAL).toLocaleString("en-IN")}
                </span>
              </div>
              <Link to="/subscribe?trial=1" className="block">
                <Button className="w-full md:w-auto bg-clinical-gold text-stone-900 hover:bg-clinical-gold/90 font-semibold gap-2 h-11 px-6 rounded-xl">
                  Start 3-day trial <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Faceted Filter & Kitchen Discovery Section (Reference UI) */}
      <section id="all-kitchens" className="max-w-5xl mx-auto px-4 pt-4 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-clinical-border pb-5">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-clinical-gold font-semibold">
              CURATED MEAL ROTATIONS
            </p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-0.5">
              Pick your nutrition plan
            </h2>
          </div>

          {/* Reference Faceted Filter Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="appearance-none bg-clinical-surface border border-clinical-border hover:border-clinical-gold/40 text-xs font-semibold text-white rounded-xl pl-3 pr-8 py-2 focus:outline-none focus:ring-1 focus:ring-clinical-gold cursor-pointer"
              >
                <option value="popular">Sort: Popular</option>
                <option value="protein">Sort: High Protein</option>
                <option value="calories">Sort: Calorie Target</option>
                <option value="price">Sort: Price Low-High</option>
              </select>
              <SlidersHorizontal className="w-3.5 h-3.5 text-clinical-zinc absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <div className="relative">
              <select
                value={mealtimeFilter}
                onChange={(e) => setMealtimeFilter(e.target.value as any)}
                className="appearance-none bg-clinical-surface border border-clinical-border hover:border-clinical-gold/40 text-xs font-semibold text-white rounded-xl pl-3 pr-8 py-2 focus:outline-none focus:ring-1 focus:ring-clinical-gold cursor-pointer capitalize"
              >
                <option value="all">Mealtime: All Meals</option>
                <option value="lunch_dinner">Lunch & Dinner</option>
                <option value="dinner">Dinner Only</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-clinical-zinc absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <button
              onClick={() => setVegOnly(!vegOnly)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                vegOnly
                  ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-400"
                  : "bg-clinical-surface border-clinical-border text-white hover:border-clinical-gold/40"
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block border border-emerald-300" />
              Veg Plans
            </button>
          </div>
        </div>

        <p className="text-xs uppercase tracking-[0.16em] font-bold text-clinical-zinc">
          ALL KITCHENS & RD ROTATIONS ({filteredGoalPlans.length + PLANS.length})
        </p>

        {/* D2C Everyday / High-Protein Cards with Preview Carousels */}
        <div className="space-y-6">
          {PLANS.map((p) => {
            const Icon = p.icon;
            const { perDelivery } = priceFor(p.mealsPerWeek);
            // Real catalog dishes with real macros — never hardcoded nutrition
            // numbers. High-protein surfaces the actual top-protein dishes;
            // Everyday surfaces veg dishes. Both read straight from the record.
            const planDishes = (
              p.id === "high-protein"
                ? [...DISHES].sort(
                    (a, b) => (b.macros.protein ?? 0) - (a.macros.protein ?? 0),
                  )
                : DISHES.filter((d) => d.isVeg)
            ).slice(0, 3);
            return (
              <Card
                key={p.id}
                className="bg-clinical-surface border-clinical-border rounded-2xl overflow-hidden hover:border-clinical-gold/40 transition-all shadow-md"
              >
                <CardContent className="p-6 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-xl font-extrabold text-white tracking-tight">{p.name}</h3>
                        {p.popular && (
                          <Badge className="bg-clinical-gold text-stone-900 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5">
                            Most Popular
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-clinical-zinc">
                        <span className="flex items-center gap-1 text-white font-medium">
                          <Icon className="w-3.5 h-3.5 text-clinical-gold" /> Tanmatra Central Kitchen
                        </span>
                        <span>•</span>
                        <span>☀ Lunch | ☾ Dinner</span>
                      </div>
                    </div>

                  </div>

                  <p className="text-xs text-clinical-zinc leading-relaxed max-w-2xl">{p.desc}</p>

                  {/* Horizontal Available Dishes Preview Carousel */}
                  <div className="space-y-2 pt-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-clinical-zinc">Available dishes in rotation</p>
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                      {planDishes.map((dish) => (
                        <div key={dish.slug} className="shrink-0 w-44 sm:w-52 rounded-xl bg-clinical-dark border border-clinical-border/80 overflow-hidden flex flex-col justify-between group">
                          <div className="h-28 bg-clinical-surface-elevated relative overflow-hidden flex items-center justify-center">
                            {dish.image ? (
                              <img src={dish.image} alt={dish.name} onError={onDishImageError} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            ) : (
                              <Flame className="w-8 h-8 text-clinical-gold/30 group-hover:scale-110 transition-transform" />
                            )}
                            <div className="absolute top-2 left-2 z-10 bg-black/75 backdrop-blur-sm px-1.5 py-0.5 rounded border border-white/10 text-[9px] font-bold flex items-center gap-1">
                              <span className={`w-2 h-2 rounded-full ${dish.isVeg ? "bg-emerald-500" : "bg-red-500"}`} />
                              {dish.isVeg ? "VEG" : "NON-VEG"}
                            </div>
                          </div>
                          <div className="p-2.5 space-y-1">
                            <p className="text-xs font-bold text-white truncate">{dish.name}</p>
                            <p className="text-[10px] text-clinical-zinc font-mono">{Math.round(dish.macros.calories)}kcal • {Math.round(dish.macros.protein)}g protein</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pricing and Action Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-clinical-border/60">
                    <div>
                      <p className="text-[11px] text-clinical-zinc">Plans starting at</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-extrabold text-white tabular-nums">₹{perDelivery.toLocaleString("en-IN")}</span>
                        <span className="text-xs text-clinical-zinc line-through tabular-nums">₹{(perDelivery + 50).toLocaleString("en-IN")}</span>
                        <span className="text-xs text-clinical-gold font-medium">for {p.mealsPerWeek} meals/wk</span>
                      </div>
                    </div>

                    <Link to={`/subscribe?protocol=${p.protocol}&cadence=${cadence}`} className="shrink-0">
                      <Button className="w-full sm:w-auto bg-clinical-gold text-stone-900 hover:bg-clinical-gold/90 font-bold text-xs h-10 px-6 rounded-xl shadow-md">
                        View plans
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Curated RD Goal Plan Cards with Preview Carousels */}
          {filteredGoalPlans.map((p) => {
            const sampleSlugs = p.week.slice(0, 3).map((d) => d.lunchSlug || d.dinnerSlug);
            const sampleDishes = sampleSlugs.map((s) => getDishBySlug(s)).filter(Boolean);
            const perDayPrice = Math.round(p.pricePerWeekPaise / 700);

            return (
              <Card
                key={p.slug}
                className="bg-clinical-surface border-clinical-border rounded-2xl overflow-hidden hover:border-clinical-gold/40 transition-all shadow-md"
              >
                <CardContent className="p-6 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="text-xl font-extrabold text-white tracking-tight">{p.name}</h3>
                        <Badge className="bg-clinical-gold/15 text-clinical-gold border-clinical-gold/30 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5">
                          RD Clinical Plan
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-clinical-zinc">
                        <span className="flex items-center gap-1 text-white font-medium">
                          <Stethoscope className="w-3.5 h-3.5 text-clinical-gold" /> {p.rdAuthorSlug.replace("rd-", "").replace("-", " ").toUpperCase()}
                        </span>
                        <span>•</span>
                        <span>☀ Lunch | ☾ Dinner</span>
                      </div>
                    </div>

                  </div>

                  <p className="text-xs text-clinical-zinc leading-relaxed max-w-2xl">{p.description || p.tagline}</p>

                  {/* Horizontal Available Dishes Preview Carousel */}
                  <div className="space-y-2 pt-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-clinical-zinc">Available dishes in rotation</p>
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                      {(sampleDishes.length > 0 ? sampleDishes : [
                        { name: p.name + " Signature Bowl", macros: { calories: p.calorieTargetPerDay / 3, protein: Math.round(p.proteinTargetGrams / 3) }, isVeg: true },
                        { name: "Clinical RD Super salad", macros: { calories: Math.round(p.calorieTargetPerDay / 3.2), protein: Math.round(p.proteinTargetGrams / 3) }, isVeg: true },
                      ]).map((sample: any, idx: number) => (
                        <div key={idx} className="shrink-0 w-44 sm:w-52 rounded-xl bg-clinical-dark border border-clinical-border/80 overflow-hidden flex flex-col justify-between group">
                          <div className="h-28 bg-clinical-surface-elevated relative overflow-hidden flex items-center justify-center">
                            {sample.image ? (
                              <img src={sample.image} alt={sample.name} onError={onDishImageError} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            ) : (
                              <Flame className="w-8 h-8 text-clinical-gold/30 group-hover:scale-110 transition-transform" />
                            )}
                            <div className="absolute top-2 left-2 z-10 bg-black/75 backdrop-blur-sm px-1.5 py-0.5 rounded border border-white/10 text-[9px] font-bold flex items-center gap-1">
                              <span className={`w-2 h-2 rounded-full ${sample.isVeg !== false ? "bg-emerald-500" : "bg-red-500"}`} />
                              {sample.isVeg !== false ? "VEG" : "NON-VEG"}
                            </div>
                          </div>
                          <div className="p-2.5 space-y-1">
                            <p className="text-xs font-bold text-white truncate">{sample.name}</p>
                            <p className="text-[10px] text-clinical-zinc font-mono">
                              {Math.round(sample.macros?.calories || 450)}kcal • {Math.round(sample.macros?.protein || 25)}g protein
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pricing and Action Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-clinical-border/60">
                    <div>
                      <p className="text-[11px] text-clinical-zinc">Plans starting at</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-extrabold text-white tabular-nums">₹{perDayPrice.toLocaleString("en-IN")}</span>
                        <span className="text-xs text-clinical-zinc line-through tabular-nums">₹{Math.round(perDayPrice * 1.2).toLocaleString("en-IN")}</span>
                        <span className="text-xs text-clinical-gold font-medium">/ day · ₹{Math.round(p.pricePerWeekPaise / 100).toLocaleString("en-IN")} for 7 days</span>
                      </div>
                    </div>

                    <Link to={`/subscribe?plan=${p.slug}`} className="shrink-0">
                      <Button className="w-full sm:w-auto bg-clinical-gold text-stone-900 hover:bg-clinical-gold/90 font-bold text-xs h-10 px-6 rounded-xl shadow-md">
                        View plans
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-clinical-border py-14 px-4">
        <div className="max-w-4xl mx-auto space-y-8">
          <h2 className="text-clinical-h2 text-center text-white">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { icon: Sparkles, title: "Tell us your goals", body: "A 60-second setup matches the menu to your goals, diet, and allergens." },
              { icon: RefreshCw, title: "We plan the week", body: "A dietitian-designed rotation lands in your schedule. Swap anything you like." },
              { icon: Clock, title: "Fresh, on time", body: "Cooked to order in ISO-certified kitchens and delivered in your window." },
            ].map((s, i) => (
              <div key={i} className="text-center space-y-2">
                <div className="w-10 h-10 rounded-lg bg-clinical-gold/10 border border-clinical-gold/25 flex items-center justify-center mx-auto">
                  <s.icon className="w-5 h-5 text-clinical-gold" />
                </div>
                <p className="text-sm font-semibold text-white">{s.title}</p>
                <p className="text-xs text-clinical-zinc leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Clinical — deliberately separated, understated entry */}
      <section className="border-t border-clinical-border py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <Card className="bg-clinical-surface/40 border-clinical-border">
            <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-clinical-blue/10 border border-clinical-blue/25 flex items-center justify-center shrink-0">
                <Stethoscope className="w-5 h-5 text-clinical-blue" />
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-semibold text-white">
                  Managing a medical condition?
                </p>
                <p className="text-xs text-clinical-zinc leading-relaxed">
                  Therapeutic plans for diabetes, hypertension, PCOS, and
                  post-surgical recovery are designed 1-on-1 with a registered
                  dietitian on our clinical track.
                </p>
              </div>
              <Link to="/clinical" className="shrink-0">
                <Button
                  variant="outline"
                  className="bg-transparent border-clinical-blue/40 text-clinical-blue hover:bg-clinical-blue/10 hover:text-clinical-blue text-xs h-9 gap-1.5"
                >
                  Explore clinical <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-clinical-border py-14 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          <h2 className="text-clinical-h2 text-center text-white">
            Frequently asked questions
          </h2>
          <div className="space-y-4">
            {[
              {
                q: "Can I pause or skip deliveries?",
                a: "Yes. Pause or skip any upcoming delivery from your subscriptions dashboard, up to 24 hours before your scheduled delivery.",
              },
              {
                q: "Can I swap dishes in my plan?",
                a: "Absolutely. We design a baseline rotation for you, but you can swap any dish for another available option before it's cooked.",
              },
              {
                q: "Does the 3-day trial auto-renew?",
                a: "No. The trial is a one-off 3-day pack at 25% off. You choose a recurring plan only when you're ready.",
              },
              {
                q: "Where do you deliver?",
                a: "Across Across Noida, Delhi, and Gurgaon. Enter your pincode at checkout to confirm.",
              },
            ].map((faq, i) => (
              <div
                key={i}
                className="rounded-lg border border-clinical-border bg-clinical-surface p-4"
              >
                <p className="text-white text-sm font-semibold mb-1">{faq.q}</p>
                <p className="text-xs text-clinical-zinc leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-2 pt-2 text-[11px] text-clinical-zinc">
            <Pause className="w-3.5 h-3.5 text-clinical-gold" />
            Pause anytime · <RefreshCw className="w-3.5 h-3.5 text-clinical-gold" /> Cancel
            anytime · no lock-in
          </div>
        </div>
      </section>
    </div>
  );
}
