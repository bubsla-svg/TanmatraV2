import type { Metadata } from "next";
import { GroupOrderView } from "@/components/group/GroupOrderView";

export const metadata: Metadata = {
  title: "Group order",
  robots: { index: false },
};

/**
 * Group order (route-parity Wave E). Shared via a code, so noindex. RSC shell;
 * the island owns the public read + host close-&-checkout (which merges the
 * group's picks into the cart and reuses the existing checkout money-path).
 */
export default async function GroupOrderPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <section className="mx-auto max-w-lg px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-wide text-gold-text">Group order</p>
      <h1 className="mt-1 mb-6 text-2xl font-semibold tracking-tight text-ink">Order together, pay once</h1>
      <GroupOrderView code={code.toUpperCase()} />
    </section>
  );
}
