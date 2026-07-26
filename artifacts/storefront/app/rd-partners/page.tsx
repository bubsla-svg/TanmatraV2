import type { Metadata } from "next";
import { PartnerHero } from "@/components/rd-partners/PartnerHero";

export const metadata: Metadata = {
  title: "Partner with Tanmatra | Clinical Nutritionists & Dietitians",
  description: "Join India's premiere therapeutic food network. Prescribe macro-calibrated meals to your patients with automated contraindication safety gates.",
};

export default function RdPartnersPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      <PartnerHero />
    </section>
  );
}
