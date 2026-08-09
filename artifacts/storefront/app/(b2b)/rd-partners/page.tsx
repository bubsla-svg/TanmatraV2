import type { Metadata } from "next";
import { RdPartnersLanding } from "@/components/rd-partners/RdPartnersLanding";

export const metadata: Metadata = {
  title: "Dietitian & Clinical Partnerships | Tanmatra",
  description: "Prescribe freshly cooked, clinical-grade metabolic meals to your patients with zero compliance drop-off.",
};

export default function RdPartnersPage() {
  return <RdPartnersLanding />;
}
