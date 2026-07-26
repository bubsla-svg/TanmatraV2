import type { Metadata } from "next";
import { Suspense } from "react";
import { fetchMenu } from "@/lib/catalog";
import { ProtocolVaultGrid } from "@/components/account/ProtocolVaultGrid";

export const metadata: Metadata = {
  title: "My Protocol Vault & Favorites | Tanmatra",
  description: "Manage your personal bookmarked therapeutic meal prescriptions, custom annotations, and rapid recurring order presets.",
};

export default async function ProtocolVaultPage() {
  const { dishes } = await fetchMenu();

  return (
    <section className="mx-auto max-w-5xl px-4 py-12 flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-gold-text">
          Personal Clinical Repository
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          My Protocol Vault
        </h1>
        <p className="text-sm leading-relaxed text-ink-muted max-w-2xl">
          Review your bookmarked clinical meal routines, inspect personal therapeutic notes, and rapidly transfer verified dietary protocols into your delivery queue.
        </p>
      </div>

      <Suspense fallback={<p className="text-sm text-ink-muted">Accessing vault records…</p>}>
        <ProtocolVaultGrid dishes={dishes} />
      </Suspense>
    </section>
  );
}
