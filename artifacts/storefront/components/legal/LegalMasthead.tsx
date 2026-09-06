import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Shared masthead for the legal document register (/legal, /legal/[slug]).
 * Previously each route hand-copied this header block (BATCH-9-BRIEFS.md
 * Brief 59a flags the drift) — this is the single place it now lives.
 */
export function LegalMasthead({
  eyebrow,
  title,
  dek,
  backHref,
  backLabel,
  byline,
}: {
  eyebrow: string;
  title: string;
  dek: string;
  /** Present only on the document view — the index is the top of the hierarchy. */
  backHref?: string;
  backLabel?: string;
  /** "Last updated" line — document view only. */
  byline?: string;
}) {
  return (
    <header className="border-b border-line pb-6">
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 py-1 text-sm text-ink-muted hover:text-ink"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          {backLabel}
        </Link>
      )}
      <p className={`text-[11px] font-bold uppercase tracking-[.18em] text-accent ${backHref ? "mt-4" : ""}`}>
        {eyebrow}
      </p>
      <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-primary">{title}</h1>
      {byline && <p className="font-data mt-1 text-xs text-ink-faint">{byline}</p>}
      <p className="mt-4 max-w-prose text-sm leading-relaxed text-ink-muted">{dek}</p>
    </header>
  );
}
