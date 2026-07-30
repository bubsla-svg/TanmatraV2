import type { Metadata } from "next";
import { PremiumMembership } from "@/components/premium/PremiumMembership";

export const metadata: Metadata = {
  title: "Tanmatra Premium",
  description:
    "One membership unlocks priority delivery, a monthly RD consult, premium-only dishes and exclusive pantry drops.",
  alternates: { canonical: "/premium" },
};

const BENEFITS: { title: string; body: string }[] = [
  { title: "Priority delivery", body: "Your orders jump the kitchen queue and ship in our first rider wave — a kitchen-queue benefit, not a delivery-time guarantee." },
  { title: "1 free RD consult / month", body: "A 30-minute video session with a registered dietitian — included every billing period." },
  { title: "Premium-only meals", body: "Chef-table dishes reserved for members, unlocked across the menu." },
  { title: "Exclusive add-ons", body: "Marine collagen, chef-curated tonics, and limited pantry drops in your checkout add-on rail." },
];

/**
 * Tanmatra Premium (route-parity — gated money-path). Public marketing shell +
 * the session-gated purchase/membership island. Joining is a real Razorpay
 * money-path (server-priced checkout → verify); see components/premium.
 */
export default function PremiumPage() {
  return (
    <section className="mx-auto max-w-lg px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-wide text-gold-text">Tanmatra Premium</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Eat better, recover faster, get expert guidance.</h1>
      <p className="mt-2 text-sm text-ink-muted">
        One membership unlocks priority delivery, a monthly RD consult, premium-only dishes and exclusive pantry drops.
      </p>

      <div className="mt-6">
        <PremiumMembership />
      </div>

      <h2 className="mt-10 text-sm font-semibold text-ink">What&rsquo;s included</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {BENEFITS.map((b) => (
          <div key={b.title} className="rounded-2xl border border-line bg-surface p-4">
            <p className="text-sm font-semibold text-ink">{b.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">{b.body}</p>
          </div>
        ))}
      </div>

      <p className="mt-6 text-[11px] leading-relaxed text-ink-faint">
        Premium is operated directly by Tanmatra. RD consults are conducted by registered dietitians on our care team.
        Priority delivery is a kitchen-queue benefit — not a delivery-time guarantee. Cancel anytime from your account.
      </p>
    </section>
  );
}
