import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getRds, initialsOf, givenNameOf } from "@/lib/rdApi";
import { SITE } from "@/lib/nav";
import { RD_SERVICES_ENABLED } from "@/lib/flags";

export const metadata: Metadata = {
  title: "Our story",
  description:
    "Proper lunch, cooked fresh, with the calories and protein on every dish. How Tanmatra cooks everyday food in Noida.",
};

const STEPS = [
  { n: 1, title: "We plan it", body: "Every dish is portioned and labelled — calories and protein on the card." },
  { n: 2, title: "We cook it", body: "Fresh, after you order, in cold-pressed oils and desi ghee." },
  { n: 3, title: "You eat it", body: "Hot, at your desk or door, anywhere we deliver in Noida." },
];

// Matches /rd, the other page backed by this directory: hourly ISR rather than
// a per-request fetch. The roster changes when someone is hired, not per visit.
export const revalidate = 3600;

/**
 * The roster comes from the SERVER, not from this file.
 *
 * It used to be a hardcoded array of three dietitians whose own comment read
 * "Seed dietitian names mirror the /rd directory; replace with the real team
 * before launch" — a page introducing three named people to customers while
 * admitting in-source that it did not know whether they were the team. It also
 * gave all three the same flat title ("Registered Dietitian") where the
 * directory has real ones, and it could not notice anyone joining or leaving.
 *
 * `/rd` already reads `GET /api/rd/directory`. This page now reads the same
 * endpoint, so there is exactly one answer to "who are our dietitians" and
 * these two pages cannot disagree. `getRds()` degrades to `[]` on any failure,
 * and an empty roster renders NO section at all — a page that briefly omits
 * the team is honest, a page that names three people who may not work here is
 * not.
 */
export default async function AboutPage() {
  const dietitians = await getRds();

  return (
    <div>
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-[1240px] px-5 py-16 sm:px-8 sm:py-24">
          <h1 className="max-w-4xl font-display text-4xl font-semibold leading-[.94] tracking-[-.04em] text-primary-foreground sm:text-6xl">Our story</h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-primary-foreground/70 sm:text-lg">
            Proper lunch, cooked fresh, numbers on the label.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
        <section className="grid gap-6 py-16 sm:py-24 lg:grid-cols-[.8fr_1.2fr] lg:gap-12">
          {/* [founder to personalise] — copy deck. */}
          <h2 className="text-[11px] font-bold uppercase tracking-[.18em] text-accent">Why we started</h2>
          <p className="font-display text-2xl leading-snug text-primary sm:text-3xl">
            Eating well in Noida shouldn&rsquo;t mean a sad salad. We cook home-style food and put the
            calories and protein on every dish, so you know exactly what you&rsquo;re eating.
          </p>
        </section>

        <section className="border-t border-line pt-16">
          <h2 className="text-[11px] font-bold uppercase tracking-[.18em] text-accent">How it works</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl border border-line bg-surface p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary font-data text-sm font-bold text-primary">
                  {s.n}
                </div>
                <h3 className="mt-5 font-display text-lg font-semibold leading-tight text-primary">{s.title}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-5 pb-16">
          <div className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5 sm:flex-row sm:items-start">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold leading-tight text-primary">Our kitchen</h3>
              <p className="mt-2 text-sm leading-6 text-ink-muted">
                FSSAI-registered and ISO 22000 certified, in Sector 104, Noida. Every dish is cooked
                fresh after you order.
              </p>
              {/* The verifiable credential + the premises it attaches to, from
                  the same constants the footer and legal pages render — one
                  source, no drift (lib/fssaiClaims.test.ts pins the lockstep). */}
              <p className="font-data mt-3 text-xs text-ink-muted">
                FSSAI Reg. No. {SITE.fssai} · {SITE.address}
              </p>
            </div>
          </div>
        </section>

        {/* Flag- AND API-gated: RD services are off (lib/flags.ts) and the roster
            is empty until a dietitian is actually on board. Both must be true
            before this section names anyone. */}
        {RD_SERVICES_ENABLED && dietitians.length > 0 && (
          <section className="border-t border-line py-16">
            <h2 className="text-[11px] font-bold uppercase tracking-[.18em] text-accent">Meet the team</h2>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {dietitians.map((d) => (
                <div key={d.slug} className="flex flex-col items-start rounded-2xl border border-line bg-surface p-5">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary font-display text-xl font-semibold text-primary">
                    {initialsOf(d.name)}
                  </div>
                  <h3 className="mt-5 font-display text-lg font-semibold leading-tight text-primary">{d.name}</h3>
                  <p className="mt-1 text-[11px] font-bold uppercase tracking-[.18em] text-accent">{d.title}</p>
                  <Link href={`/rd/${d.slug}`} className="mt-4 inline-flex min-h-11 items-center text-sm font-bold text-primary hover:underline">
                    Meet {givenNameOf(d.name)} &rarr;
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <section className="bg-secondary">
        <div className="mx-auto max-w-[1240px] px-5 py-16 text-center sm:px-8 sm:py-20">
          <h2 className="font-display text-3xl font-semibold leading-tight text-primary sm:text-4xl">Hungry?</h2>
          <p className="mx-auto mt-4 max-w-sm text-base leading-7 text-ink-muted">
            See today&rsquo;s menu, or start with three lunches.
          </p>
          <Button asChild shape="pill" size="fluid" className="mt-8 min-h-12 px-8 text-sm font-bold">
            <Link href="/menu">See today&rsquo;s menu</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
