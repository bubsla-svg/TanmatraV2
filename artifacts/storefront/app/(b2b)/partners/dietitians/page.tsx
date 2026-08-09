import type { Metadata } from "next";
import { RdPartnersLanding } from "@/components/rd-partners/RdPartnersLanding";

export const metadata: Metadata = {
  title: "Clinical Dietitians Partner Network | Tanmatra",
  description: "Prescribe freshly cooked, clinical-grade metabolic meals to your patients with zero compliance drop-off.",
};

export default function DietitiansPartnerPage() {
  return <RdPartnersLanding />;
}
