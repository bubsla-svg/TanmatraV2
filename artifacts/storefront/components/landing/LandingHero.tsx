import { LandingIcon } from "./LandingIcon";
import type { LandingHero as HeroData } from "@/content/landing/partners";

/**
 * Marketing-lander hero (route-parity Wave B). Server component — an eyebrow,
 * a headline whose tail is gold-accented, a subtitle, a single primary CTA that
 * jumps to the on-page lead form, and a row of trust chips. Ported natively
 * into the Clinical Dark tokens (the legacy pages were a bespoke dark theme);
 * the storefront renders light, so this uses only semantic surface/ink tokens.
 */
export function LandingHero({
  hero,
  ctaLabel,
  ctaHref,
  secondaryCta,
}: {
  hero: HeroData;
  ctaLabel: string;
  ctaHref: string;
  secondaryCta?: { label: string; href: string };
}) {
  return (
    <header className="border-b border-line py-12">
      <p className="text-xs font-semibold uppercase tracking-wide text-gold-text">{hero.eyebrow}</p>
      <h1 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
        {hero.title} <span className="text-gold-text">{hero.accent}</span>
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-muted">{hero.subtitle}</p>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <a
          href={ctaHref}
          className="inline-flex items-center gap-2 rounded-xl bg-gold px-6 py-3 text-sm font-semibold text-[var(--gold-ink)]"
        >
          {ctaLabel}
          <LandingIcon name="arrow-right" className="h-4 w-4" />
        </a>
        {secondaryCta && (
          <a
            href={secondaryCta.href}
            className="inline-flex items-center rounded-xl border border-line px-6 py-3 text-sm font-semibold text-ink hover:border-line-strong"
          >
            {secondaryCta.label}
          </a>
        )}
      </div>
      {hero.trust.length > 0 && (
        <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
          {hero.trust.map((t) => (
            <li key={t.label} className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
              <LandingIcon name={t.icon} className="h-4 w-4 text-sage" />
              {t.label}
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}
