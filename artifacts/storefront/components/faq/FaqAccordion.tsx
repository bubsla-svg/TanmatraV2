"use client";
// Interactive FAQ accordion — one row open at a time. Content is server-
// provided; the rows render through the shared Disclosure primitive
// (PR-11b), and this wrapper only maps the FAQ shape onto it and keeps the
// `faq_open` analytics (a client component because it hands the primitive a
// callback). The single FAQ accordion for the storefront — pass `pageSlug`
// on acquisition routes to keep their analytics.
import type { FaqItem } from "@/content/faq";
import { emitLpEvent } from "@/lib/lpEvents";
import { Disclosure } from "@/components/primitives/Disclosure";

export function FaqAccordion({
  items,
  pageSlug,
  defaultOpen = 0,
}: {
  items: FaqItem[];
  /** When set, expanding a row emits a `faq_open` landing-page event. */
  pageSlug?: string;
  /** Row open on mount; `null` renders fully collapsed (landers). */
  defaultOpen?: number | null;
}) {
  return (
    <Disclosure
      className="mt-8"
      defaultOpen={defaultOpen}
      items={items.map((item) => ({ key: item.q, summary: item.q, body: item.a }))}
      onOpen={(i) => {
        const question = items[i]?.q;
        if (pageSlug && question) emitLpEvent("faq_open", { page: pageSlug, question });
      }}
    />
  );
}
