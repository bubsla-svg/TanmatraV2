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
    <section className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        Tracking your order
      </h1>
      <p className="tabular mt-1 text-sm text-ink-muted">#{orderId}</p>
      <div className="mt-6">
        <TrackStatus externalOrderId={orderId} />
      </div>
      <p className="mt-6 text-xs text-ink-faint">
        Fired in our ISO-22000 Noida kitchen after you order — never
        blast-chilled, never reheated.
      </p>
    </section>
  );
}
