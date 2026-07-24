import Link from "next/link";
import type { LegalDoc } from "@/content/legal/types";

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
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/legal" className="text-sm text-ink-muted hover:text-ink">
        &larr; Legal &amp; policies
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink">{doc.title}</h1>
      <p className="mt-1 text-xs text-ink-faint">Last updated: {doc.updated}</p>
      <p className="mt-4 max-w-prose text-sm leading-relaxed text-ink-muted">{doc.summary}</p>

      <div className="mt-8 flex flex-col gap-8">
        {doc.sections.map((s) => (
          <section key={s.heading}>
            <h2 className="text-base font-semibold text-ink">{s.heading}</h2>
            {s.body?.map((p, i) => (
              <p key={i} className="mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">
                {withPlaceholders(p)}
              </p>
            ))}
            {s.bullets && (
              <ul className="mt-2 flex max-w-prose flex-col gap-1.5">
                {s.bullets.map((b, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-relaxed text-ink-muted">
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
