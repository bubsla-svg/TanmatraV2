import type { Metadata } from "next";
import { AccountNav } from "@/components/account/AccountNav";
import { WearablesHub } from "@/components/account/WearablesHub";

export const metadata: Metadata = {
  title: "Health Connections | Tanmatra",
  robots: { index: false },
};

/**
 * Account → Health Connections (Phase 10 / Section 10.8).
 * Canonical route for managing Apple Health and Health Connect connection status,
 * approved data categories (Steps, Workouts, Active energy, Sleep duration, Weight),
 * feature-influence permissions, sync health, and disconnection.
 */
export default function ConnectionsPage() {
  return (
    <section
      data-ui-generation="stitch-74"
      data-screen-id="10.8"
      data-screen-state="default"
      className="mx-auto max-w-md px-4 py-10"
    >
      <AccountNav active="connections" />
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-text">Health Connections</p>
      <h1 className="mt-2 mb-6 text-3xl font-semibold tracking-tight text-ink">Connected Health Data</h1>
      <WearablesHub />
    </section>
  );
}
