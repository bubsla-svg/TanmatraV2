import { Button } from "@/components/ui/button";
import { LandingIcon } from "./LandingIcon";
import type { LandingHero as HeroData } from "@/content/landing/partners";
import { SafeImage } from "@/components/ui/SafeImage";

/**
 * Marketing-lander hero (route-parity Wave B; Stitch brief 14 restyle). Server
 * component — an offset food-photo card, an eyebrow, a headline whose tail is
 * gold-accented, a subtitle, a gold pill CTA that jumps to the on-page lead
 * form, and a row of trust chips.
 *
 * The brief calls for an asymmetric hero (no centered stack): the image card is
 * inset from the right at 90% width so it reads as a plate laid on the page
 * rather than a banner. `image` is optional and comes from the live catalog —
 * a lander with no dish to show falls back to the text-only stack instead of
 * rendering a placeholder.
 */
export function LandingHero({
  hero,
  ctaLabel,
  ctaHref,
  secondaryCta,
  image,
}: {
  hero: HeroData;
  ctaLabel: string;
  ctaHref: string;
  secondaryCta?: { label: string; href: string };
  /** Real plated-meal photo from the catalog (already proxied). */
  image?: { src: string; alt: string };
}) {
  return (
    <header className="border-b border-line py-[var(--space-section)]">
      {image && (
        <div className="mb-8 ml-auto h-56 w-[90%] overflow-hidden rounded-2xl border border-line sm:h-72">
          {/* The one above-the-fold hero on a lander — eager + high priority. */}
          <SafeImage src={image.src} alt={image.alt} priority className="h-full w-full" />
        </div>
      )}
      <p className="text-[11px] font-bold uppercase tracking-[.18em] text-accent">{hero.eyebrow}</p>
      <h1 className="mt-3 max-w-3xl pr-4 font-display text-3xl font-semibold leading-tight tracking-tight text-primary sm:pr-8 sm:text-4xl">
        {hero.title} <span className="text-primary">{hero.accent}</span>
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-muted">{hero.subtitle}</p>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Button asChild shape="pill" size="fluid" className="px-8 py-4 font-semibold">
          <a href={ctaHref}>
            {ctaLabel}
            <LandingIcon name="arrow-right" className="h-4 w-4" />
          </a>
        </Button>
        {secondaryCta && (
          <Button asChild variant="outline" shape="pill" size="fluid" className="px-8 py-4 font-semibold hover:border-line-strong">
            <a href={secondaryCta.href}>{secondaryCta.label}</a>
          </Button>
        )}
      </div>
      {hero.trust.length > 0 && (
        <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
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
