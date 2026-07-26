import Link from "next/link";

export function PartnerHero() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-gold-text">
          Clinical Nutrition Partnership
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Join India&rsquo;s First Clinical Food Network
        </h1>
        <p className="text-sm leading-relaxed text-ink-muted">
          We combine prescription pathology with precision kitchen gastronomy in Noida/NCR. Partner with Tanmatra to prescribe real, portion-controlled therapeutic meals to your clinical patients.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface p-4 flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-ink">Zero Culinary Friction</h3>
          <p className="text-xs text-ink-muted leading-relaxed">
            Stop giving dry diet sheets. Assign exact macro-verified menu items prepared by executive chefs and delivered directly to patients.
          </p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4 flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-ink">Clinical Contraindications</h3>
          <p className="text-xs text-ink-muted leading-relaxed">
            Our automated safety gates enforce strict glycemic index and allergen locks for Diabetes, PCOS, GERD, and Renal profiles.
          </p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4 flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-ink">Dedicated Advisory Fees</h3>
          <p className="text-xs text-ink-muted leading-relaxed">
            Receive automated payouts for intro calls, follow-up video consults, and recurring subscription care oversight.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface p-5 flex flex-col gap-4">
        <h2 className="text-base font-semibold text-ink">Who We Partner With</h2>
        <p className="text-sm text-ink-muted leading-relaxed">
          We invite Registered Dietitians (RD), Clinical Nutritionists with active institutional credentials, and Bariatric Care specialists operating across Delhi NCR.
        </p>
        <Link
          href="/rd-partners/apply"
          className="flex w-full items-center justify-center rounded-xl bg-gold py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-gold/90 transition-colors"
        >
          Begin Partner Application
        </Link>
      </div>
    </div>
  );
}
