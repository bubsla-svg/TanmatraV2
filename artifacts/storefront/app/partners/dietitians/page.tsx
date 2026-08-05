import type { Metadata } from "next";
import RdPartnersClient from "@/app/rd-partners/RdPartnersClient";

export const metadata: Metadata = {
  title: "Clinical Dietitians Partner Network | Tanmatra",
  description: "Prescribe freshly cooked, clinical-grade metabolic meals to your patients with zero compliance drop-off.",
};

export default function DietitiansPartnerPage() {
  return <RdPartnersClient />;
}
