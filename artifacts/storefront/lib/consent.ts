/**
 * DPDP Act 2023 consent (SF-05). The api-server's POST /orders REQUIRES an
 * explicit, logged acknowledgement to process the data needed to fulfil an
 * order — it rejects with 400 `consent_required` otherwise. This version
 * string is stamped verbatim into that server-side audit record; bump it
 * whenever the consent copy below changes so the ledger stays truthful.
 *
 * v2 rescopes the required consent to what fulfilment actually processes
 * (contact, address, order lines, and the dietary-safety screening every
 * order runs) instead of an open-ended health-data grant. A separate
 * OPTIONAL consent for retaining health/dietary preferences beyond the order
 * is deliberately NOT rendered: guests have no preference capture on this
 * surface yet, so there is nothing real for it to gate — a checkbox wired to
 * nothing would fake a capability (defect register: contract gap, guest
 * preference retention).
 */
export const DPDP_POLICY_VERSION = "dpdp-2023-v2";

export const DPDP_CONSENT_COPY =
  "I agree that Tanmatra may process my contact, address and order details — including the dietary-safety screening needed to prepare and deliver this order — under the DPDP Act 2023.";

/** Rendered beside the required consent so its limits are explicit. */
export const DPDP_SCOPE_NOTE =
  "Used only to fulfil and support this order. No health profile is retained for guest orders.";
