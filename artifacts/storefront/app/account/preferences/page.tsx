import type { Metadata } from "next";
import { AccountNav } from "@/components/account/AccountNav";
import { PreferencesHub } from "@/components/account/PreferencesHub";

export const metadata: Metadata = {
  title: "Food preferences",
  robots: { index: false },
};

/**
 * Account → Preferences (Wave-3). RSC shell; PreferencesHub owns the
 * session-gated read/save against /api/preferences.
 */
export default function PreferencesPage() {
  return (
    <section className="mx-auto max-w-md px-4 py-10">
      <AccountNav active="preferences" />
      <h1 className="text-lg font-semibold text-ink">Food preferences</h1>
      <p className="mt-1 mb-5 text-sm text-ink-muted">
        Tell us how you eat — we use this to rank the menu and flag dishes that don&rsquo;t fit.
      </p>
      <PreferencesHub />
    </section>
  );
}
