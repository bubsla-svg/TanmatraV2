"use client";
// Client: reads the funnel session cookie / sessionStorage for the arm.
import { useRef } from "react";
import { currentAttribution } from "@/lib/acquisition";
import { experimentProps, magicCheckoutVariant, type Variant } from "@/lib/experiments";
import { MAGIC_CHECKOUT_PILOT_ENABLED } from "@/lib/flags";

/**
 * T10: the Magic Checkout arm for this checkout mount — decided once, sticky
 * per funnel session (or per tab when no session cookie exists), null when
 * the pilot is off. `props` is the block every checkout funnel event carries
 * so begin_checkout → purchase can be split by arm; `magic` is whether the
 * one-click sheet is opened and the gateway order carries line_items_total.
 */
export function useMagicCheckoutArm(): { magic: boolean; props: Record<string, string> } {
  const arm = useRef<Variant | null | undefined>(undefined);
  if (arm.current === undefined && typeof window !== "undefined") {
    arm.current = magicCheckoutVariant({
      enabled: MAGIC_CHECKOUT_PILOT_ENABLED,
      sessionId: currentAttribution().sessionId,
      storage: window.sessionStorage,
    });
  }
  return { magic: arm.current === "treatment", props: experimentProps(arm.current ?? null) };
}
