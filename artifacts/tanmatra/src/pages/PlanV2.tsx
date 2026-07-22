import { useState } from "react";
import type { MetaFunction } from "react-router";
import { Navigate, useNavigate } from "react-router";
import { PLAN_CATALOG, type PlanId, type DietTrack, type AddOnId } from "@workspace/subscription-rules";
import { planV2Enabled } from "@/lib/planV2Flag";
import { GoalRouter, PlanBuilder, usePlanQuote } from "@/components/cuj";
import { OrderBump, planDisplay } from "@/components/plans";
import {
  CheckoutIdentity,
  CheckoutAddress,
  CheckoutPay,
  screensForUser,
  type CheckoutScreen,
} from "@/components/checkout02c";
import { Price } from "@/components/primitives";

export const meta: MetaFunction = () => [
  { title: "Find your plan | Tanmatra" },
  { name: "robots", content: "noindex, nofollow" },
];

export const handle = { chrome: false };

// INFERRED demo RD identity for the OrderBump (real RD roster lives in the
// absent Amendment 02 / RD data). Flagged — reviewer-facing draft only.
const DEMO_RD = { rdName: "Priya Nair", credential: "RD, Clinical Nutrition" };
const CLINIC_RATE_PAISE = 199900; // ₹1,999 reference (02f §2.5)

type Step = "router" | "builder" | "review" | "checkout" | "done";

// Demo identity for the checkout walk-through (a new, signed-out user).
const DEMO_USER = { signedIn: false, hasSavedAddress: false };

/**
 * `/plan-v2` — S10 cut-over DRAFT. A single flag-gated route that walks the
 * 02-series journey end to end (goal router → configure-by-exception builder →
 * RD bump review → 3-screen Breeze checkout) from the S7/S8/S9 components, on
 * server-quoted prices. Default OFF → redirects to the live /subscribe, so this
 * changes nothing for real users; a reviewer sets VITE_FLAG_PLAN_V2 (and points
 * the api-server at its FLAG_PLAN_V2) to verify the flow before cut-over.
 */
export default function PlanV2() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("router");
  const [planId, setPlanId] = useState<PlanId | null>(null);
  const [track, setTrack] = useState<DietTrack>("veg");
  const [addOns, setAddOns] = useState<AddOnId[]>([]);
  const [checkoutIdx, setCheckoutIdx] = useState(0);

  // One quote source for review + checkout, re-quoted when add-ons change.
  const quoteQ = usePlanQuote(step === "router" ? null : planId, track, addOns);
  const quote = quoteQ.data?.kind === "quote" ? quoteQ.data : null;

  if (!planV2Enabled()) {
    return <Navigate to="/subscribe" replace />;
  }

  if (step === "router") {
    return (
      <GoalRouter
        onSelect={(dest) => {
          if (dest.kind === "menu") {
            navigate("/menu");
            return;
          }
          setPlanId(dest.planId);
          setStep("builder");
        }}
        onDismiss={() => navigate("/")}
      />
    );
  }

  if (step === "builder" && planId) {
    return (
      <PlanBuilder
        planId={planId}
        onConfirm={(sel) => {
          setTrack(sel.track);
          setStep("review");
        }}
        onWaitlist={() => setStep("done")}
      />
    );
  }

  if (step === "review" && planId) {
    const allowsBump = PLAN_CATALOG[planId].addOnsAllowed.includes("rd_bump");
    const bumpAccepted = addOns.includes("rd_bump");
    const screens = screensForUser(DEMO_USER);
    return (
      <section className="flex flex-col gap-4 p-4" aria-label="Review">
        <h2 style={{ fontSize: "1.375rem", fontWeight: 600, margin: 0 }}>Review</h2>

        <div
          className="flex items-baseline justify-between rounded-xl px-4"
          style={{ minHeight: 56, backgroundColor: "var(--color-ink-800)" }}
        >
          <span className="text-sm" style={{ color: "var(--color-ink-500)" }}>Monthly total</span>
          {quote ? <Price paise={quote.totalPaise} size="lg" /> : <span className="text-sm">…</span>}
        </div>

        {allowsBump && (
          <OrderBump
            rdName={DEMO_RD.rdName}
            credential={DEMO_RD.credential}
            pricePaise={49900}
            clinicRatePaise={CLINIC_RATE_PAISE}
            valueLines={["2 video sessions a month", "Weekly tuning on WhatsApp"]}
            accepted={bumpAccepted}
            onAccept={() => setAddOns(["rd_bump"])}
            onRemove={() => setAddOns([])}
          />
        )}

        <button
          type="button"
          onClick={() => {
            setCheckoutIdx(0);
            setStep("checkout");
          }}
          className="rounded-xl px-4 py-3 text-center font-semibold transition-transform active:scale-[0.98]"
          style={{ backgroundColor: "var(--color-saffron-500)", color: "var(--color-saffron-on)" }}
        >
          Continue — {screens.length} step{screens.length > 1 ? "s" : ""}
        </button>
      </section>
    );
  }

  if (step === "checkout" && planId) {
    const screens = screensForUser(DEMO_USER);
    const screen: CheckoutScreen = screens[checkoutIdx];
    const summary = `${planDisplay(planId).name} · ${PLAN_CATALOG[planId].mealsPerCycle} lunches`;
    const advance = () =>
      checkoutIdx + 1 < screens.length ? setCheckoutIdx(checkoutIdx + 1) : setStep("done");

    if (screen === "identity") {
      return <CheckoutIdentity planSummary={summary} onSubmitPhone={advance} />;
    }
    if (screen === "address") {
      return (
        <CheckoutAddress
          totalPaise={quote?.totalPaise ?? 0}
          savedAddresses={[]}
          onSelect={advance}
          onAddNew={advance}
        />
      );
    }
    return (
      <CheckoutPay
        planSummary={summary}
        totalPaise={quote?.totalPaise ?? 0}
        futureStateLabel="Next billing next month · pause or cancel anytime."
        onPayUpi={() => setStep("done")}
      />
    );
  }

  return (
    <section className="flex flex-col gap-3 p-6 text-center" aria-label="Draft complete">
      <h2 style={{ fontSize: "1.375rem", fontWeight: 600, margin: 0 }}>End of the draft flow</h2>
      <p className="text-sm" style={{ color: "var(--color-ink-500)", margin: 0 }}>
        This is the S10 cut-over review harness. Payment, OTP, and address wiring land
        when FLAG_PLAN_V2 flips and the live checkout is retired.
      </p>
      <button
        type="button"
        onClick={() => {
          setPlanId(null);
          setAddOns([]);
          setStep("router");
        }}
        className="mx-auto rounded-xl px-4 py-2.5 font-semibold"
        style={{
          backgroundColor: "transparent",
          color: "var(--color-saffron-300)",
          border: "1px solid var(--color-saffron-700)",
        }}
      >
        Start over
      </button>
    </section>
  );
}
