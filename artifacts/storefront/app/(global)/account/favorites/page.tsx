import type { Metadata } from "next";
import { Suspense } from "react";
import { fetchMenu } from "@/lib/catalog";
import { ProtocolVaultGrid } from "@/components/account/ProtocolVaultGrid";

export const metadata: Metadata = {
  title: "My Protocol Vault & Favorites",
  description: "The meals you saved, with your notes, ready to reorder.",
};

export default async function ProtocolVaultPage() {
  const { dishes } = await fetchMenu();

  return (
    <section className="mx-auto max-w-5xl px-4 py-12 flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <span className="w-fit rounded-full border border-[color-mix(in_srgb,var(--gold)_20%,transparent)] bg-[color-mix(in_srgb,var(--gold)_10%,transparent)] px-3 py-1 text-xs font-bold uppercase tracking-wider text-gold-text">
          Saved by you
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          My Protocol Vault
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-ink-muted">
          Your secure library of metabolism-optimising culinary prescriptions. Revisit your
          bookmarked clinical routines, inspect personal therapeutic notes, and re-queue verified
          protocols for your next delivery cycle.
        </p>
      </div>

      <Suspense fallback={<p className="text-sm text-ink-muted">Accessing vault records…</p>}>
        <ProtocolVaultGrid dishes={dishes} />
      </Suspense>
    </section>
  );
}
