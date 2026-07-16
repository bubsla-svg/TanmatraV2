import { useEffect } from "react";
import { Link, useParams, type MetaFunction } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { subscriptionsApi } from "@/lib/subscriptionsApi";
import { formatPriceRounded } from "@/lib/api/adapter";
import { track } from "@/lib/analytics";

export const meta: MetaFunction = () => [
  { title: "Order Confirmed | Tanmatra" },
  { name: "robots", content: "noindex, follow" },
];

export const handle = { chrome: false };

// Phase C1/C3 — every à la carte confirmation is the top of the subscription
// funnel: show the per-meal bridge to the trial, and instrument the rungs
// (alacarte_order_placed → bridge_cta_shown → bridge_cta_clicked → trial).
export default function OrderConfirmedStub() {
  const { orderId } = useParams();

  // The trial per-meal, derived live from the server quote (never a hardcoded
  // ₹ literal) so the bridge stays honest if the trial is repriced.
  const { data: trialQuote } = useQuery({
    queryKey: ["trial-quote-bridge"],
    queryFn: () =>
      subscriptionsApi.quote({
        cadence: "weekly",
        mealsPerDelivery: 3,
        planType: "trial",
      }),
    staleTime: 10 * 60 * 1000,
  });
  const trialPerMeal = trialQuote
    ? formatPriceRounded(Math.round(trialQuote.totalPaise / 3))
    : null;

  useEffect(() => {
    track("alacarte_order_placed", { orderId });
    track("bridge_cta_shown", { orderId, surface: "order_confirmed" });
  }, [orderId]);

  return (
    <div
      className="tnm2 nn"
      style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <h1>Order Confirmed</h1>

        {/* Per-meal bridge to the trial — the funnel's first rung. */}
        <div
          className="card border border-white/[0.08]"
          style={{ marginTop: 24, textAlign: "left", background: "var(--tnm-surface-ink-2)" }}
        >
          <div className="sh" style={{ fontWeight: 700 }}>Loved it? Make it a habit.</div>
          <p className="fine text-white/60" style={{ marginTop: 6, lineHeight: 1.5 }}>
            The same dietitian-designed meals, delivered on your schedule — and on
            the 3-Day Trial they work out to{" "}
            <strong>{trialPerMeal ? `${trialPerMeal}/meal` : "less per meal"}</strong>,
            with a registered dietitian planning your week.
          </p>
          <Link
            to="/subscribe?trial=1"
            className="btn btn-p"
            style={{ marginTop: 12, display: "inline-flex" }}
            onClick={() => track("bridge_cta_clicked", { orderId, surface: "order_confirmed" })}
          >
            Start the 3-Day Trial
          </Link>
        </div>

        <div style={{ marginTop: 16 }}>
          <Link to="/menu" className="btn btn-blk">Back to Menu</Link>
        </div>
      </div>
    </div>
  );
}
