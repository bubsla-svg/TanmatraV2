import Link from "next/link";

// Branded 404 — without this file, notFound() (called from dish/recipe/
// challenge/plan/rd/team/legal/meal-guide/care [slug] routes) fell through to
// Next's unstyled default: no header, no nav, no way forward. Renders inside
// the root layout, so Header/Footer/MobileBottomNav are already present.
export default function NotFound() {
  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <p className="text-[11px] font-bold uppercase tracking-widest text-gold-text">404</p>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">We couldn&rsquo;t find that page</h1>
      <p className="text-sm text-ink-muted">
        The link might be old, or the page may have moved. Here are a couple of places to pick back
        up.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Link
          href="/menu"
          className="rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-[var(--gold-ink)]"
        >
          Browse the menu
        </Link>
        <Link
          href="/plans"
          className="rounded-xl border border-line-strong px-5 py-3 text-sm font-semibold text-ink"
        >
          See plans
        </Link>
      </div>
    </section>
  );
}
