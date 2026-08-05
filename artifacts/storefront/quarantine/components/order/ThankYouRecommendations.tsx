import Link from "next/link";

export function ThankYouRecommendations() {
  const recommendations = [
    {
      title: "Talk to a Dietitian",
      description: "Customize your protocol with an IDA-registered dietitian.",
      badge: "Included Free",
      cta: "Book 15-min Consult",
      href: "/rd",
    },
    {
      title: "Join a Cohort Challenge",
      description: "Stay accountable with live RD check-ins & cohort support.",
      badge: "Community",
      cta: "Explore Challenges",
      href: "/challenges",
    },
    {
      title: "Upgrade to Premium",
      description: "Unlock priority delivery, free monthly consults & secret dishes.",
      badge: "VIP Care",
      cta: "View Premium Perks",
      href: "/premium",
    },
  ];

  return (
    <div className="mt-8 border-t border-line pt-6">
      <span className="text-xs font-bold uppercase tracking-wider text-gold-text">
        Next Steps for Your Journey
      </span>
      <h2 className="mt-1 text-lg font-bold text-ink">Maxing Out Your Results</h2>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {recommendations.map((rec) => (
          <div
            key={rec.title}
            className="flex flex-col justify-between rounded-xl border border-line bg-surface p-4 shadow-sm"
          >
            <div>
              <span className="rounded-full bg-sage-soft px-2 py-0.5 text-[10px] font-bold text-sage-text">
                {rec.badge}
              </span>
              <h3 className="mt-2 text-xs font-bold text-ink">{rec.title}</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
                {rec.description}
              </p>
            </div>
            <Link
              href={rec.href}
              className="mt-4 inline-block text-center rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-raised active:scale-95"
            >
              {rec.cta} &rarr;
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
