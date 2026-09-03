import type { AddressFields } from "./addressSeed";

/**
 * Which incoming address may seed the plan checkout's address step, and when
 * (Law 4 — never ask twice; and never overwrite what the customer typed).
 *
 * Two things arrive on `PlanDetails.initialAddress`, at different moments:
 *   1. The serviceability gate's PIN seed — `{ line1: "", city: "", pincode }`.
 *      It is there from the first render, and it is not an address: only the
 *      PIN is worth keeping.
 *   2. The customer's saved default address, which lands a moment later, after
 *      sign-in resolves and `/api/addresses` answers.
 *
 * The old effect seeded once and then stopped for good, so the PIN seed used
 * up the one prefill and the saved address was ignored — every returning
 * customer typed their address again. The ranking here is the à-la-carte
 * form's, made explicit:
 *   - the customer's own typing wins over everything (`touched`);
 *   - a complete address (one with a street line) seeds the form once;
 *   - a bare seed fills only fields that are still empty and never consumes
 *     that once-only prefill.
 *
 * Pure and DOM-free: the component keeps the refs and applies the result.
 */
export interface PlanAddressSeedState {
  /** The customer has typed into (or picked into) the address fields. */
  touched: boolean;
  /** A complete address has already seeded the form once. */
  prefilled: boolean;
}

export interface PlanAddressSeedResult {
  next: AddressFields;
  prefilled: boolean;
}

export function isCompleteAddress(address: AddressFields | null | undefined): boolean {
  return !!address && address.line1.trim().length > 0;
}

export function seedPlanAddress(
  current: AddressFields,
  incoming: AddressFields | null | undefined,
  state: PlanAddressSeedState,
): PlanAddressSeedResult {
  if (!incoming || state.touched) return { next: current, prefilled: state.prefilled };

  if (isCompleteAddress(incoming)) {
    if (state.prefilled) return { next: current, prefilled: true };
    return { next: { line1: incoming.line1, city: incoming.city, pincode: incoming.pincode }, prefilled: true };
  }

  // A bare seed: fill what is still empty, and leave the prefill for the real thing.
  return {
    next: {
      line1: current.line1 === "" ? incoming.line1 : current.line1,
      city: current.city === "" ? incoming.city : current.city,
      pincode: current.pincode === "" ? incoming.pincode : current.pincode,
    },
    prefilled: state.prefilled,
  };
}
