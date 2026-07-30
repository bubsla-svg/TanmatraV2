import type { Metadata } from "next";
import { VoucherRedeem } from "@/components/vouchers/VoucherRedeem";
// Stitch dark scope (route-scoped) — see lib/themes/stitch.css. Money-adjacent
// (BATCH-9-BRIEFS.md Brief 57): wallet + redeem shares /checkout and /trial's
// dark scope + glass sticky footer rather than the lighter Astryx surfaces.
import "@/lib/themes/stitch.css";

export const metadata: Metadata = {
  title: "Wallet & vouchers",
  description: "Redeem a Tanmatra voucher into your wallet and see your credit balance.",
  robots: { index: false },
};

/** `/vouchers` — wallet + voucher redemption (route-parity Wave G). Personal +
 *  auth-gated (noindex). Redeeming credits the wallet ledger; the credit applies
 *  automatically at checkout. Redeem-only — no charge path here. */
export default function VouchersPage() {
  return (
    <div data-stitch="dark" className="min-h-screen bg-[var(--bg)] text-ink">
      {/* pb-44 clears the sticky footer VoucherRedeem renders (single Redeem
          button) — same reasoning as /checkout's pb-44. */}
      <section className="mx-auto max-w-md px-4 pt-10 pb-44">
        <p className="text-xs font-semibold uppercase tracking-wide text-gold-text">Your account</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Wallet &amp; vouchers</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Redeem a voucher code to top up your wallet. Credit is applied automatically at your next checkout.
        </p>
        <div className="mt-6">
          <VoucherRedeem />
        </div>
      </section>
    </div>
  );
}
