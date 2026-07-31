import type { Metadata } from "next";
import { TrackStatus } from "@/components/track/TrackStatus";

export const metadata: Metadata = {
  title: "Track order",
  robots: { index: false },
};

/**
 * Live order tracking (SF-06 / CUJ-06). RSC shell — the polling island is the
 * only client JS. Driven entirely by the guest status endpoint; rider-position
 * and timeline detail arrive with the delivery-domain slice.
 */
export default async function TrackPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  return (
    <div className="min-h-screen">
      <section className="mx-auto flex max-w-lg flex-col items-center px-4 py-12 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Tracking your order
        </h1>
        <p className="tabular mt-3 inline-block rounded-full border border-line bg-surface-raised px-3 py-1 text-xs tracking-wider text-ink-muted">
          #{orderId}
        </p>
        <div className="mt-8 w-full">
          <TrackStatus externalOrderId={orderId} />
        </div>
        <p className="mt-8 max-w-xs text-xs text-ink-faint">
          Fired in our ISO-22000 Noida kitchen after you order — never
          blast-chilled, never reheated.
        </p>
      </section>
    </div>
  );
}
