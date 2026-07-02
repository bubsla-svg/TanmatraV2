import { useState } from "react";
import { Link, type MetaFunction } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Check, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  Flame, 
  Heart,
  Activity,
  HeartPulse,
  Scale
} from "lucide-react";

export const meta: MetaFunction = () => [
  { title: "Subscription Plans | Tanmatra" },
  { name: "description", content: "Clinical-grade nutrition subscription plans. Choose between Wellness, Performance, or Clinical protocols. Personalised dietitian-approved meals." },
];

export default function SubscriptionPlansLanding() {
  const [billingCycle, setBillingCycle] = useState<"weekly" | "fortnightly" | "monthly">("monthly");

  const plans = [
    {
      id: "wellness",
      name: "Wellness Protocol",
      icon: Heart,
      badge: "EVERYDAY HEALTH",
      desc: "For general wellness, weight management, and clean energy.",
      priceWeekly: 1250,
      priceMonthly: 5500,
      features: [
        "Calorie-controlled (350 - 550 kcal)",
        "Organic complex carbs & seasonal greens",
        "Includes standard vegetarian & egg-based dishes",
        "2 dietitian chats / month",
        "Flexible delivery window adjustments"
      ],
      ctaLink: "/subscribe?protocol=wellness&cadence="
    },
    {
      id: "performance",
      name: "Performance Protocol",
      icon: Activity,
      badge: "ATHLETES & RECOVERY",
      desc: "High protein, macro-heavy plans supporting training goals.",
      priceWeekly: 1450,
      priceMonthly: 6200,
      popular: true,
      features: [
        "Protein forward (>30g protein per meal)",
        "Perfect pre- & post-workout macro splits",
        "Includes premium lean meats & seeds add-ons",
        "Weekly progress tracking via dashboard",
        "4 dietitian chats + custom menu overrides"
      ],
      ctaLink: "/subscribe?protocol=performance&cadence="
    },
    {
      id: "clinical",
      name: "Clinical Protocol",
      icon: HeartPulse,
      badge: "DISEASE REVERSAL & GI",
      desc: "Registered dietitian prescribed, clinically-validated meals.",
      priceWeekly: 1750,
      priceMonthly: 7200,
      features: [
        "Diabetes (Low GI / <10g sugar) & Hypertension safe",
        "Strict sodium & trans-fat limits monitored by RDs",
        "Fully tailored allergen & ingredient exclusions",
        "Continuous 1-on-1 private RD consultations",
        "Priority clinical kitchen line preparation"
      ],
      ctaLink: "/subscribe?protocol=clinical&cadence="
    }
  ];

  return (
    <div className="bg-[#050505] text-white min-h-screen">
      {/* Hero */}
      <section className="py-20 px-4 text-center space-y-6 max-w-4xl mx-auto">
        <Badge className="bg-clinical-gold/15 text-clinical-gold border-clinical-gold/30 uppercase tracking-widest text-[10px] px-3 py-1">
          TANMATRA SUBSCRIPTIONS
        </Badge>
        <h1 className="font-serif text-4xl sm:text-6xl tracking-tight leading-tight">
          Precision nutrition, <span className="text-clinical-gold">on autopilot.</span>
        </h1>
        <p className="text-base sm:text-lg text-clinical-zinc max-w-xl mx-auto leading-relaxed">
          Skip the daily checkout. Configure a weekly, fortnightly, or monthly meal plan tailored to your health protocols, delivered fresh to your desk or doorstep.
        </p>

        {/* Toggle Switch */}
        <div className="flex justify-center pt-4">
          <div className="bg-clinical-surface border border-clinical-border rounded-lg p-1 flex gap-1">
            {(["weekly", "fortnightly", "monthly"] as const).map((cycle) => (
              <Button
                key={cycle}
                onClick={() => setBillingCycle(cycle)}
                variant={billingCycle === cycle ? "default" : "ghost"}
                className={`text-xs capitalize h-8 px-4 ${billingCycle === cycle ? "bg-clinical-gold text-[#050505] hover:bg-clinical-gold/90" : "text-clinical-zinc hover:text-white"}`}
              >
                {cycle}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="max-w-6xl mx-auto px-4 pb-20 grid grid-cols-1 md:grid-cols-3 gap-8">
        {plans.map((p) => {
          const Icon = p.icon;
          const displayPrice = billingCycle === "weekly" 
            ? p.priceWeekly 
            : billingCycle === "fortnightly" 
              ? Math.round(p.priceWeekly * 1.9)
              : p.priceMonthly;

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
              <CardContent className="p-6 space-y-6">
                <div className="space-y-2">
                  <Badge className="bg-clinical-gold/10 text-clinical-gold border-clinical-gold/20 text-[9px] tracking-wider">
                    {p.badge}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5 text-clinical-gold" />
                    <h3 className="text-xl font-bold text-white">{p.name}</h3>
                  </div>
                  <p className="text-xs text-clinical-zinc leading-relaxed h-8">{p.desc}</p>
                </div>

                <div className="border-t border-b border-clinical-border py-4">
                  <span className="text-3xl font-bold text-white">₹{displayPrice.toLocaleString("en-IN")}</span>
                  <span className="text-xs text-clinical-zinc"> / {billingCycle} cycle</span>
                </div>

                <ul className="space-y-3 text-xs text-clinical-zinc">
                  {p.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-clinical-gold shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link to={`${p.ctaLink}${billingCycle}`} className="block">
                  <Button 
                    className={`w-full text-xs h-10 ${p.popular ? "bg-clinical-gold text-[#050505] hover:bg-clinical-gold/90" : "bg-transparent border border-clinical-border text-white hover:bg-clinical-surface-elevated"}`}
                  >
                    Select Plan
                  </Button>
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </section>

      {/* Comparison table */}
      <section className="border-t border-clinical-border py-16 px-4">
        <div className="max-w-4xl mx-auto space-y-8">
          <h2 className="font-serif text-2xl text-center text-white">Feature Comparison</h2>
          <div className="overflow-x-auto border border-clinical-border rounded-xl">
            <table className="w-full text-xs text-left text-clinical-zinc">
              <thead className="bg-clinical-surface text-white border-b border-clinical-border">
                <tr>
                  <th className="p-4">Feature</th>
                  <th className="p-4">Wellness</th>
                  <th className="p-4">Performance</th>
                  <th className="p-4">Clinical</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-clinical-border bg-clinical-surface/40">
                <tr>
                  <td className="p-4 text-white font-medium">Dietitian Access</td>
                  <td className="p-4">Chat Support (2x/mo)</td>
                  <td className="p-4">Chat Support (4x/mo)</td>
                  <td className="p-4 text-white font-semibold">1-on-1 Consultation</td>
                </tr>
                <tr>
                  <td className="p-4 text-white font-medium">Allergen Exclusions</td>
                  <td className="p-4">Standard Filters</td>
                  <td className="p-4">Standard Filters</td>
                  <td className="p-4 text-white font-semibold">Unlimited Tailored</td>
                </tr>
                <tr>
                  <td className="p-4 text-white font-medium">Macro Target Tuning</td>
                  <td className="p-4">N/A</td>
                  <td className="p-4 text-white font-semibold">Custom Target</td>
                  <td className="p-4 text-white font-semibold">Custom Target</td>
                </tr>
                <tr>
                  <td className="p-4 text-white font-medium">Prep Protocol</td>
                  <td className="p-4">Standard Clean Kitchen</td>
                  <td className="p-4">Standard Clean Kitchen</td>
                  <td className="p-4 text-white font-semibold">Allergen-Segregated Area</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-clinical-border py-16 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          <h2 className="font-serif text-2xl text-center text-white">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {[
              {
                q: "Can I pause or skip deliveries?",
                a: "Yes. You can pause or skip upcoming subscription deliveries directly from your active subscriptions dashboard anytime before 4:00 PM the previous day."
              },
              {
                q: "Can I swap dishes in my weekly schedule?",
                a: "Absolutely. RDs design a baseline schedule for you, but you can swap out any dish for another available alternative of equivalent clinical safety rating."
              },
              {
                q: "What areas do you deliver to?",
                a: "Currently, we deliver across Noida, Greater Noida, and selected routes in East Delhi NCR."
              }
            ].map((faq, i) => (
              <div key={i} className="rounded-lg border border-clinical-border bg-clinical-surface p-4">
                <p className="text-white text-sm font-semibold mb-1">{faq.q}</p>
                <p className="text-xs text-clinical-zinc leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
