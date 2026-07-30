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
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Preferences</h1>
      <p className="mt-2 mb-10 text-sm text-ink-muted">
        Tailor your metabolic protocols and culinary ranking — we use this to rank the menu and
        flag dishes that don&rsquo;t fit.
      </p>
      <PreferencesHub />
    </section>
  );
}
