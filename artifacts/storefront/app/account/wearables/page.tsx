import type { Metadata } from "next";
import { AccountNav } from "@/components/account/AccountNav";
import { WearablesHub } from "@/components/account/WearablesHub";

export const metadata: Metadata = {
  title: "Wearables & Telemetry | Tanmatra",
  robots: { index: false },
};

/**
 * Account → Wearables & Telemetry Integration (Phase 10).
 * Connect Continuous Glucose Monitors (CGM), Apple Health, and Ultrahuman
 * telemetry for real-time meal response scoring without making medical claims.
 */
export default function WearablesPage() {
  return (
    <section className="mx-auto max-w-md px-4 py-10">
      <AccountNav active="wearables" />
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-text">Biometric Telemetry</p>
      <h1 className="mt-2 mb-6 text-3xl font-semibold tracking-tight text-ink">Wearables &amp; CGM</h1>
      <WearablesHub />
    </section>
  );
}
