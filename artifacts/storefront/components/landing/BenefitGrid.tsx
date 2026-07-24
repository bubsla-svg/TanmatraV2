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
  eyebrow,
  id,
}: {
  heading: string;
  sub?: string;
  benefits: LandingBenefit[];
  /** Optional gold uppercase kicker above the heading. */
  eyebrow?: string;
  /** Optional anchor id (so a hero CTA can jump to the section). */
  id?: string;
}) {
  return (
    <section id={id} className="scroll-mt-20 py-12">
      {eyebrow && <p className="text-xs font-semibold uppercase tracking-wide text-gold-text">{eyebrow}</p>}
      <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{heading}</h2>
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
