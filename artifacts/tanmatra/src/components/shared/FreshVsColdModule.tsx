import { Clock, Fire, Snowflake, ThermometerHot } from "@phosphor-icons/react";

/**
 * The fresh-vs-cold contrast module — Playbook Part 1 S5, shared by the
 * homepage and the landing pages (Part 3).
 *
 * Positioning note: the "their way" column describes the CATEGORY practice
 * (single blast-chilled morning drop — verified across NCR incumbents in the
 * playbook's research appendix), never a named competitor. Copy must stay
 * process-factual per the FSSAI guardrails in Playbook Part 7.6: claims about
 * our kitchen and timing, never about disease outcomes.
 */

interface ContrastRow {
  icon: "clock" | "thermo";
  theirs: string;
  ours: string;
}

const ROWS: ContrastRow[] = [
  {
    icon: "clock",
    theirs: "Cooked before sunrise, delivered as one morning batch",
    ours: "Fired in the kitchen only after you order",
  },
  {
    icon: "thermo",
    theirs: "Blast-chilled, then waits in a fridge until mealtime",
    ours: "Sealed hot and driven straight to you in 40–45 min",
  },
];

interface FreshVsColdModuleProps {
  /** Where the module is mounted — forwarded into section analytics by the host page. */
  context?: string;
  className?: string;
}

export default function FreshVsColdModule({ className = "" }: FreshVsColdModuleProps) {
  return (
    <section
      aria-labelledby="fresh-vs-cold-heading"
      className={`max-w-5xl mx-auto px-4 ${className}`}
    >
      <p className="text-[10px] uppercase tracking-widest text-nn-primary font-semibold">
        Why fresh-fired matters
      </p>
      <h2
        id="fresh-vs-cold-heading"
        className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1"
      >
        Health food shouldn&rsquo;t need reheating.
      </h2>
      <div className="mt-6 grid md:grid-cols-2 gap-3">
        {/* Category practice */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
              <Snowflake className="w-4.5 h-4.5 text-nn-on-surface-variant" aria-hidden />
            </span>
            <h3 className="text-sm font-bold uppercase tracking-wider text-nn-on-surface-variant">
              The usual cold-chain drop
            </h3>
          </div>
          <ul className="space-y-3">
            {ROWS.map((row) => (
              <li key={row.theirs} className="flex items-start gap-2.5 text-sm text-nn-on-surface-variant leading-relaxed">
                {row.icon === "clock" ? (
                  <Clock className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
                ) : (
                  <ThermometerHot className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
                )}
                {row.theirs}
              </li>
            ))}
          </ul>
        </div>
        {/* Tanmatra */}
        <div className="rounded-2xl border border-nn-primary/30 bg-nn-primary/[0.06] p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-nn-primary/15 border border-nn-primary/30 flex items-center justify-center">
              <Fire className="w-4.5 h-4.5 text-nn-primary" aria-hidden />
            </span>
            <h3 className="text-sm font-bold uppercase tracking-wider text-nn-primary">
              The Tanmatra way
            </h3>
          </div>
          <ul className="space-y-3">
            {ROWS.map((row) => (
              <li key={row.ours} className="flex items-start gap-2.5 text-sm text-white leading-relaxed">
                {row.icon === "clock" ? (
                  <Clock className="w-4 h-4 mt-0.5 shrink-0 text-nn-primary" aria-hidden />
                ) : (
                  <ThermometerHot className="w-4 h-4 mt-0.5 shrink-0 text-nn-primary" aria-hidden />
                )}
                {row.ours}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-nn-on-surface-variant leading-relaxed border-t border-nn-primary/20 pt-3">
            Every plate signed off for sodium, blood-sugar impact and healthy fats
            before it leaves our ISO 22000:2018 Noida kitchen.
          </p>
        </div>
      </div>
    </section>
  );
}
