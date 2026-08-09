import Link from "next/link";

/**
 * RD partner acquisition landing (shared by /rd-partners and
 * /partners/dietitians). Marketing copy only — the application itself is a
 * separate route (/rd-partners/apply → PartnerWizard) that actually submits
 * to the server. This page used to embed a form whose submit handler was
 * `setSubmitted(true)` with no network call, telling every applicant "our
 * Chief Medical Officer team will review your application" for an
 * application that never left the browser. Splitting the pitch from the real
 * wizard removes that possibility structurally: nothing here can claim a
 * submission happened.
 */
export function RdPartnersLanding() {
  return (
    <div className="pb-32">
      <section className="mx-auto max-w-3xl px-4 py-16 text-center">
        <span className="inline-block rounded-full border border-line bg-surface px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-gold-text">
          Registered dietitian network
        </span>
        <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight text-ink md:text-5xl">
          Prescribe real culinary medicine to your patients.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-ink-muted md:text-base">
          Turn your dietary protocols into freshly cooked, clinical-grade meals delivered directly
          to your patients&rsquo; doorsteps.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/rd-partners/apply"
            className="w-full rounded-full bg-gold px-8 py-4 text-xs font-bold uppercase tracking-widest text-ink shadow-sm transition-all hover:opacity-90 active:scale-[0.98] sm:w-auto"
          >
            Apply for dietitian portal
          </Link>
          <Link
            href="/clinical"
            className="w-full rounded-full border border-line bg-surface px-8 py-4 text-xs font-bold uppercase tracking-widest text-ink transition-all hover:bg-surface-raised active:scale-[0.98] sm:w-auto"
          >
            View clinical governance
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-6 px-4 md:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
          <h3 className="text-base font-bold text-ink">Protocol prescriptions</h3>
          <p className="mt-2 text-xs leading-relaxed text-ink-muted">
            Create custom macro protocols and send direct checkout links to patients.
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
          <h3 className="text-base font-bold text-ink">Patient compliance visibility</h3>
          <p className="mt-2 text-xs leading-relaxed text-ink-muted">
            See meal intake and delivery status ahead of your consultations.
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
          <h3 className="text-base font-bold text-ink">Recurring advisory revenue</h3>
          <p className="mt-2 text-xs leading-relaxed text-ink-muted">
            Earn recurring clinical consulting fees on subscribed meal regimens you manage.
          </p>
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-2xl px-4 text-center">
        <h2 className="text-2xl font-bold text-ink">Join the Tanmatra RD network</h2>
        <p className="mt-2 text-xs text-ink-muted">
          Our governance committee evaluates every clinical registration to keep patient
          therapeutic compliance strict.
        </p>
        <Link
          href="/rd-partners/apply"
          className="mt-6 inline-block rounded-full bg-gold px-8 py-3.5 text-xs font-bold uppercase tracking-widest text-ink shadow-sm transition-opacity hover:opacity-90"
        >
          Start application
        </Link>
      </section>
    </div>
  );
}
