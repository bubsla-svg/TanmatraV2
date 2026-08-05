import type { Metadata } from "next";
import { StepDots } from "@/components/checkout/StepDots";
import { formatPaise } from "@/lib/format";
import { ComponentProofs } from "@/components/styleguide/ComponentProofs";
import { SystemProofs } from "@/components/styleguide/SystemProofs";

// The live token + component reference (IMP §17.10). Named `/styleguide`, not
// `/__styleguide`: the App Router treats `_`-prefixed folders as private
// (non-routable). Noindexed. Renders in the viewer's active theme — use the
// Header's theme toggle to compare light/dark live.
export const metadata: Metadata = { title: "Styleguide", robots: { index: false } };

type Token = { name: string; var: string; onDark?: boolean };
const SURFACES: Token[] = [
  { name: "bg", var: "--bg" },
  { name: "surface", var: "--surface" },
  { name: "surface-raised", var: "--surface-raised" },
  { name: "surface-subtle", var: "--surface-subtle" },
];
const INK: Token[] = [
  { name: "ink", var: "--ink" },
  { name: "ink-muted", var: "--ink-muted" },
  { name: "ink-faint", var: "--ink-faint" },
];
const LINES: Token[] = [
  { name: "line", var: "--line" },
  { name: "line-strong", var: "--line-strong" },
];
const ACCENTS: Token[] = [
  { name: "gold", var: "--gold", onDark: true },
  { name: "blue", var: "--blue", onDark: true },
  { name: "sage", var: "--sage", onDark: true },
  { name: "sage-soft", var: "--sage-soft" },
];
const STATUS: Token[] = [
  { name: "success", var: "--success", onDark: true },
  { name: "warning", var: "--warning", onDark: true },
  { name: "danger", var: "--danger", onDark: true },
];
const RADII = ["sm", "md", "lg", "xl"] as const;
const TYPE: { label: string; cls: string }[] = [
  { label: "3xl · display", cls: "text-3xl font-semibold" },
  { label: "2xl · page title", cls: "text-2xl font-semibold" },
  { label: "xl · section", cls: "text-xl font-semibold" },
  { label: "lg · lead", cls: "text-lg" },
  { label: "base · body", cls: "text-base" },
  { label: "sm · secondary", cls: "text-sm" },
  { label: "xs · caption", cls: "text-xs" },
];

function Swatch({ token }: { token: Token }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="flex h-16 items-end rounded-lg border border-line p-2"
        style={{ background: `var(${token.var})` }}
      >
        <span
          className="text-xs font-medium"
          style={{ color: token.onDark ? "var(--gold-ink)" : "var(--ink)" }}
        >
          Aa
        </span>
      </div>
      <div className="text-xs">
        <span className="font-medium text-ink">{token.name}</span>
        <span className="ml-1 text-ink-faint">var({token.var})</span>
      </div>
    </div>
  );
}

function Group({ title, tokens }: { title: string; tokens: Token[] }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">{title}</h3>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {tokens.map((t) => (
          <Swatch key={t.var} token={t} />
        ))}
      </div>
    </div>
  );
}

export default function StyleguidePage() {
  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-10 px-4 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Styleguide</h1>
        <p className="text-sm text-ink-muted">
          Design tokens and core components. Renders in the active theme &mdash; toggle{" "}
          <code className="tabular text-xs">data-theme</code> on the document to compare.
        </p>
      </header>

      <div className="flex flex-col gap-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-faint">Color</h2>
        <Group title="Surfaces" tokens={SURFACES} />
        <Group title="Ink" tokens={INK} />
        <Group title="Lines" tokens={LINES} />
        <Group title="Accents (locked)" tokens={ACCENTS} />
        <Group title="Status" tokens={STATUS} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-faint">Type scale</h2>
        <div className="flex flex-col gap-2">
          {TYPE.map((t) => (
            <div key={t.label} className="flex items-baseline gap-4 border-b border-line pb-2">
              <span className={`${t.cls} text-ink`}>The quick brown fox</span>
              <span className="text-xs text-ink-faint">{t.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-faint">Radii</h2>
        <div className="flex flex-wrap gap-4">
          {RADII.map((r) => (
            <div key={r} className="flex flex-col items-center gap-1.5">
              <div
                className="h-14 w-14 border border-line-strong bg-surface-raised shadow-[var(--shadow-card)]"
                style={{ borderRadius: `var(--radius-${r})` }}
              />
              <span className="text-xs text-ink-faint">{r}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-faint">Components</h2>
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" className="rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-[var(--gold-ink)]">
            Gold primary
          </button>
          <span className="rounded-full bg-sage px-4 py-1.5 text-xs font-semibold text-[var(--sage-ink)]">
            Sage signal
          </span>
          <button type="button" className="rounded-xl border border-line-strong bg-transparent px-5 py-3 text-sm font-semibold text-ink">
            Outline
          </button>
          <span className="tabular text-lg font-semibold text-ink">{formatPaise(437800)}</span>
          <StepDots current={2} total={3} />
        </div>
      </div>
      <ComponentProofs />
      <SystemProofs />
    </section>
  );
}
