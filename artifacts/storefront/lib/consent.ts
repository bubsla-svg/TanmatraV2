/**
 * DPDP Act 2023 consent (SF-05). The api-server's POST /orders REQUIRES an
 * explicit, logged acknowledgement to process dietary/health data for an order
 * — it rejects with 400 `consent_required` otherwise. This version string is
 * stamped verbatim into that server-side audit record; bump it whenever the
 * consent copy below changes so the ledger stays truthful.
 */
export const DPDP_POLICY_VERSION = "dpdp-2023-v1";

export const DPDP_CONSENT_COPY =
  "I agree that Tanmatra may process my dietary and health details to prepare and deliver this order, under the DPDP Act 2023.";
