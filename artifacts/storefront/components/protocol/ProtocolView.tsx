import Link from "next/link";
import { fetchMenu, toProxiedImage } from "@/lib/catalog";
import { getRds } from "@/lib/rdApi";
import { PlanCard } from "@/components/plans/PlanCard";
import { RdCard } from "@/components/rd/RdCard";
import { BenefitGrid } from "@/components/landing/BenefitGrid";
import { LandingIcon } from "@/components/landing/LandingIcon";
import { ProtocolDishRail, matchesProtocolDish, type ProtocolDish } from "./ProtocolDishRail";
import { PROTOCOL_CONFIG, type ProtocolKey } from "@/content/landing/protocol";
import { CARE_SAFETY } from "@/content/landing/care";

/** Shared server template for /performance + /clinical (route-parity Wave B).
 *  Filters the live catalog + the /rd roster to the protocol; the program is the
 *  authoritative PLAN_CATALOG plan (PlanCard). Clinical carries the diet-
 *  descriptive discipline + the safety disclaimer (see content/landing/protocol.ts). */
export async function ProtocolView({ which }: { which: ProtocolKey }) {
  const cfg = PROTOCOL_CONFIG[which];
  const [{ dishes }, rds] = await Promise.all([fetchMenu(), getRds()]);
  const slim: ProtocolDish[] = dishes.map((d) => ({
    slug: d.slug, name: d.name, image: toProxiedImage(d.image),
    protein: d.macros.protein, calories: d.macros.calories, fiber: d.macros.fiber, gi: d.glycaemicIndex,
    sugar: parseFloat(d.sugarPerServing) || 0, sugarPerServing: d.sugarPerServing, rdVerified: d.rdVerified,
  }));
  const qualifying = slim.filter((d) => matchesProtocolDish(d, cfg.filter)).length;
  const protocolRds = rds.filter((rd) =>
    rd.specialties.some((s) => cfg.rdKeywords.some((k) => s.toLowerCase().includes(k))),
  );
  const consultCta = cfg.clinical
    ? { label: "Book a free RD consult", href: "/rd" }
    : { label: "Find your plan", href: "/plans" };

  return (
    <div className="mx-auto max-w-5xl px-4">
      <header className="py-12">
        <p className="text-xs font-semibold uppercase tracking-wide text-gold-text">{cfg.eyebrow}</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
          {cfg.headline} <span className="text-gold-text">{cfg.accent}</span>
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-muted">{cfg.desc}</p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Link href="/menu" className="inline-flex items-center gap-2 rounded-xl bg-gold px-6 py-3 text-sm font-semibold text-[var(--gold-ink)]">
            See the dishes <LandingIcon name="arrow-right" className="h-4 w-4" />
          </Link>
          <Link href={consultCta.href} className="inline-flex items-center rounded-xl border border-line px-6 py-3 text-sm font-semibold text-ink hover:border-line-strong">
            {consultCta.label}
          </Link>
        </div>
        {qualifying > 0 && (
          <p className="tabular mt-5 text-xs text-ink-faint">
            {qualifying} qualifying dishes · 1 program{protocolRds.length > 0 ? ` · ${protocolRds.length} specialist RD${protocolRds.length > 1 ? "s" : ""}` : ""}
          </p>
        )}
      </header>

      <BenefitGrid eyebrow="The science" heading="How it’s built" benefits={cfg.pillars} />

      <ProtocolDishRail dishes={slim} filter={cfg.filter} label={cfg.featuredLabel} sub={cfg.featuredSub} />

      <section className="py-12">
        <p className="text-xs font-semibold uppercase tracking-wide text-gold-text">The program</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Start the {cfg.eyebrow.replace(" Protocol", "")} program</h2>
        <div className="mt-6 max-w-md">
          <PlanCard id={cfg.planId} />
        </div>
      </section>

      {protocolRds.length > 0 && (
        <section className="py-12">
          <p className="text-xs font-semibold uppercase tracking-wide text-gold-text">Talk to a specialist</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
            Your {cfg.eyebrow.replace(" Protocol", "").toLowerCase()} {protocolRds.length > 1 ? "dietitians" : "dietitian"}
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {protocolRds.map((rd) => <RdCard key={rd.slug} rd={rd} />)}
          </div>
        </section>
      )}

      {cfg.clinical && (
        <section className="py-6">
          <div className="rounded-2xl border border-[color-mix(in_srgb,var(--sage)_35%,transparent)] bg-[color-mix(in_srgb,var(--sage)_7%,transparent)] p-5">
            <p className="text-sm font-semibold text-ink">{CARE_SAFETY.headline}</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">{CARE_SAFETY.body}</p>
          </div>
        </section>
      )}

      <section className="mb-12 mt-6 rounded-2xl border border-line bg-surface p-8 text-center">
        <h2 className="text-xl font-semibold tracking-tight text-ink">Ready when you are.</h2>
        <div className="mt-4 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href={consultCta.href} className="w-full rounded-xl bg-gold px-6 py-3 text-sm font-semibold text-[var(--gold-ink)] sm:w-auto">
            {consultCta.label}
          </Link>
          <Link href="/trial" className="w-full rounded-xl border border-line px-6 py-3 text-sm font-semibold text-ink hover:border-line-strong sm:w-auto">
            Try 3 days first
          </Link>
        </div>
      </section>
    </div>
  );
}
