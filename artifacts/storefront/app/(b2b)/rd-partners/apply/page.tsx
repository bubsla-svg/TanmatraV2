import type { Metadata } from "next";
import { PartnerWizard } from "@/components/rd-partners/PartnerWizard";

export const metadata: Metadata = {
  title: "Apply for Clinical Partnership",
  description: "Submit your IDA credentials and specialties to become a prescribing Dietitian Partner in the Tanmatra clinical network.",
};

/** `/rd-partners/apply` — the wizard's canvas (Stitch brief 16): a centred
 *  640px column with the header above the stepper. Everything below the header,
 *  including step state, belongs to the PartnerWizard island. */
export default function RdPartnersApplyPage() {
  return (
    <section className="mx-auto flex max-w-[640px] flex-col gap-10 px-4 py-[var(--space-section)]">
      <header className="flex flex-col gap-2 text-center">
        <span className="text-2xs font-semibold uppercase tracking-widest text-ink-faint">
          RD partner programme
        </span>
        <h1 className="text-3xl font-display font-semibold leading-tight tracking-tight text-primary">
          Dietitian partner application
        </h1>
        <p className="text-sm leading-relaxed text-ink-muted">
          Our governance committee evaluates every clinical registration to keep patient therapeutic
          compliance strict.
        </p>
      </header>

      <PartnerWizard />
    </section>
  );
}
