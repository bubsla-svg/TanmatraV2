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
} from "lucide-react";

export const meta: MetaFunction = () => [
  { title: "Meal Plans | Tanmatra" },
  {
    name: "description",
    content:
      "Chef-made, dietitian-approved meal plans on autopilot. Start with a 3-day trial at 25% off, then subscribe weekly, fortnightly, or monthly. Pause or skip anytime.",
  },
];

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

  const priceFor = (mealsPerWeek: number) => {
    const perDelivery = Math.round(mealsPerWeek * PER_MEAL * CADENCE_DISCOUNT[cadence]);
    const deliveriesPerMonth =
      cadence === "weekly" ? 4 : cadence === "fortnightly" ? 2 : 1;
    return { perDelivery, perMonth: perDelivery * deliveriesPerMonth };
  };

  return (
    <div className="bg-[#050505] text-white min-h-screen">
      {/* Hero */}
      <section className="py-16 md:py-20 px-4 text-center space-y-5 max-w-4xl mx-auto">
        <Badge className="bg-clinical-gold/15 text-clinical-gold border-clinical-gold/30 uppercase tracking-widest text-[10px] px-3 py-1">
          Tanmatra Meal Plans
        </Badge>
        <h1 className="text-clinical-h1 md:text-[clamp(2.25rem,1.4rem+2.6vw,3.25rem)] md:leading-[1.06] tracking-tight text-white">
          Good food, handled.{" "}
          <span className="bg-gradient-to-r from-[#E7C766] to-clinical-gold bg-clip-text text-transparent">
            On autopilot.
          </span>
        </h1>
        <p className="text-base sm:text-lg text-clinical-zinc max-w-xl mx-auto leading-relaxed">
          Skip the daily checkout. Chef-made, dietitian-approved meals delivered
          on your schedule — pause, skip, or swap anytime.
        </p>
      </section>

      {/* Trial — the hero entry */}
      <section className="max-w-4xl mx-auto px-4 pb-12">
        <Card className="relative overflow-hidden border-clinical-gold/40 bg-gradient-to-br from-clinical-gold/12 via-clinical-gold/5 to-transparent">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-clinical-gold/50 to-transparent" />
          <CardContent className="p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-1 space-y-3">
              <Badge className="bg-clinical-gold text-[#050505] text-[10px] uppercase font-bold tracking-widest">
                Start here
              </Badge>
              <h2 className="text-2xl md:text-3xl font-bold text-white">
                3-Day Trial —{" "}
                <span className="text-clinical-gold">25% off</span>
              </h2>
              <p className="text-sm text-clinical-zinc max-w-md leading-relaxed">
                Nine meals over three days, matched to your goals. One-off, no
                commitment — see if Tanmatra fits your week before you subscribe.
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
                <Button className="w-full md:w-auto bg-clinical-gold text-[#050505] hover:bg-clinical-gold/90 font-semibold gap-2 h-11 px-6">
                  Start 3-day trial <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Recurring plans */}
      <section className="max-w-5xl mx-auto px-4 pb-6 text-center space-y-4">
        <h2 className="text-clinical-h2 text-white">Or subscribe & save</h2>
        <p className="text-sm text-clinical-zinc max-w-lg mx-auto">
          Longer cadences save more. Every plan is fully swappable and you can
          pause any delivery before 4 PM the day before.
        </p>
        <div className="flex justify-center pt-2">
          <div className="bg-clinical-surface border border-clinical-border rounded-lg p-1 flex gap-1">
            {(["weekly", "fortnightly", "monthly"] as const).map((c) => (
              <Button
                key={c}
                onClick={() => setCadence(c)}
                variant={cadence === c ? "default" : "ghost"}
                className={`text-xs capitalize h-8 px-4 ${cadence === c ? "bg-clinical-gold text-[#050505] hover:bg-clinical-gold/90" : "text-clinical-zinc hover:text-white"}`}
              >
                {c}
                {c !== "weekly" && (
                  <span className="ml-1 text-[9px] opacity-80">
                    save {c === "monthly" ? "15%" : "10%"}
                  </span>
                )}
              </Button>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 pb-16 grid grid-cols-1 md:grid-cols-2 gap-6">
        {PLANS.map((p) => {
          const Icon = p.icon;
          const { perDelivery, perMonth } = priceFor(p.mealsPerWeek);
          return (
            <Card
              key={p.id}
              className={`bg-clinical-surface border-clinical-border relative ${p.popular ? "border-clinical-gold/50 shadow-[0_0_20px_rgba(212,175,55,0.08)]" : ""}`}
            >
              {p.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-clinical-gold text-[#050505] text-[9px] uppercase font-bold tracking-widest px-3 py-1 rounded-full">
                  Most Popular
                </div>
              )}
              <CardContent className="p-6 space-y-5">
                <div className="space-y-2">
                  <Badge className="bg-clinical-gold/10 text-clinical-gold border-clinical-gold/20 text-[9px] tracking-wider">
                    {p.badge}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5 text-clinical-gold" />
                    <h3 className="text-xl font-bold text-white">{p.name}</h3>
                  </div>
                  <p className="text-xs text-clinical-zinc leading-relaxed min-h-8">
                    {p.desc}
                  </p>
                </div>

                <div className="border-t border-b border-clinical-border py-4 space-y-0.5">
                  <div>
                    <span className="text-3xl font-bold text-white tabular-nums">
                      ₹{perDelivery.toLocaleString("en-IN")}
                    </span>
                    <span className="text-xs text-clinical-zinc"> / delivery</span>
                  </div>
                  <p className="text-[11px] text-clinical-zinc">
                    ≈ ₹{perMonth.toLocaleString("en-IN")}/month · {p.mealsPerWeek} meals/week
                  </p>
                </div>

                <ul className="space-y-3 text-xs text-clinical-zinc">
                  {p.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-clinical-gold shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  to={`/subscribe?protocol=${p.protocol}&cadence=${cadence}`}
                  className="block"
                >
                  <Button
                    className={`w-full text-xs h-10 ${p.popular ? "bg-clinical-gold text-[#050505] hover:bg-clinical-gold/90" : "bg-transparent border border-clinical-border text-white hover:bg-clinical-surface-elevated"}`}
                  >
                    Choose {p.name}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          );
        })}
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
                a: "Yes. Pause or skip any upcoming delivery from your subscriptions dashboard, up to 4:00 PM the day before.",
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
                a: "Across Bengaluru, with more of the city being added continuously. Enter your pincode at checkout to confirm.",
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
