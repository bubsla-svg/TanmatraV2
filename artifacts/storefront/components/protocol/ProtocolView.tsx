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
      <header className="flex flex-col items-center gap-5 py-14 text-center sm:py-20">
        <p className="text-xs font-semibold uppercase tracking-wide text-gold-text">{cfg.eyebrow}</p>
        <h1 className="max-w-3xl text-3xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-4xl lg:text-5xl">
          {cfg.headline} <span className="text-gold-text">{cfg.accent}</span>
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-ink-muted sm:text-lg">{cfg.desc}</p>
        <div className="flex flex-wrap items-center justify-center gap-3.5">
          <Link
            href="/menu"
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-6 py-3 text-sm font-semibold text-[var(--gold-ink)] transition-transform active:scale-[0.98]"
          >
            See the dishes <LandingIcon name="arrow-right" className="h-4 w-4" />
          </Link>
          <Link
            href={consultCta.href}
            className="inline-flex items-center rounded-xl border border-line px-6 py-3 text-sm font-semibold text-ink transition-colors hover:border-line-strong"
          >
            {consultCta.label}
          </Link>
        </div>
        {qualifying > 0 && (
          <p className="tabular text-xs text-ink-faint">
            {qualifying} qualifying dishes · 1 program{protocolRds.length > 0 ? ` · ${protocolRds.length} specialist RD${protocolRds.length > 1 ? "s" : ""}` : ""}
          </p>
        )}
      </header>

      <BenefitGrid eyebrow="The science" heading="How it’s built" benefits={cfg.pillars} />

      <ProtocolDishRail dishes={slim} filter={cfg.filter} label={cfg.featuredLabel} sub={cfg.featuredSub} />

      <section className="py-[var(--space-section)] text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-gold-text">The program</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Start the {cfg.eyebrow.replace(" Protocol", "")} program
        </h2>
        <div className="mx-auto mt-8 max-w-md text-left">
          <PlanCard id={cfg.planId} />
        </div>
      </section>

      {protocolRds.length > 0 && (
        <section className="py-[var(--space-section)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-gold-text">Talk to a specialist</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Your {cfg.eyebrow.replace(" Protocol", "").toLowerCase()} {protocolRds.length > 1 ? "dietitians" : "dietitian"}
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {protocolRds.map((rd) => <RdCard key={rd.slug} rd={rd} />)}
          </div>
        </section>
      )}

      {cfg.clinical && (
        <section className="pb-10">
          <div className="flex flex-col gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--sage)_35%,transparent)] bg-[color-mix(in_srgb,var(--sage)_7%,transparent)] p-6 sm:flex-row sm:items-start sm:gap-4 sm:p-7">
            <LandingIcon name="shield-check" className="h-6 w-6 shrink-0 text-sage-text" />
            <div>
              <p className="text-sm font-semibold text-ink">{CARE_SAFETY.headline}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{CARE_SAFETY.body}</p>
            </div>
          </div>
        </section>
      )}

      <section className="mb-16 rounded-2xl border border-line bg-surface p-10 text-center shadow-[var(--shadow-card)] sm:p-14">
        <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Ready when you are.</h2>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href={consultCta.href}
            className="w-full rounded-xl bg-gold px-6 py-3 text-sm font-semibold text-[var(--gold-ink)] transition-transform active:scale-[0.98] sm:w-auto"
          >
            {consultCta.label}
          </Link>
          <Link
            href="/trial"
            className="w-full rounded-xl border border-line px-6 py-3 text-sm font-semibold text-ink transition-colors hover:border-line-strong sm:w-auto"
          >
            Try 3 days first
          </Link>
        </div>
      </section>
    </div>
  );
}
