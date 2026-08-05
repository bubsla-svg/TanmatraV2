import type { Metadata } from "next";
import RdPartnersClient from "./RdPartnersClient";

export const metadata: Metadata = {
  title: "Dietitian & Clinical Partnerships | Tanmatra",
  description: "Prescribe freshly cooked, clinical-grade metabolic meals to your patients with zero compliance drop-off.",
};

export default function RdPartnersPage() {
  return <RdPartnersClient />;
}
