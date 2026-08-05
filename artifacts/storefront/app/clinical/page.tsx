import type { Metadata } from "next";
import ClinicalClient from "./ClinicalClient";

export const metadata: Metadata = {
  title: "Clinical Governance & Metabolic Protocols | Tanmatra",
  description: "Evidence-based clinical culinary medicine designed by registered dietitians to improve glycemic control and metabolic longevity.",
};

export default function ClinicalPage() {
  return <ClinicalClient />;
}
