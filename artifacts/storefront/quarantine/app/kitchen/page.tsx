import type { Metadata } from "next";
import { KitchenBoard } from "@/components/kitchen/KitchenBoard";

export const metadata: Metadata = {
  title: "Kitchen board",
  robots: { index: false },
};

/**
 * The kitchen display (KDS).
 *
 * An internal ops surface inside the storefront app. It is linked from nowhere,
 * absent from app/sitemap.ts (an explicit allowlist, so new routes are excluded
 * by default), and de-indexed above — but none of that is the security
 * boundary. The boundary is server-side: GET/POST /api/ops/kds/* require ops
 * scope (adminGate.ts, which accepts the signed tanmatra_admin_sid cookie), so
 * without an ops session this page renders a "signed out" banner and nothing
 * else. There is no secret in client JS to leak.
 *
 * Since the order-channel work the board shows OWN-APP meal orders only — the
 * aggregator and counter tickets are prepared from Petpooja's own screen, which
 * is where those orders already print. §5 of claude/order-channel-split.md
 * records that as provisional: one board instead of two is a one-line change in
 * routes/ops.ts (drop the orderChannel predicate) and an owner's call, not a
 * code one. This page needs no change either way.
 *
 * Known wart: it inherits the marketing chrome (header, footer, bottom nav)
 * from the root layout, because Next has one root layout per app and this route
 * lives in the storefront. It costs vertical space on a wall tablet and nothing
 * else; moving ops surfaces out is a bigger decision than this branch.
 */
export default function KitchenPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="text-xl font-semibold tracking-tight text-ink">Kitchen</h1>
      <p className="mt-1 mb-4 text-sm text-ink-muted">
        Own-app orders, oldest first. Tap Ready when a ticket leaves the pass.
      </p>
      <KitchenBoard />
    </section>
  );
}
