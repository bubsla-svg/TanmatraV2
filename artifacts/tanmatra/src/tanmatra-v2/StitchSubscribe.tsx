import { motion } from "framer-motion";
import { List, Bell, CheckCircle, Lightning, CalendarBlank, ChartLineUp, User } from "@phosphor-icons/react";
import { FADE_IN_UP } from "@/lib/motion";
import { RD_PLANS, type RdPlan } from "@/lib/rdPlans";

/**
 * Subscription Plans Landing — Stitch "Tanmatra Premium Home" screen 689a765e…
 * on the Nocturnal Nourishment design system. Decomposed into micro-components
 * (Header / PlanCard / PlanFeature / TrustBanner / BottomNav) per the
 * large-screen brief.
 *
 * Honest data: plan names, taglines, badges and — critically — PRICES all come
 * from the real RD_PLANS config (`pricePerWeekPaise`), NOT the design's
 * hardcoded numbers. The Stitch mock showed the 3-Day Trial at ₹3,990 — the
 * exact stale, over-priced figure the pre-launch audit flagged (T5.1); the real
 * server-authoritative trial is ₹1,499. We never render a price the data can't
 * back. Motion: transform/opacity spring only; ≥44px controls.
 */

const rupees = (paise: number) => `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;

// ── micro-components ────────────────────────────────────────────────────────

function SubscribeHeader() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 h-16 px-4 flex justify-between items-center bg-nn-bg/80 backdrop-blur-xl border-b border-white/5">
      <button aria-label="Menu" className="min-h-[44px] min-w-[44px] flex items-center justify-center text-nn-secondary active:scale-95 transition-transform">
        <List size={24} />
      </button>
      <h1 className="nn-display-lg-mobile font-bold tracking-tight text-nn-primary">Tanmatra</h1>
      <button aria-label="Notifications" className="min-h-[44px] min-w-[44px] flex items-center justify-center text-nn-secondary active:scale-95 transition-transform">
        <Bell size={22} />
      </button>
    </header>
  );
}

function PlanFeature({ label }: { label: string }) {
  return (
    <li className="flex items-center gap-2 nn-body-sm text-nn-secondary">
      <CheckCircle size={16} weight="fill" className="text-nn-primary shrink-0" />
      {label}
    </li>
  );
}

function PlanCard({ plan, recommended, index }: { plan: RdPlan; recommended?: boolean; index: number }) {
  return (
    <motion.div
      variants={FADE_IN_UP}
      initial="hidden"
      animate="show"
      transition={{ delay: index * 0.06 }}
      className={`relative overflow-hidden rounded-3xl p-6 nn-glass flex flex-col justify-between ${
        recommended
          ? "border border-nn-primary/30 md:-translate-y-4 shadow-[0_8px_32px_rgba(251,191,36,0.1)]"
          : "border-t border-white/10"
      }`}
    >
      {recommended && (
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-nn-primary/20 via-nn-primary to-nn-primary/20" />
      )}
      <div className="space-y-4">
        <div className="flex justify-between items-start gap-2">
          <div>
            <h3 className={`nn-headline-md ${recommended ? "text-nn-primary" : "text-nn-on-surface"}`}>{plan.name}</h3>
            <p className="nn-body-sm text-nn-secondary">{plan.tagline}</p>
          </div>
          {recommended && (
            <span className="nn-glass px-3 py-1 rounded-full nn-micro-data text-nn-primary uppercase tracking-wider shrink-0">Recommended</span>
          )}
        </div>
        <div className="py-4">
          {/* Price sourced from RD_PLANS.pricePerWeekPaise — never a hardcoded literal */}
          <span className="text-3xl font-bold tracking-tight text-nn-on-surface tabular-nums">{rupees(plan.pricePerWeekPaise)}</span>
          <span className="nn-body-sm text-nn-secondary"> / week</span>
        </div>
        <ul className="space-y-3 border-t border-white/5 pt-4">
          {(plan.badges ?? []).slice(0, 4).map((b) => (
            <PlanFeature key={b} label={b} />
          ))}
        </ul>
      </div>
      <button
        className={`mt-8 w-full min-h-[44px] py-3 rounded-lg nn-body-lg transition-all active:scale-95 ${
          recommended
            ? "bg-nn-primary text-nn-on-primary-container font-bold hover:brightness-110"
            : "bg-nn-surface-high text-nn-on-surface border border-white/10 hover:bg-nn-surface"
        }`}
      >
        {recommended ? "Start This Plan" : "Select Plan"}
      </button>
    </motion.div>
  );
}

function TrustBanner() {
  return (
    <section className="mt-8 relative overflow-hidden rounded-2xl h-48 flex items-center justify-center nn-glass">
      <div className="absolute inset-0 bg-gradient-to-br from-nn-surface to-nn-bg opacity-60" />
      <div className="relative z-10 text-center space-y-2 px-4">
        <h4 className="nn-headline-md text-nn-on-surface">Engineered for the Elite</h4>
        <p className="nn-body-sm text-nn-secondary max-w-md mx-auto">Sourced globally. Prepared clinically. Delivered daily.</p>
      </div>
    </section>
  );
}

function BottomNav() {
  const items = [
    { icon: Lightning, label: "Fuel", active: false },
    { icon: CalendarBlank, label: "Plan", active: true },
    { icon: ChartLineUp, label: "Track", active: false },
    { icon: User, label: "Profile", active: false },
  ];
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-nn-bg/90 backdrop-blur-xl border-t border-white/5 md:hidden">
      <ul className="flex justify-around items-center px-4 pt-2 pb-6">
        {items.map(({ icon: Icon, label, active }) => (
          <li key={label}>
            <button className={`flex flex-col items-center justify-center gap-1 min-h-[44px] min-w-[44px] active:scale-90 transition-transform ${active ? "text-nn-primary font-bold" : "text-nn-secondary/60 hover:text-nn-primary/80"}`}>
              <Icon size={24} weight={active ? "fill" : "regular"} />
              <span className="nn-label-caps">{label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// ── screen ──────────────────────────────────────────────────────────────────

export default function StitchSubscribe() {
  // Three real plans from config (the middle one highlighted, as in the design).
  const plans = RD_PLANS.slice(0, 3);
  if (plans.length < 3) return null;

  return (
    <div className="min-h-dvh bg-nn-bg text-nn-on-surface pb-28">
      <SubscribeHeader />
      <main className="pt-24 px-4 max-w-7xl mx-auto space-y-8">
        <section className="text-center space-y-1 pt-8">
          <h2 className="nn-display-lg-mobile text-nn-on-surface">Select Your Program</h2>
          <p className="nn-body-lg text-nn-secondary">Precision nutrition engineered for high performance.</p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          {plans.map((plan, i) => (
            <PlanCard key={plan.slug} plan={plan} recommended={i === 1} index={i} />
          ))}
        </section>

        <TrustBanner />
      </main>
      <BottomNav />
    </div>
  );
}
