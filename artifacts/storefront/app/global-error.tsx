"use client";
// Last-resort boundary: only fires when the ROOT LAYOUT itself throws, which
// app/error.tsx cannot catch (it renders inside that layout). Must define its
// own <html>/<body>. Safe to import the same CSS chain app/layout.tsx does —
// stylesheets are declarative and can't throw at runtime, unlike the
// component tree (Header, ThemeProvider, CartProvider, …) this file
// deliberately does NOT import, since one of those is the likelier cause of
// a layout-level crash and re-importing it here would just crash again.
import "./layers.css";
import "@workspace/tokens/tokens.css";
import "@astryxdesign/core/astryx.css";
import "@/lib/themes/tanmatra.css";
import "@/lib/themes/tanmatraBridge.css";
import "./globals.css";
import { useEffect } from "react";

export default function GlobalError({
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
    <html lang="en" data-theme="light" data-astryx-theme="tanmatra">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[var(--bg)] px-8 text-center text-ink">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Tanmatra hit a snag loading this page
        </h1>
        <p className="max-w-md text-sm text-ink-muted">
          Try reloading — if it keeps happening, the issue is on our end and we&rsquo;ve been
          notified.
        </p>
        <button
          type="button"
          onClick={reset}
          className="touch-target-min mt-2 rounded-xl bg-gold px-6 py-3 text-sm font-semibold text-[var(--gold-ink)]"
        >
          Reload
        </button>
      </body>
    </html>
  );
}
