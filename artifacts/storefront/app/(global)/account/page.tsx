import type { Metadata } from "next";
import { AccountHub } from "@/components/account/AccountHub";

export const metadata: Metadata = {
  title: "Account",
  robots: { index: false },
};

/**
 * Account hub (§2). RSC shell; the hub island owns the session state — the
 * live-order card (GET /orders/active), the section links, and sign-in/out.
 * Signed-out visitors are offered sign-in inline — never a dead end.
 */
export default function AccountPage() {
  return (
    <section
      data-ui-generation="stitch-74"
      data-screen-id="10.1"
      data-screen-state="default"
      className="mx-auto max-w-md px-4 py-10"
    >
      <h1 className="font-display text-3xl font-semibold leading-[1.05] tracking-[-.02em] text-primary">Account</h1>
      <AccountHub />
    </section>
  );
}
