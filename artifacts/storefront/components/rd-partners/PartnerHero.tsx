import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * `/rd-partners` hero + programme summary (Stitch brief 16 restyle).
 * Server component. The CTA hands off to the application wizard at
 * `/rd-partners/apply`.
 */
export function PartnerHero() {
  return (
    <div className="flex flex-col gap-[var(--space-section)]">
      <header className="flex flex-col gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-gold-text">
          Clinical nutrition partnership
        </span>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
          Clinical scale, <span className="text-gold-text">culinary soul.</span>
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-ink-muted">
          We combine prescription pathology with precision kitchen gastronomy in Noida/NCR. Partner with
          Tanmatra to prescribe real, portion-controlled therapeutic meals to your clinical patients.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-5">
          <h3 className="text-base font-semibold text-ink">Zero culinary friction</h3>
          <p className="text-sm leading-relaxed text-ink-muted">
            Stop giving dry diet sheets. Assign exact macro-verified menu items prepared by executive chefs
            and delivered directly to patients.
          </p>
        </div>
        <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-5">
          <h3 className="text-base font-semibold text-ink">Clinical contraindications</h3>
          <p className="text-sm leading-relaxed text-ink-muted">
            Our automated safety gates enforce strict glycemic index and allergen locks for Diabetes, PCOS,
            GERD, and Renal profiles.
          </p>
        </div>
        <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-5">
          <h3 className="text-base font-semibold text-ink">Dedicated advisory fees</h3>
          <p className="text-sm leading-relaxed text-ink-muted">
            Receive automated payouts for intro calls, follow-up video consults, and recurring subscription
            care oversight.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-5 rounded-3xl border border-line bg-surface p-6">
        <h2 className="text-xl font-semibold tracking-tight text-ink">Who we partner with</h2>
        <p className="text-sm leading-relaxed text-ink-muted">
          We invite Registered Dietitians (RD), Clinical Nutritionists with active institutional credentials,
          and Bariatric Care specialists operating across Delhi NCR.
        </p>
        <Button
          asChild
          shape="pill"
          size="fluid"
          className="inline-flex w-full items-center justify-center px-8 py-4 font-semibold"
        >
          <Link href="/rd-partners/apply">Begin partner application</Link>
        </Button>
      </div>
    </div>
  );
}
