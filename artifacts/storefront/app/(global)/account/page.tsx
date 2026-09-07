import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AccountHub } from "@/components/account/AccountHub";

export const metadata: Metadata = {
  title: "Account",
  robots: { index: false },
};

/**
 * Account hub (§2). RSC shell; the hub island owns the session state — the
 * live-order card (GET /orders/active), the section links, and sign-in/out.
 * Signed-out visitors are offered sign-in inline — never a dead end.
 *
 * HELP & POLICIES lives HERE, not inside AccountHub, and that is the whole
 * point of it: the hub returns <SignInOffer/> early on 401 or a null user, so
 * anything nested in it is invisible to exactly the visitor most likely to be
 * hunting for a refund policy or a way to complain. On the page it renders in
 * both states.
 *
 * It replaces the mobile bottom nav's "Account & Information" sheet. That
 * sheet existed because components/Footer.tsx is `max-md:hidden`, so below
 * 768px the ten Company + Legal links had nowhere to live — they were rehomed
 * under the Account tab, which then opened a menu whose contents were 10/12
 * not about your account. Four rows replace ten links: /legal is itself a hub
 * listing every policy document, so the six legal URLs are one tap further in
 * rather than flattened into a grid.
 */
const HELP = [
  { href: "/contact", label: "Contact us" },
  { href: "/faq", label: "FAQ" },
  { href: "/how-it-works", label: "How it works" },
  // One row, not six: /legal is a hub that lists every published policy
  // document, so Terms / Privacy / Refunds / Shipping / Nutrition disclaimer /
  // Complaints stay reachable without six rows of chrome on an account page.
  { href: "/legal", label: "Legal & policies" },
] as const;

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

      <nav aria-label="Help and policies" className="mt-8">
        <h2 className="text-[11px] font-bold uppercase tracking-[.18em] text-ink-muted">Help &amp; policies</h2>
        <div className="mt-3 flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {HELP.map((h) => (
            <Link
              key={h.href}
              href={h.href}
              className="group flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-surface-raised"
            >
              <span className="text-sm font-semibold text-primary">{h.label}</span>
              <ChevronRight
                aria-hidden
                className="h-5 w-5 shrink-0 text-ink-faint transition-transform group-hover:translate-x-1"
              />
            </Link>
          ))}
        </div>
      </nav>
    </section>
  );
}
