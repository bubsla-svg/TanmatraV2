import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RdPartnersLanding } from "@/components/rd-partners/RdPartnersLanding";
import { RD_SERVICES_ENABLED } from "@/lib/flags";

export const metadata: Metadata = {
  title: "Clinical Dietitians Partner Network",
  description: "Prescribe freshly cooked, clinical-grade metabolic meals to your patients with zero compliance drop-off.",
};

export default function DietitiansPartnerPage() {
  // RD services are off until a dietitian is on board (lib/flags.ts). The
  // route stays in the tree; with the flag off it is simply not a page.
  if (!RD_SERVICES_ENABLED) notFound();
  return <RdPartnersLanding screenId="12.6" />;
}
