import type { Metadata } from "next";
import { getRds } from "@/lib/rdApi";
import { RdCard } from "@/components/rd/RdCard";

export const metadata: Metadata = {
  title: "Our dietitians",
  description:
    "Meet Tanmatra's registered dietitians — metabolic health, sports nutrition, gut health and family nutrition. Every program is designed and signed off by an RD.",
};

export const revalidate = 3600;

/** `/rd` — RD directory (route-parity Wave D, read-only). Server-fetched grid.
 *  Booking + payment is a separate, checkpoint-gated slice. */
export default async function RdDirectoryPage() {
  const rds = await getRds();
  return (
    <section className="mx-auto max-w-5xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-wide text-gold-text">Registered dietitians</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Our dietitians</h1>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">
        Every Tanmatra program is designed and signed off by a registered dietitian. Meet the team —
        each offers a free 15-minute intro consult.
      </p>
      {rds.length === 0 ? (
        <p className="mt-10 text-sm text-ink-muted">
          Our directory is briefly unavailable — please check back shortly.
        </p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rds.map((rd) => (
            <RdCard key={rd.slug} rd={rd} />
          ))}
        </div>
      )}
    </section>
  );
}
