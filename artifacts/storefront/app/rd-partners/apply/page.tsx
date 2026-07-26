import type { Metadata } from "next";
import { PartnerWizard } from "@/components/rd-partners/PartnerWizard";

export const metadata: Metadata = {
  title: "Apply for Clinical Partnership | Tanmatra",
  description: "Submit your IDA credentials and specialties to become a prescribing Dietitian Partner in the Tanmatra clinical network.",
};

export default function RdPartnersApplyPage() {
  return (
    <section className="mx-auto flex max-w-md flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-gold-text">
          Network Credentialing
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Dietitian Partner Application
        </h1>
        <p className="text-sm leading-relaxed text-ink-muted">
          Our Governance Committee evaluates all clinical license registrations to ensure strict patient therapeutic compliance.
        </p>
      </div>

      <PartnerWizard />
    </section>
  );
}
