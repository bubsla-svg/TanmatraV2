import Link from "next/link";
import { LandingIcon } from "@/components/landing/LandingIcon";
import { CONSULT_HREF, type CareConfig } from "@/content/landing/care";

/**
 * Consult-first hero for /care/:condition (Stitch brief 20 restyle). The
 * clinical promise rides on the free RD consult (→ /rd), never on the food.
 *
 * `image` is a real low-GI plate from the live catalog, chosen by the page. The
 * brief's mock ships generated hero imagery; a synthesised photo would be
 * fabricated content on the batch's most clinically sensitive surface, so the
 * banked assets are not used and the hero falls back to text-only when the
 * catalog has nothing to show. Server component.
 */
export function CareHero({ cfg, image }: { cfg: CareConfig; image?: { src: string; alt: string } }) {
  return (
    <header className="py-[var(--space-section)]">
      {image && (
        <div className="mb-8 ml-auto h-52 w-[90%] overflow-hidden rounded-3xl border border-line sm:h-64">
          {/* eslint-disable-next-line @next/next/no-img-element -- unoptimized <img>, see next.config */}
          <img src={image.src} alt={image.alt} className="h-full w-full object-cover" />
        </div>
      )}
      <p className="text-xs font-semibold uppercase tracking-widest text-gold-text">
        {cfg.protocolLabel} · {cfg.conditionLabel}
      </p>
      <h1 className="mt-4 max-w-3xl pr-4 text-3xl font-semibold leading-tight tracking-tight text-ink sm:pr-8 sm:text-4xl">
        {cfg.heroTitle}
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-muted">{cfg.heroSub}</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link
          href={CONSULT_HREF}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-gold px-8 py-4 text-sm font-semibold text-[var(--gold-ink)] transition-transform active:scale-[0.98]"
        >
          Book a free 15-min RD consult <LandingIcon name="arrow-right" className="h-4 w-4" />
        </Link>
        <a
          href="#program"
          className="inline-flex items-center justify-center rounded-full border border-line px-8 py-4 text-sm font-semibold text-ink transition-colors hover:border-line-strong"
        >
          See the program
        </a>
      </div>
      <p className="mt-4 text-xs text-ink-faint">
        15 minutes, free, with a registered dietitian. No card required.
      </p>
    </header>
  );
}
