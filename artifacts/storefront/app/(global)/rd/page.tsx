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
    <section
      data-ui-generation="stitch-74"
      data-screen-id="11.5"
      data-screen-state="default"
      className="mx-auto max-w-[1240px] px-5 py-12 sm:px-8 sm:py-16"
    >
      <div className="max-w-2xl">
        <p className="text-[11px] font-bold uppercase tracking-[.18em] text-accent">Registered dietitians</p>
        <h1 className="mt-3 font-display text-3xl font-semibold leading-[1.05] tracking-[-.02em] text-primary">Our dietitians</h1>
        <p className="mt-4 text-base leading-7 text-ink-muted">
          Every Tanmatra program is designed and signed off by a registered dietitian. Meet the team —
          each offers a free 15-minute intro consult.
        </p>
      </div>
      {rds.length === 0 ? (
        <p className="mt-10 text-base leading-7 text-ink-muted">
          Our directory is briefly unavailable — please check back shortly.
        </p>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rds.map((rd) => (
            <RdCard key={rd.slug} rd={rd} />
          ))}
        </div>
      )}
    </section>
  );
}
