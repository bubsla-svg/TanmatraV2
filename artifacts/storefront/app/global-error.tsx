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
import { useEffect, useState } from "react";
import { reportClientError, reportedCopy } from "@/lib/errorReporter";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [reported, setReported] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    void reportClientError(error).then((sent) => {
      if (live) setReported(sent);
    });
    return () => {
      live = false;
    };
  }, [error]);

  return (
    <html lang="en" data-theme="light" data-astryx-theme="tanmatra">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[var(--bg)] px-8 text-center text-ink">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Tanmatra hit a snag loading this page
        </h1>
        <p className="max-w-md text-sm text-ink-muted">
          Try reloading — if it keeps happening, the issue is on our end.
        </p>
        {reported !== null && (
          <p className="max-w-md text-xs text-ink-faint">{reportedCopy(reported)}</p>
        )}
        <button
          type="button"
          onClick={reset}
          className="touch-target-min mt-2 rounded-xl bg-gold px-6 py-3 text-sm font-semibold text-gold-ink"
        >
          Reload
        </button>
      </body>
    </html>
  );
}
