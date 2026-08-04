import type { Metadata } from "next";
import { AccountNav } from "@/components/account/AccountNav";
import { HealthInfoHub } from "@/components/account/HealthInfoHub";

export const metadata: Metadata = {
  title: "Health & clinical information",
  robots: { index: false },
};

/**
 * Account → Health information (route-parity — PHI/Track 4). The DPDPA-native
 * clinical surface: explicit health-data consent, an edit form for the clinical
 * profile, and the §12 right-to-erasure. Personal PHI, so noindex.
 */
export default function HealthInformationPage() {
  return (
    <section className="mx-auto max-w-md px-4 py-10">
      <AccountNav active="health" />
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-text">DPDP compliance &amp; privacy</p>
      <h1 className="mt-2 mb-6 text-3xl font-semibold tracking-tight text-ink">Health information</h1>
      <HealthInfoHub />
    </section>
  );
}
