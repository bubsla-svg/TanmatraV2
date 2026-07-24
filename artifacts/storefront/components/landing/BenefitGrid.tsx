import { LandingIcon } from "./LandingIcon";
import type { LandingBenefit } from "@/content/landing/partners";

/**
 * A titled 3-up grid of benefit cards for the marketing landers (Wave B). The
 * cards are non-interactive signals, so the gold-tinted icon chip is fine here
 * (gold is reserved for interactive elements elsewhere, but a static badge is
 * not interactive). Server component.
 */
export function BenefitGrid({
  heading,
  sub,
  benefits,
}: {
  heading: string;
  sub?: string;
  benefits: LandingBenefit[];
}) {
  return (
    <section className="py-12">
      <h2 className="text-2xl font-semibold tracking-tight text-ink">{heading}</h2>
      {sub && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">{sub}</p>}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {benefits.map((b) => (
          <div key={b.title} className="rounded-2xl border border-line bg-surface p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--gold)_12%,transparent)] text-gold-text">
              <LandingIcon name={b.icon} className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-ink">{b.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{b.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
