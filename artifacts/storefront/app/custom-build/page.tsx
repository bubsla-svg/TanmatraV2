import type { Metadata } from "next";
import { Suspense } from "react";
import { fetchMenu } from "@/lib/catalog";
import { CustomBuildHub } from "@/components/custom/CustomBuildHub";

export const metadata: Metadata = {
  title: "Order Customization & Macro Build Hub | Tanmatra",
  description: "Configure personalized clinical lunch bowls, adjust bioavailable protein extensions, and save custom routines directly to your Protocol Vault.",
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
          Construct custom daily nutrition bowls by pairing canonical culinary recipes with verified organic prebiotic fiber and muscle hypertrophy protein extensions.
        </p>
      </div>

      <Suspense fallback={<p className="text-sm text-ink-muted">Booting clinical customization builder…</p>}>
        <CustomBuildHub dishes={dishes} />
      </Suspense>
    </section>
  );
}
