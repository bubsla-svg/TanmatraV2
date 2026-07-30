import type { Metadata } from "next";
import { Suspense } from "react";
import { fetchMenu } from "@/lib/catalog";
import { CustomBuildHub } from "@/components/custom/CustomBuildHub";

export const metadata: Metadata = {
  title: "Order Customization & Macro Build Hub | Tanmatra",
  description: "Pick a dish, adjust its real customisation options — bread, sauce, portion size and more where available — and add it to your order.",
};

export default async function CustomBuildPage() {
  const { dishes } = await fetchMenu();

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-gold-text">
          Precision Gastronomy Builder
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Order Customization Hub
        </h1>
        <p className="text-sm leading-relaxed text-ink-muted max-w-2xl">
          Choose a dish and configure it using its own customisation options — where a dish
          offers them, such as bread type, sauce or portion size — before adding it to your order.
        </p>
      </div>

      <Suspense fallback={<p className="text-sm text-ink-muted">Booting clinical customization builder…</p>}>
        <CustomBuildHub dishes={dishes} />
      </Suspense>
    </section>
  );
}
