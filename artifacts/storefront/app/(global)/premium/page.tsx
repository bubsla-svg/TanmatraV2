import type { Metadata } from "next";
import { RD_SERVICES_ENABLED } from "@/lib/flags";
import { PremiumMembership } from "@/components/premium/PremiumMembership";
import { LandingIcon } from "@/components/landing/LandingIcon";
import type { LandingIconName } from "@/content/landing/partners";

export const metadata: Metadata = {
  title: "Premium",
  description:
    "One membership unlocks priority delivery, premium-only dishes and exclusive pantry drops.",
  alternates: { canonical: "/premium" },
};

// Same shape as landing's BenefitGrid `grid` variant (icon chip + title + body)
// so this hand-built section reads as one visual family with the rest of the
// storefront — see BATCH-9-BRIEFS.md Brief 56 for why it isn't the imported
// component itself (its section padding is tuned for full landing sections,
// not this narrower account/money shell).
// The monthly consult is listed only while RD services are on (lib/flags.ts):
// selling a membership on a consult nobody can deliver is the claim, not the copy.
const BENEFITS: { title: string; body: string; icon: LandingIconName }[] = [
  { icon: "timer", title: "Priority delivery", body: "Your orders jump the kitchen queue and ship in our first rider wave — a kitchen-queue benefit, not a delivery-time guarantee." },
  ...(RD_SERVICES_ENABLED
    ? [{ icon: "clipboard" as LandingIconName, title: "1 free consult / month", body: "A 30-minute video session with a registered dietitian — included every billing period." }]
    : []),
  { icon: "fork-knife", title: "Premium-only meals", body: "Chef-table dishes reserved for members, unlocked across the menu." },
  { icon: "coffee", title: "Exclusive add-ons", body: "Marine collagen, chef-curated tonics, and limited pantry drops in your checkout add-on rail." },
];

/**
 * Tanmatra Premium (route-parity — gated money-path). Public marketing shell +
 * the session-gated purchase/membership island. Joining is a real Razorpay
 * money-path (server-priced checkout → verify); see components/premium.
 */
export default function PremiumPage() {
  return (
    <section className="mx-auto max-w-lg px-4 py-10">
      <p className="text-[11px] font-bold uppercase tracking-[.18em] text-accent">Tanmatra Premium</p>
      <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-primary">Eat better, every weekday.</h1>
      <p className="mt-2 text-sm text-ink-muted">
        One membership unlocks priority delivery, premium-only dishes and exclusive pantry drops.
      </p>

      <div className="mt-6">
        <PremiumMembership />
      </div>

      <h2 className="mt-10 font-display text-base font-semibold text-primary">What&rsquo;s included</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {BENEFITS.map((b) => (
          <div key={b.title} className="rounded-2xl border border-line bg-surface p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--gold)_12%,transparent)] text-primary">
              <LandingIcon name={b.icon} className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-display text-base font-semibold text-primary">{b.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{b.body}</p>
          </div>
        ))}
      </div>

      <p className="mt-6 text-xs leading-relaxed text-ink-faint">
        Premium is operated directly by Tanmatra. Priority delivery is a kitchen-queue benefit — not a delivery-time guarantee. Cancel anytime from your account.
      </p>
    </section>
  );
}
