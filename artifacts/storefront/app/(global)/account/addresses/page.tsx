import type { Metadata } from "next";
import { AccountNav } from "@/components/account/AccountNav";
import { AddressManager } from "@/components/account/AddressManager";

export const metadata: Metadata = {
  title: "Your addresses",
  robots: { index: false },
};

/**
 * Account → Addresses (SF-04). RSC shell; the manager island owns the
 * session-gated CRUD against /api/addresses. Signed-out visitors are offered
 * Firebase sign-in inline, so the page is never a dead end.
 */
export default function AddressesPage() {
  return (
    <section
      data-ui-generation="stitch-74"
      data-screen-id="10.3"
      data-screen-state="default"
      className="mx-auto max-w-md px-4 py-10"
    >
      <AccountNav active="addresses" />
      <h1 className="text-lg font-semibold text-ink">Your addresses</h1>
      <p className="mt-1 mb-5 text-sm text-ink-muted">
        Saved addresses speed up checkout — the default is pre-selected on your next order.
      </p>
      <AddressManager />
    </section>
  );
}
