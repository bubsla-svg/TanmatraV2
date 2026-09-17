import type { Metadata } from "next";
import { Suspense } from "react";
import { fetchMenu } from "@/lib/catalog";
import { CustomBuildHub } from "@/components/custom/CustomBuildHub";
import { FocusHeader } from "@/components/FocusHeader";

// Rendered from the live catalog on every request. Prerendered at build time
// this page baked in the static fallback (API unreachable inside the image
// build) and served stale prices and dead image paths in production —
// "Activated Charcoal Smoothie ₹69 /images/dishes/charcoal-smoothie.jpg"
// while the API said ₹50. Prices on a page that adds to cart must be live.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Order Customization & Macro Build Hub",
  description: "Pick a dish, adjust its real customisation options — bread, sauce, portion size and more where available — and add it to your order.",
};

export default async function CustomBuildPage() {
  const { dishes } = await fetchMenu();

  return (
    <div className="min-h-dvh">
      <FocusHeader backLabel="Back to menu" />
      <section className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-12">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-gold-text">
            Precision Gastronomy Builder
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">
            Order Customization Hub
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-ink-muted">
            Choose a dish and configure it using its own customisation options — where a dish
            offers them, such as bread type, sauce or portion size — before adding it to your order.
          </p>
        </div>

        <Suspense fallback={<p className="text-sm text-ink-muted">Booting clinical customization builder…</p>}>
          <CustomBuildHub dishes={dishes} />
        </Suspense>
      </section>
    </div>
  );
}
