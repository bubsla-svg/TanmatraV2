/**
 * Addresses (SF-04) — the saved-address CRUD client.
 *
 * Split out of `lib/api.ts` when that file crossed the 300-line cap the
 * `lint:filecap` gate enforces. `lib/api.ts` re-exports everything here, so
 * `@/lib/api` remains the single import surface every caller already uses and
 * nothing about the wire contract moved — only the file it lives in.
 */
import { apiPost, apiGet, apiPatch, apiDelete, type FetchImpl } from "./apiClient";

// ── Addresses (SF-04 — session required; 401 without the sid cookie) ──────────
// Grounded contract (userAddresses.ts): GET/POST/PATCH/DELETE /addresses, all
// behind requireAuthUser. The first saved address auto-defaults; an unserviceable
// pincode is refused with 422 `unserviceable_pincode`.
export type AddressType = "home" | "work" | "other";

export interface Address {
  id: string;
  label: string;
  type: AddressType;
  line1: string;
  line2: string;
  city: string;
  pincode: string;
  phone: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AddressInput {
  label: string;
  type?: AddressType;
  line1: string;
  line2?: string | null;
  city: string;
  pincode: string;
  phone: string;
  isDefault?: boolean;
}

export function getAddresses(fetchImpl?: FetchImpl): Promise<{ addresses: Address[] }> {
  return apiGet("/addresses", fetchImpl);
}

export function createAddress(
  body: AddressInput,
  fetchImpl?: FetchImpl,
): Promise<{ address: Address }> {
  return apiPost("/addresses", body, fetchImpl);
}

export function updateAddress(
  id: string,
  patch: Partial<AddressInput>,
  fetchImpl?: FetchImpl,
): Promise<{ address: Address }> {
  return apiPatch(`/addresses/${encodeURIComponent(id)}`, patch, fetchImpl);
}

export function deleteAddress(id: string, fetchImpl?: FetchImpl): Promise<{ ok: true }> {
  return apiDelete(`/addresses/${encodeURIComponent(id)}`, fetchImpl);
}
