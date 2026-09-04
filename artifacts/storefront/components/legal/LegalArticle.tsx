import type { LegalDoc } from "@/content/legal/types";
import { LegalMasthead } from "./LegalMasthead";

/** Below this section count a table of contents is overhead, not help —
 *  see BATCH-9-BRIEFS.md Brief 59a (terms: 20, privacy: 16 qualify;
 *  refunds/shipping/disclaimer: 8-9 and grievance: 6 don't). */
const TOC_MIN_SECTIONS = 15;

/** "01", "02", … "20" — matches the banked Stitch mock's #section-01 anchors. */
function sectionId(index: number): string {
  return `section-${String(index + 1).padStart(2, "0")}`;
}

/**
 * Splits text on [ … ] placeholder spans and highlights them, so any legal
 * detail not yet filled in (see content/legal/company.ts) is impossible to
 * miss on the rendered page and in review.
 */
function withPlaceholders(text: string) {
  return text.split(/(\[[^\]]*\])/g).map((part, i) =>
    /^\[[^\]]*\]$/.test(part) ? (
      <span key={i} className="rounded bg-gold px-1 text-[var(--gold-ink)]">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

/** Renders a legal document: title, "last updated", and its sections. */
export function LegalArticle({ doc }: { doc: LegalDoc }) {
  const showToc = doc.sections.length >= TOC_MIN_SECTIONS;

  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <LegalMasthead
        backHref="/legal"
        backLabel="Legal & policies"
        eyebrow="Legal document"
        title={doc.title}
        byline={`Last updated: ${doc.updated}`}
        dek={doc.summary}
      />

      {showToc && (
        <nav aria-label="Table of contents" className="mt-6 rounded-2xl border border-line bg-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Contents</p>
          <ol className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            {doc.sections.map((s, i) => (
              <li key={s.heading}>
                <a
                  href={`#${sectionId(i)}`}
                  className="flex items-baseline gap-2 text-sm text-ink-muted hover:text-primary"
                >
                  <span className="font-data shrink-0 text-xs text-ink-faint">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="truncate">{s.heading}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="mt-8 flex flex-col gap-8">
        {doc.sections.map((s, i) => (
          <section key={s.heading}>
            <h2 id={sectionId(i)} className="scroll-mt-24 font-display text-base font-semibold text-primary">
              {s.heading}
            </h2>
            {s.body?.map((p, j) => (
              <p key={j} className="mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">
                {withPlaceholders(p)}
              </p>
            ))}
            {s.bullets && (
              <ul className="mt-2 flex max-w-prose flex-col gap-1.5">
                {s.bullets.map((b, j) => (
                  <li key={j} className="flex gap-2 text-sm leading-relaxed text-ink-muted">
                    <span aria-hidden className="text-ink-faint">
                      &bull;
                    </span>
                    <span>{withPlaceholders(b)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </article>
  );
}
