import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Our Story",
  description:
    "Clinical nutrition, delivered with integrity. How Tanmatra brings dietitian-designed, macro-precise meals into everyday life.",
};

const STEPS = [
  { n: 1, title: "Dietitian Designs", body: "Registered dietitians formulate the precise macro splits, sodium limits, and clinical protocols." },
  { n: 2, title: "Kitchen Prepares", body: "Our ISO 22000 certified kitchen cooks meals fresh, using cold-pressed oils and whole-food ingredients." },
  { n: 3, title: "You Receive", body: "Fresh, hot meals arrive at your doorstep in Noida, ready to support your health journey." },
];

// Seed dietitian names mirror the /rd directory; replace with the real team
// (titles/credentials/photos) before launch. Generic titles only here.
const DIETITIANS = [
  { slug: "rd-anjali-nair", initials: "AN", name: "Anjali Nair", title: "Registered Dietitian" },
  { slug: "rd-vikram-sethi", initials: "VS", name: "Vikram Sethi", title: "Registered Dietitian" },
  { slug: "rd-kavya-menon", initials: "KM", name: "Kavya Menon", title: "Registered Dietitian" },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4">
      <section className="mx-auto max-w-2xl pb-10 pt-16 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-ink">Our Story</h1>
        <p className="mt-3 text-lg leading-relaxed text-ink-muted">
          Clinical nutrition, delivered with integrity.
        </p>
      </section>

      <section className="mx-auto max-w-2xl border-t border-line py-12 text-center">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Our Mission</h2>
        <p className="mt-4 text-lg leading-relaxed text-ink-muted">
          We believe clinical-grade nutrition should not be locked behind hospital walls or
          expensive dietitian consultations. Tanmatra was founded to bring therapeutic,
          macro-precise meals into everyday life — helping you manage metabolic health, optimise
          recovery, and build sustainable wellness.
        </p>
      </section>

      <section className="border-y border-line py-14">
        <h2 className="text-center text-xs font-semibold uppercase tracking-wide text-ink-faint">How It Works</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-xl border border-line bg-surface p-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gold font-mono text-lg font-bold text-[var(--gold-ink)]">
                {s.n}
              </div>
              <h3 className="text-[15px] font-semibold text-ink">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-14 text-center">
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-xl border border-line bg-surface p-8">
          <svg className="h-14 w-14 text-gold-text" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <div>
            <h3 className="text-[15px] font-semibold text-ink">ISO 22000 Certified Kitchen</h3>
            <p className="mt-1 text-xs leading-relaxed text-ink-faint">
              Every dish is prepared in a facility adhering to strict international food-safety
              management standards.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-line py-14">
        <h2 className="text-center text-xs font-semibold uppercase tracking-wide text-ink-faint">Our Dietitian Experts</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {DIETITIANS.map((d) => (
            <div key={d.slug} className="flex flex-col rounded-xl border border-line bg-surface p-5">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gold font-mono text-lg font-bold text-[var(--gold-ink)]">
                {d.initials}
              </div>
              <h3 className="text-[15px] font-semibold text-ink">{d.name}</h3>
              <p className="text-xs text-gold-text">{d.title}</p>
              <Link href="/rd" className="mt-4 text-xs font-semibold text-gold-text hover:underline">
                Meet the team &rarr;
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-line py-20 text-center">
        <h2 className="text-2xl font-bold text-ink">Ready to start?</h2>
        <p className="mx-auto mt-4 max-w-xs text-sm text-ink-muted">
          Choose a dietitian-designed plan tailored to your health goals.
        </p>
        <Link
          href="/plans"
          className="mt-8 inline-flex h-[52px] items-center justify-center rounded-xl bg-gold px-8 font-bold text-[var(--gold-ink)] transition-opacity hover:opacity-90"
        >
          Start your plan
        </Link>
      </section>
    </div>
  );
}
