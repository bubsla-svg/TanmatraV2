import Link from "next/link";

/** Home. Server-rendered, no money surface — a single appetite hero pointing at
 *  the menu. The plan/checkout surfaces arrive with the money path (Phase 2). */
export default function HomePage() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-[var(--space-section)]">
      <div className="max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-wider text-sage">
          Now serving Noida
        </p>
        <h1 className="mt-3 text-3xl font-semibold leading-[1.1] tracking-tight text-ink">
          Clinical nutrition, cooked fresh — at your desk in 40&ndash;45 minutes.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-ink-muted">
          RD-designed lunches with verified macros. Real food first, the science
          on the label.
        </p>
        <Link
          href="/menu"
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-[var(--gold-ink)] transition-transform active:scale-[0.98]"
        >
          Browse the menu
          <span aria-hidden>&rarr;</span>
        </Link>
      </div>
    </section>
  );
}
