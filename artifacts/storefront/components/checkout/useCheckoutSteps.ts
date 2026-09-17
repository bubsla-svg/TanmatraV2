"use client";
// Client: an effect over the form's validity flags.
import { useEffect, useRef } from "react";
import { emitFunnel } from "@/lib/funnel";

export type CheckoutStep = "phone" | "slot" | "address" | "consent";

/**
 * T2 (CRO handoff 2026-09-17): `checkout_step` for each of the form's asks,
 * the FIRST time it is satisfied. A step that is later un-satisfied and
 * re-satisfied is not re-counted — the funnel wants "how far did they get",
 * not keystrokes. The fifth step, `pay`, is emitted by the pay handler.
 */
export function useCheckoutSteps(done: Record<CheckoutStep, boolean>): void {
  const emitted = useRef<Set<CheckoutStep>>(new Set());
  const { phone, slot, address, consent } = done;
  useEffect(() => {
    const steps: Array<[CheckoutStep, boolean]> = [
      ["phone", phone],
      ["slot", slot],
      ["address", address],
      ["consent", consent],
    ];
    for (const [step, ok] of steps) {
      if (ok && !emitted.current.has(step)) {
        emitted.current.add(step);
        emitFunnel("checkout_step", { step });
      }
    }
  }, [phone, slot, address, consent]);
}
