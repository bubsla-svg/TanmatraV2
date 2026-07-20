export interface LandingFaqItem {
  q: string;
  a: string;
}

/** Shared FAQ block for the Part 3 landing pages — same visual idiom as the
 * subscription-plans landing FAQ. */
export default function LandingFaq({
  items,
  heading = "Frequently asked questions",
}: {
  items: LandingFaqItem[];
  heading?: string;
}) {
  return (
    <section aria-label={heading} className="border-t border-white/[0.08] py-14 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <h2 className="text-clinical-h2 text-center text-white">{heading}</h2>
        <div className="space-y-4">
          {items.map((faq) => (
            <div key={faq.q} className="rounded-2xl border border-white/[0.08] bg-nn-surface p-4">
              <p className="text-white text-sm font-semibold mb-1">{faq.q}</p>
              <p className="text-xs text-nn-on-surface-variant leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
