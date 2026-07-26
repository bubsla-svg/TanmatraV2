import Link from "next/link";
import { ServiceabilityBar } from "@/components/onboarding/ServiceabilityBar";

/** Home. Server-rendered, no money surface — single appetite hero pointing at
 *  the menu with non-blocking OB-2 serviceability evaluation. */
export default function HomePage() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-[var(--space-section)]">
      <div className="max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-wider text-sage-text">
          Now serving Noida
        </p>
        <h1 className="mt-3 text-3xl font-semibold leading-[1.1] tracking-tight text-ink">
          Clinical nutrition, cooked fresh — at your desk in 40&ndash;45 minutes.
        </h1>
        <p className="mt-4 mb-6 text-base leading-relaxed text-ink-muted">
          RD-designed lunches with verified macros. Real food first, the science
          on the label.
        </p>
        <ServiceabilityBar placement="hero" />
        <Link
          href="/menu"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-[var(--gold-ink)] transition-transform active:scale-[0.98]"
        >
          Browse the menu
          <span aria-hidden>&rarr;</span>
        </Link>
      </div>
    </section>
  );
}
