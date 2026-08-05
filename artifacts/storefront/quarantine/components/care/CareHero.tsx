import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LandingIcon } from "@/components/landing/LandingIcon";
import { CONSULT_HREF, type CareConfig } from "@/content/landing/care";
import { SafeImage } from "@/components/ui/SafeImage";

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
          <SafeImage src={image.src} alt={image.alt} priority className="h-full w-full" />
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
        <Button
          asChild
          shape="pill"
          size="fluid"
          className="inline-flex items-center justify-center gap-2 px-8 py-4 font-semibold"
        >
          <Link href={CONSULT_HREF}>
            Book a free 15-min RD consult <LandingIcon name="arrow-right" className="h-4 w-4" />
          </Link>
        </Button>
        <Button
          asChild
          variant="outline"
          shape="pill"
          size="fluid"
          className="inline-flex items-center justify-center px-8 py-4 font-semibold"
        >
          <a href="#program">See the program</a>
        </Button>
      </div>
      <p className="mt-4 text-xs text-ink-faint">
        15 minutes, free, with a registered dietitian. No card required.
      </p>
    </header>
  );
}
