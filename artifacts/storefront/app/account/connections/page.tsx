import type { Metadata } from "next";
import { AccountNav } from "@/components/account/AccountNav";
import { WearablesHub } from "@/components/account/WearablesHub";

export const metadata: Metadata = {
  title: "Health Connections & Telemetry | Tanmatra",
  robots: { index: false },
};

/**
 * Account → Health Connections (Phase 10 / Section 10.8).
 * Canonical route for managing Apple Health, Health Connect, Continuous Glucose
 * Monitors (CGM), Ultrahuman telemetry, sync permissions, and feature influences.
 */
export default function ConnectionsPage() {
  return (
    <section className="mx-auto max-w-md px-4 py-10">
      <AccountNav active="connections" />
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-text">Health Connections</p>
      <h1 className="mt-2 mb-6 text-3xl font-semibold tracking-tight text-ink">Connected Data &amp; CGM</h1>
      <WearablesHub />
    </section>
  );
}
