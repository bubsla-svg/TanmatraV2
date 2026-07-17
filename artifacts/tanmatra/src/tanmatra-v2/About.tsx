import { Link } from "react-router";
import { TEAM } from "@/lib/teamData";

export default function AboutV2() {
  // Get first 3 dietitians (role === "rd")
  const dietitians = TEAM.filter((m) => m.role === "rd").slice(0, 3);

  return (
    <div className="tnm2 nn min-h-screen bg-[var(--tnm-surface-ink)] text-white antialiased">
      {/* Hero Section */}
      <section className="relative px-6 pt-28 pb-16 text-center max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
          Our Story
        </h1>
        <p className="text-lg md:text-xl text-[var(--tnm-text-secondary)] leading-relaxed">
          Clinical nutrition, delivered with integrity.
        </p>
      </section>

      {/* Mission Section */}
      <section className="px-6 py-12 max-w-3xl mx-auto text-center border-t border-white/[0.06]">
        <h2 className="text-[11px] font-semibold tracking-[0.06em] uppercase text-white/50 mb-4">
          Our Mission
        </h2>
        <p className="text-lg text-[var(--tnm-text-secondary)] leading-relaxed">
          We believe clinical-grade nutrition should not be locked behind hospital walls or expensive dietitian consultations. 
          Tanmatra was founded to bring therapeutic, macro-precise meals into everyday life, helping you manage metabolic health, 
          optimise recovery, and build sustainable wellness.
        </p>
      </section>

      {/* How It Works Section */}
      <section className="px-6 py-16 bg-white/[0.01] border-y border-white/[0.06]">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-[11px] font-semibold tracking-[0.06em] uppercase text-white/50 text-center mb-10">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="rounded-xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.06] p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-[color-mix(in_srgb,var(--tnm-action)_15%,transparent)] border border-[color-mix(in_srgb,var(--tnm-action)_40%,transparent)] flex items-center justify-center mx-auto mb-4 font-mono font-bold text-[var(--tnm-action)]">
                1
              </div>
              <h3 className="text-[15px] font-semibold mb-2">Dietitian Designs</h3>
              <p className="text-[14px] text-[var(--tnm-text-secondary)] leading-relaxed">
                Registered dietitians formulate the precise macro splits, sodium limits, and clinical protocols.
              </p>
            </div>

            <div className="rounded-xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.06] p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-[color-mix(in_srgb,var(--tnm-action)_15%,transparent)] border border-[color-mix(in_srgb,var(--tnm-action)_40%,transparent)] flex items-center justify-center mx-auto mb-4 font-mono font-bold text-[var(--tnm-action)]">
                2
              </div>
              <h3 className="text-[15px] font-semibold mb-2">Kitchen Prepares</h3>
              <p className="text-[14px] text-[var(--tnm-text-secondary)] leading-relaxed">
                Our ISO 22000 certified kitchen cooks meals fresh, using cold-pressed oils and whole food ingredients.
              </p>
            </div>

            <div className="rounded-xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.06] p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-[color-mix(in_srgb,var(--tnm-action)_15%,transparent)] border border-[color-mix(in_srgb,var(--tnm-action)_40%,transparent)] flex items-center justify-center mx-auto mb-4 font-mono font-bold text-[var(--tnm-action)]">
                3
              </div>
              <h3 className="text-[15px] font-semibold mb-2">You Receive</h3>
              <p className="text-[14px] text-[var(--tnm-text-secondary)] leading-relaxed">
                Fresh, hot meals arrive at your doorstep in Noida, Delhi & Gurgaon, ready to support your health journey.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Certifications Section */}
      <section className="px-6 py-16 text-center">
        <div className="max-w-md mx-auto rounded-xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.06] p-8 flex flex-col items-center gap-4">
          <svg
            className="w-16 h-16 text-[var(--tnm-action)]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <div>
            <h4 className="text-[15px] font-semibold text-white mb-1">ISO 22000 Certified Kitchen</h4>
            <p className="text-[12px] text-white/45 leading-relaxed">
              Every dish is prepared in a facility adhering to strict international food safety management standards.
            </p>
          </div>
        </div>
      </section>

      {/* Team Preview Section */}
      <section className="px-6 py-16 max-w-4xl mx-auto border-t border-white/[0.06]">
        <h2 className="text-[11px] font-semibold tracking-[0.06em] uppercase text-white/50 text-center mb-10">
          Our Dietitian Experts
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {dietitians.map((dietitian) => (
            <div
              key={dietitian.slug}
              className="rounded-xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.06] p-5 flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-full bg-[color-mix(in_srgb,var(--tnm-action)_12%,transparent)] border border-[color-mix(in_srgb,var(--tnm-action)_25%,transparent)] text-[var(--tnm-action)] flex items-center justify-center font-mono font-bold text-lg mb-4">
                  {dietitian.initials}
                </div>
                <h3 className="text-[15px] font-semibold text-white mb-1">
                  {dietitian.name}
                </h3>
                <p className="text-[12px] text-[var(--tnm-action)] mb-3">
                  {dietitian.title}
                </p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {dietitian.credentials.slice(0, 2).map((cred) => (
                    <span
                      key={cred}
                      className="px-2 py-0.5 rounded bg-[var(--color-nn-surface-high)] border border-white/[0.04] text-[10px] text-white/70"
                    >
                      {cred}
                    </span>
                  ))}
                </div>
              </div>
              <Link
                to={`/rd/${dietitian.slug}`}
                className="text-[12px] font-semibold text-[var(--tnm-action)] hover:underline mt-2 inline-flex items-center gap-1"
              >
                View Profile &rarr;
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-20 text-center border-t border-white/[0.06]">
        <div className="max-w-md mx-auto">
          <h2 className="text-2xl font-bold mb-4">Ready to start?</h2>
          <p className="text-[14px] text-[var(--tnm-text-secondary)] mb-8 max-w-xs mx-auto">
            Choose a dietitian-designed plan tailored to your health goals.
          </p>
          <Link
            to="/subscribe"
            className="inline-flex items-center justify-center rounded-xl bg-[var(--tnm-action)] text-black font-bold px-8 h-[52px] shadow-[0_6px_20px_color-mix(in_srgb,var(--tnm-action)_25%,transparent)] hover:opacity-90 transition-opacity"
          >
            Start Your Plan
          </Link>
        </div>
      </section>
    </div>
  );
}
