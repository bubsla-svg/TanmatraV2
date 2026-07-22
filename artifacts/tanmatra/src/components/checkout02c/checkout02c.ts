// ─────────────────────────────────────────────────────────────────────────────
// The Breeze checkout model (roadmap slice S9, spec 02c). Pure + testable: the
// three screens, the decisions evicted from checkout, and the falsifiable load
// budget (02c §4). The screen list a given user sees is computed here so the
// stepper and any Playwright assertion share one source of truth.
//
// Two invariants this checkout makes UNREPRESENTABLE (02c §2/§6): there is no
// coupon/promo field, and COD is never offered. They are encoded as constants
// so a test can assert the flow never grows one.
// ─────────────────────────────────────────────────────────────────────────────

export type CheckoutScreen = "identity" | "address" | "pay";

export interface CheckoutScreenDef {
  id: CheckoutScreen;
  /** The ONE decision this screen asks (02c: one decision per screen). */
  decision: string;
  /** Max typed fields on this screen for a NEW user (auto-fill can reach 0). */
  typedFieldsNew: number;
}

export const CHECKOUT_SCREENS: readonly CheckoutScreenDef[] = [
  { id: "identity", decision: "whose lunch is this", typedFieldsNew: 1 },
  { id: "address", decision: "where", typedFieldsNew: 2 },
  { id: "pay", decision: "pay", typedFieldsNew: 0 },
];

/** Decisions that no longer live in checkout — settled upstream (02c §2). */
export const DECISIONS_EVICTED: readonly string[] = [
  "plan / duration / meals / preference (plan builder)",
  "serviceability (PIN gate at entry)",
  "RD guidance bump (plan review)",
  "delivery slot (stated, not chosen)",
  "start date (defaulted, inline edit)",
  "coupon (the field does not exist)",
  "COD (not offered anywhere)",
];

/** Falsifiable load budget (02c §4). */
export const CHECKOUT_LOAD_BUDGET = {
  screensNewMax: 4,
  screensReturningMax: 2,
  decisionsPerScreen: 1,
  typedFieldsNewMax: 4,
  typedFieldsReturningMax: 0, // tap-only checkout
  tapsToUpiNewMax: 9,
  tapsToUpiReturningMax: 3, // = reorder north star
  wordsAboveCtaMax: 40,
  layoutShiftCls: 0, // a moving total is a §15 defect
} as const;

/** These are structurally absent — asserted by tests so the flow can't grow one. */
export const HAS_COUPON_FIELD = false as const;
export const OFFERS_COD = false as const;

export interface CheckoutUser {
  signedIn: boolean;
  hasSavedAddress: boolean;
}

/**
 * The screens a user actually walks. Signed-in users skip identity; returning
 * users with a saved address skip address (it renders pre-selected on pay).
 * Everyone ends on pay. Order is preserved and pay is always last.
 */
export function screensForUser(user: CheckoutUser): CheckoutScreen[] {
  const screens: CheckoutScreen[] = [];
  if (!user.signedIn) screens.push("identity");
  if (!user.hasSavedAddress) screens.push("address");
  screens.push("pay");
  return screens;
}

/** Total typed fields a NEW user faces across the flow (pre-autofill ceiling). */
export function typedFieldCount(user: CheckoutUser): number {
  return screensForUser(user).reduce((sum, id) => {
    const def = CHECKOUT_SCREENS.find((s) => s.id === id);
    return sum + (def ? def.typedFieldsNew : 0);
  }, 0);
}
