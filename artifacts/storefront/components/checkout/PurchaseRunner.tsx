"use client";
// Client island: the ONE payment state machine every non-plan money path runs.
// "use client" because it owns the Razorpay modal, the auth gate and the
// captured-but-unverified recovery — all browser-only.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/apiClient";
import { humanizePurchaseError } from "@/lib/orderErrors";
import { emitFunnel, funnelErrorCode } from "@/lib/funnel";
import { createRazorpayAdapter, RazorpayDismissed } from "@/lib/razorpayAdapter";
import type { PaidFacts } from "@/lib/moneyPath";
import type { PurchaseSteps } from "@/lib/purchaseSteps";
import { PhoneAuth } from "./PhoneAuth";
import { UnresolvedPaymentPanel } from "./UnresolvedPaymentPanel";

type Phase = "idle" | "busy" | "verifying" | "unresolved" | "auth";

export function PurchaseRunner<H>({
  steps,
  description,
  amountPaise,
  kind,
  onComplete,
  authPrompt = "Sign in to complete your payment.",
}: {
  steps: PurchaseSteps<H>;
  /** Shown in the Razorpay modal so the customer sees what they are paying for. */
  description: string;
  /** The SERVER's figure for this purchase, for the funnel only — never sent
   *  to the gateway, which bills the server-created order. A funnel event
   *  carrying no amount is not a usable denominator, which is why it is
   *  required rather than optional. */
  amountPaise: number;
  /** Which money path this is, so the three do not collapse into one bucket. */
  kind: "premium" | "marketplace" | "consult";
  /** Fired once the purchase is CONFIRMED, immediately before navigating —
   *  for local state the purchase invalidates (a bought pantry line still
   *  sitting in the cart). Read as a live prop, never captured in a ref, so it
   *  always sees the current render's state. */
  onComplete?: () => void;
  authPrompt?: string;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  // A prior attempt's created handle. Its presence is what makes a retry a
  // RESUME rather than a second purchase.
  const handleRef = useRef<H | null>(null);
  // Money captured, verify unconfirmed. `capturedAtAll` is the flag that
  // downgrades every subsequent failure to "unresolved" — re-enabling the pay
  // CTA from here risks a real second charge. The facts are separate because
  // only the paths verifying at the shared, idempotent endpoint have any
  // (Premium and consults verify at their own, which take a different payload).
  const capturedAtAllRef = useRef(false);
  const capturedRef = useRef<PaidFacts | null>(null);

  const busy = phase === "busy" || phase === "verifying";

  // The denominator. Fired once per mount, on the first render that has the
  // server's amount — before this runner existed, none of these three paths
  // reported anything at all, so their drop-off was invisible.
  const beganRef = useRef(false);
  useEffect(() => {
    if (beganRef.current || amountPaise <= 0) return;
    beganRef.current = true;
    emitFunnel("begin_checkout", { total_paise: amountPaise, item_count: 1, has_plan: false, kind });
  }, [amountPaise, kind]);

  function done() {
    onComplete?.();
    router.push(steps.destination(handleRef.current));
  }

  async function run() {
    if (busy) return;
    setPhase("busy");
    setError(null);
    try {
      const handle = handleRef.current ?? (await steps.create());
      handleRef.current = handle;
      emitFunnel("payment_opened", { total_paise: amountPaise, kind });
      await steps.pay(handle, createRazorpayAdapter({ name: "Tanmatra", description }), (facts) => {
        capturedRef.current = facts ?? null;
        capturedAtAllRef.current = true;
        setPhase("verifying");
      });
      emitFunnel("checkout_complete", { total_paise: amountPaise, kind });
      done();
    } catch (e) {
      // A dismissal is someone changing their mind, not a broken rail — the
      // two must not share a bucket (see lib/moneyFunnel.test.ts).
      emitFunnel("payment_failed", {
        reason: e instanceof RazorpayDismissed ? "dismissed" : funnelErrorCode(e),
        kind,
      });
      if (capturedAtAllRef.current) {
        // Captured but unconfirmed even after the bounded in-flow retries.
        setPhase("unresolved");
        return;
      }
      if (e instanceof ApiError && e.status === 401) {
        setPhase("auth");
        return;
      }
      // Architecture Invariant 18 / Law 9: what happened, and what to do next
      // — never the server's own string. Same rule the two meal checkouts
      // follow via humanizeOrderError; the copy differs only because there is
      // no cart on these screens (lib/orderErrors.ts).
      setError(
        e instanceof RazorpayDismissed
          ? "Payment cancelled — you haven't been charged. Tap to try again."
          : humanizePurchaseError(e),
      );
      setPhase("idle");
    }
  }

  async function checkStatus() {
    setChecking(true);
    try {
      if (await steps.settled(handleRef.current, capturedRef.current)) {
        done();
        return;
      }
    } catch {
      // Fall through — an unreachable server is not evidence of an unpaid
      // purchase, so the panel stays put and the customer can re-ask.
    }
    setChecking(false);
  }

  if (phase === "unresolved") {
    return <UnresolvedPaymentPanel checking={checking} onCheckStatus={() => void checkStatus()} />;
  }

  if (phase === "auth") {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
        <p className="text-sm text-ink-muted">{authPrompt}</p>
        <PhoneAuth
          startExpanded
          onVerified={() => {
            setPhase("idle");
            void run();
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
      <Button
        type="button"
        onClick={() => void run()}
        disabled={busy}
        aria-busy={busy}
        aria-live="polite"
        shape="pill"
        size="fluid"
        className="min-h-12 px-6 py-3.5 font-semibold disabled:opacity-60"
      >
        {phase === "verifying"
          ? "Confirming your payment…"
          : phase === "busy"
            ? "Opening payment…"
            : steps.payLabel}
      </Button>
    </div>
  );
}
