import { apiGet, apiPost, type FetchImpl } from "./apiClient";

/**
 * DPDP consent client (routes/userConsents.ts). The health surfaces don't
 * server-enforce consent before a write, so this is a UX + AUDIT obligation:
 * read the consent row, and gate editing on `purposeHealthDataProcessing`,
 * recording the grant (with server-side IP/UA stamp) in the audit table.
 */

export const DPDP_HEALTH_CONSENT_VERSION = "2023_DPDPA_v1"; // matches the server default

export interface ConsentRow {
  purposeClinicalDelivery: boolean;
  purposeMarketing: boolean;
  purposeAiPersonalization: boolean;
  purposeHealthDataProcessing: boolean;
  consentVersion: string;
  status: "granted" | "revoked" | "expired";
  grantedAt: string | null;
  revokedAt: string | null;
}

export function getConsent(fetchImpl?: FetchImpl): Promise<{ consent: ConsentRow | null }> {
  return apiGet("/user-consents", fetchImpl);
}

export function grantHealthConsent(fetchImpl?: FetchImpl): Promise<{ consent: ConsentRow }> {
  return apiPost(
    "/user-consents",
    { purposeHealthDataProcessing: true, consentVersion: DPDP_HEALTH_CONSENT_VERSION },
    fetchImpl,
  );
}

export function revokeHealthConsent(fetchImpl?: FetchImpl): Promise<{ consent: ConsentRow }> {
  return apiPost("/user-consents", { purposeHealthDataProcessing: false }, fetchImpl);
}

export function hasHealthConsent(consent: ConsentRow | null): boolean {
  return consent?.purposeHealthDataProcessing === true;
}
