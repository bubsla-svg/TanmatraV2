"use client";
// The one recovery UI behind every route group's error.tsx — without those
// boundaries, any uncaught throw in a server component or client island fell
// through to Next's default error screen: no chrome, no retry, dead end.
// Each group's error.tsx re-exports this component so it renders inside that
// group's OWN layout (global chrome stays up on a /menu crash; a /checkout
// crash stays chrome-free, matching its shell). See app/global-error.tsx for
// the root-layout-threw case, which no group boundary can catch.
import { useEffect } from "react";

export default function SegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
    import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error));
  }, [error]);

  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--danger)]">
        Something went wrong
      </p>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">This page hit a snag</h1>
      <p className="text-sm text-ink-muted">
        Try again, or head back to the menu. If you were paying, check your order history before
        retrying — the charge status is unaffected by this screen either way.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="touch-target-min rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-[var(--gold-ink)]"
        >
          Try again
        </button>
        <a
          href="/menu"
          className="touch-target-min rounded-xl border border-line-strong px-5 py-3 text-sm font-semibold text-ink"
        >
          Back to the menu
        </a>
      </div>
    </section>
  );
}
