import Link from "next/link";
import { LandingIcon } from "@/components/landing/LandingIcon";
import { CONSULT_HREF, type CareConfig } from "@/content/landing/care";

/** Consult-first hero for /care/:condition. The clinical promise rides on the
 *  free RD consult (→ /rd), never on the food. Server component. */
export function CareHero({ cfg }: { cfg: CareConfig }) {
  return (
    <header className="py-12">
      <p className="text-xs font-semibold uppercase tracking-wide text-gold-text">
        {cfg.protocolLabel} · {cfg.conditionLabel}
      </p>
      <h1 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
        {cfg.heroTitle}
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-muted">{cfg.heroSub}</p>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Link
          href={CONSULT_HREF}
          className="inline-flex items-center gap-2 rounded-xl bg-gold px-6 py-3 text-sm font-semibold text-[var(--gold-ink)]"
        >
          Book a free 15-min RD consult <LandingIcon name="arrow-right" className="h-4 w-4" />
        </Link>
        <a href="#program" className="inline-flex items-center rounded-xl border border-line px-6 py-3 text-sm font-semibold text-ink hover:border-line-strong">
          See the program
        </a>
      </div>
      <p className="mt-3 text-xs text-ink-faint">
        15 minutes, free, with a registered dietitian. No card required.
      </p>
    </header>
  );
}
