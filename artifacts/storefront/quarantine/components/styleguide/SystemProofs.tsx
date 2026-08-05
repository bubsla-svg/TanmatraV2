const BREAKPOINTS = [
  { name: "base", width: "0–639px", role: "Mobile. BottomNav visible, desktop nav hidden." },
  { name: "sm", width: "640px", role: "Micro-adjustments inside components — not a layout tier." },
  { name: "md", width: "768px", role: "The chrome switch: Header links appear, BottomNav hides." },
  { name: "lg", width: "1024px", role: "Dense surfaces earn a column (menu, orders, plan compare)." },
  { name: "xl", width: "1280px", role: "Prose caps here. Widest column count for dense grids." },
  { name: "2xl", width: "1536px", role: "No layout logic — content stays centred, never stretched." },
];

const DURATIONS = [
  { token: "--duration-fast", value: "150ms", use: "Hover, focus, colour shifts" },
  { token: "--duration-normal", value: "240ms", use: "Panels, sheets, reveals" },
];

/**
 * Breakpoint / motion / focus reference. These three were the styleguide's
 * documented gaps — the page showed colour, type and radii but nothing that let
 * a contributor check responsive, motion or focus behaviour against the system.
 */
export function SystemProofs() {
  return (
    <>
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-faint">
          Breakpoints
        </h2>
        <p className="mb-4 text-sm text-ink-muted">
          Tailwind&rsquo;s default min-width scale, unmodified. The app is mobile-first: base
          styles are the phone layout, and <code className="tabular text-xs">md:</code>/
          <code className="tabular text-xs">lg:</code> widen it as progressive enhancement.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-lg border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line-strong">
                <th className="py-2 pr-4 font-semibold text-ink">Prefix</th>
                <th className="py-2 pr-4 font-semibold text-ink">Min width</th>
                <th className="py-2 font-semibold text-ink">What changes</th>
              </tr>
            </thead>
            <tbody>
              {BREAKPOINTS.map((b) => (
                <tr key={b.name} className="border-b border-line">
                  <td className="py-2 pr-4">
                    <code className="tabular text-xs text-ink">{b.name}</code>
                  </td>
                  <td className="tabular py-2 pr-4 text-ink-muted">{b.width}</td>
                  <td className="py-2 text-ink-muted">{b.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-faint">
          Motion
        </h2>
        <p className="mb-4 text-sm text-ink-muted">
          Hover each swatch to see its duration. All motion is zeroed under{" "}
          <code className="tabular text-xs">prefers-reduced-motion: reduce</code>, so these will
          not animate if your OS requests reduced motion &mdash; that is the correct behaviour.
        </p>
        <div className="flex flex-wrap gap-4">
          {DURATIONS.map((d) => (
            <div key={d.token} className="flex flex-col items-start gap-1.5">
              <div
                className="h-14 w-32 rounded-xl border border-line-strong bg-surface-raised hover:bg-gold"
                style={{
                  transitionProperty: "background-color",
                  transitionDuration: `var(${d.token})`,
                  transitionTimingFunction: "var(--ease-out)",
                }}
              />
              <code className="tabular text-xs text-ink">{d.token}</code>
              <span className="tabular text-xs text-ink-faint">
                {d.value} &middot; {d.use}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-faint">
          Token architecture
        </h2>
        <p className="mb-4 text-sm text-ink-muted">
          Two token systems are layered here on purpose. Knowing which one owns a property is the
          difference between a change that lands and one that gets silently overridden.
        </p>
        <dl className="flex flex-col gap-4 text-sm">
          <div className="border-l-2 border-line-strong pl-4">
            <dt className="font-semibold text-ink">Astryx &mdash; canonical for anything DOM-facing</dt>
            <dd className="mt-1 text-ink-muted">
              <code className="tabular text-xs">lib/themes/tanmatraTheme.ts</code>. The
              owner-decided direction (DS-0). Carries the fuller primitive scale &mdash; 3-tier
              shadows, the 5-step radius ladder &mdash; and the only automated WCAG contrast test.
              New component work reads these.
            </dd>
          </div>
          <div className="border-l-2 border-line pl-4">
            <dt className="font-semibold text-ink">
              @workspace/tokens &mdash; cross-package and non-DOM only
            </dt>
            <dd className="mt-1 text-ink-muted">
              <code className="tabular text-xs">lib/tokens/src/tokens.css</code>. Keep for values
              JS reads or that the legacy app and native share. Do not add entries here that
              duplicate an Astryx primitive &mdash; that is how the two drift.
            </dd>
          </div>
          <div className="border-l-2 border-danger/40 pl-4">
            <dt className="font-semibold text-ink">The bridge is order-dependent</dt>
            <dd className="mt-1 text-ink-muted">
              Cascade layer order in <code className="tabular text-xs">app/layers.css</code> is
              load-bearing, and the Astryx bridge must load after the Astryx sheets so its
              unlayered rules outrank their layered defaults. Adding a stylesheet import without
              checking its layer does not error &mdash; it makes styles vanish. Re-adding{" "}
              <code className="tabular text-xs">var(--color-*)</code> reads to{" "}
              <code className="tabular text-xs">globals.css</code> once shipped white-on-white gold
              buttons.
            </dd>
          </div>
        </dl>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-faint">
          Focus
        </h2>
        <p className="mb-4 text-sm text-ink-muted">
          Tab through these. The ring is global (element + pseudo-selector, so it outranks any{" "}
          <code className="tabular text-xs">outline-none</code> utility) and resolves to{" "}
          <code className="tabular text-xs">--gold-text</code> &mdash; the AA-safe gold at 4.9:1,
          not raw gold at 2.1:1, so it clears WCAG 1.4.11&rsquo;s 3:1 non-text minimum.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            className="touch-target-min rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-[var(--gold-ink)]"
          >
            Button
          </button>
          <a href="#focus-demo" className="text-sm font-semibold text-ink underline">
            Link
          </a>
          <input
            aria-label="Focus demo input"
            id="focus-demo"
            placeholder="Input"
            className="rounded-xl border border-line-strong bg-surface px-4 py-3 text-sm text-ink"
          />
          <button
            type="button"
            className="touch-target-critical rounded-xl border border-line-strong px-5 py-3 text-sm font-semibold text-ink"
          >
            48px critical
          </button>
        </div>
      </div>
    </>
  );
}
