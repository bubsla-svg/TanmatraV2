import { LandingIcon } from "./LandingIcon";
import { stepLabel } from "@/lib/landingCopy";
import type { LandingBenefit } from "@/content/landing/partners";

/**
 * The landing kit's titled benefit section (Wave B; Stitch brief 14 restyle).
 * Server component. Three treatments, all driven from the same content shape:
 *
 * - `grid`  — 3-up cards with a gold icon chip. The default; used for
 *             differentiators and feature groups.
 * - `tiles` — compact 2-up tiles with a danger-toned icon, for "the status quo"
 *             pain groups. The tone is a signal (the problem), never an action.
 * - `steps` — a numbered rail: a gold numeral chip beside each card, for
 *             how-it-works protocols. The numeral comes from render order via
 *             `stepLabel`, which also strips any ordinal the copy already
 *             carries so the step is not numbered twice.
 *
 * Gold on the icon chip is a static badge, not an interactive element, so it
 * does not compete with the page's single gold CTA.
 */
export function BenefitGrid({
  heading,
  sub,
  benefits,
  eyebrow,
  id,
  variant = "grid",
}: {
  heading: string;
  sub?: string;
  benefits: LandingBenefit[];
  /** Optional gold uppercase kicker above the heading. */
  eyebrow?: string;
  /** Optional anchor id (so a hero CTA can jump to the section). */
  id?: string;
  variant?: "grid" | "tiles" | "steps";
}) {
  return (
    <section id={id} className="scroll-mt-20 py-[var(--space-section)]">
      {eyebrow && <p className="text-xs font-semibold uppercase tracking-wide text-gold-text">{eyebrow}</p>}
      <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{heading}</h2>
      {sub && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">{sub}</p>}

      {variant === "steps" ? (
        <ol className="mt-8 flex flex-col gap-4">
          {benefits.map((b, i) => {
            const { number, label } = stepLabel(b.title, i);
            return (
              <li key={b.title} className="flex items-start gap-4">
                <span className="tabular flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-sm font-semibold text-gold-text">
                  {number}
                </span>
                <div className="flex-1 rounded-2xl border border-line bg-surface p-5">
                  <h3 className="text-base font-semibold text-ink">{label}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">{b.body}</p>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <div
          className={
            variant === "tiles"
              ? "mt-8 grid gap-4 sm:grid-cols-2"
              : "mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          }
        >
          {benefits.map((b) => (
            <div key={b.title} className="rounded-2xl border border-line bg-surface p-5">
              {variant === "tiles" ? (
                <LandingIcon name={b.icon} className="h-7 w-7 text-[var(--danger)]" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--gold)_12%,transparent)] text-gold-text">
                  <LandingIcon name={b.icon} className="h-5 w-5" />
                </div>
              )}
              <h3 className="mt-4 text-base font-semibold text-ink">{b.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{b.body}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
