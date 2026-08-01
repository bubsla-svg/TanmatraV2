/**
 * Does the address the ambient header is currently pointing at actually get
 * delivered to?
 *
 * `DeliveryAddressBar` resolves an active address from the saved list and
 * announces "Delivering to: Work (Sector 62)" — but nothing re-checked that
 * address's pincode against the service area. A customer whose saved Work
 * address sits outside Noida read an authoritative-looking bar saying we
 * deliver there, and only found out otherwise at checkout.
 *
 * The verdict itself is the server's (`GET /api/serviceability/:pincode`).
 * This module owns the part that is easy to get wrong and impossible to see
 * in a screenshot: deciding WHEN we are entitled to say "we don't deliver
 * here". Pure — no DOM, no network — so every one of those branches is
 * unit-testable.
 */
import type { ServiceabilityVerdict } from "./serviceabilityApi";

/**
 * What the bar is allowed to claim about the active address.
 *
 * `indeterminate` is deliberately NOT collapsed into `undeliverable`. They
 * look similar in a state machine and are opposites to a customer.
 */
export type DeliveryState =
  | { kind: "checking" }
  | { kind: "deliverable"; pincode: string }
  | { kind: "undeliverable"; pincode: string }
  | { kind: "indeterminate" };

/**
 * A pincode we are willing to spend a request on.
 *
 * `checkServiceability` THROWS synchronously on anything that is not six
 * digits, so an unvalidated pincode does not produce a failed request — it
 * produces a rejected query that then has to be told apart from a real
 * unserviceable verdict. Gate before asking.
 */
export function isCheckablePincode(pincode: string): boolean {
  return /^\d{6}$/.test(pincode.trim());
}

export interface DeliveryStateInput {
  /** The active address's pincode, or "" when there is no active address. */
  pincode: string;
  /** TanStack `isPending` — note a DISABLED query reports pending forever. */
  isPending: boolean;
  isError: boolean;
  verdict: ServiceabilityVerdict | undefined;
}

/**
 * ORDER IS LOAD-BEARING, and the first two branches are why.
 *
 * 1. An uncheckable pincode is checked FIRST because the query that would
 *    answer for it is disabled, and a disabled TanStack query sits at
 *    `isPending: true` indefinitely. Reading `isPending` first would park an
 *    address with a malformed pincode on a spinner that never resolves.
 *
 * 2. A transport failure resolves to `indeterminate`, never `undeliverable`.
 *    This is the one place in the storefront where the fail-LOUD convention
 *    is deliberately inverted: a dead cart button is a nuisance, but telling
 *    a perfectly deliverable customer "we don't deliver to you" because the
 *    API blipped is a false claim that loses the order outright. Silence is
 *    the safe failure here; the checkout gate is the real backstop either way.
 */
export function deriveDeliveryState(input: DeliveryStateInput): DeliveryState {
  const pin = input.pincode.trim();
  if (!isCheckablePincode(pin)) return { kind: "indeterminate" };
  if (input.isError) return { kind: "indeterminate" };
  if (input.verdict === "serviceable") return { kind: "deliverable", pincode: pin };
  if (input.verdict === "unserviceable") return { kind: "undeliverable", pincode: pin };
  if (input.isPending) return { kind: "checking" };
  // Settled with no usable verdict ("unknown", or a payload shape we do not
  // recognise). Claim nothing.
  return { kind: "indeterminate" };
}

/**
 * The verdict to mirror into the shared `tnm_serviceability_state` key, or
 * `null` when there is nothing definitive to mirror.
 *
 * Kept separate from the state machine because writing that key is a side
 * effect on storage `ServiceabilityBar` also reads. Without the mirror the two
 * widgets disagree the moment a visitor signs out: the bar would still be
 * showing a verdict for whatever pincode was last typed by hand, not for the
 * address they were actually delivering to.
 */
export function mirroredVerdict(
  state: DeliveryState,
): { verdict: ServiceabilityVerdict; pincode: string } | null {
  if (state.kind === "deliverable") return { verdict: "serviceable", pincode: state.pincode };
  if (state.kind === "undeliverable") return { verdict: "unserviceable", pincode: state.pincode };
  return null;
}
