/**
 * Front-door location serviceability API client and persistence module (OB-2 / II.1).
 * Pure functions testable without rendering or live networks.
 * Keeps serviceability verdict checks and localStorage state management independent of auth.
 */
import { apiGet, apiPost, type FetchImpl } from "./apiClient";

export type ServiceabilityVerdict = "unknown" | "serviceable" | "unserviceable";

export interface ServiceabilityState {
  verdict: ServiceabilityVerdict;
  pincode: string;
}

export interface ServiceabilityResponse {
  serviceable: boolean;
  code?: string;
  error?: string;
}

const STORAGE_KEY = "tnm_serviceability_state";

/**
 * Check serviceability against public GET /api/serviceability/:pincode.
 * Resolves to serviceable or unserviceable verdict. Throws on malformed inputs.
 */
export async function checkServiceability(
  pincode: string,
  fetchImpl?: FetchImpl,
): Promise<ServiceabilityState> {
  const pin = pincode.trim();
  if (!/^\d{6}$/.test(pin)) {
    throw new Error("Pincode must be exactly 6 digits");
  }
  const res = await apiGet<ServiceabilityResponse>(`/serviceability/${encodeURIComponent(pin)}`, fetchImpl);
  return {
    verdict: res.serviceable ? "serviceable" : "unserviceable",
    pincode: pin,
  };
}

/** Load persisted serviceability verdict from localStorage, safely degrading on SSR or errors. */
export function loadServiceabilityState(): ServiceabilityState {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return { verdict: "unknown", pincode: "" };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { verdict: "unknown", pincode: "" };
    const parsed = JSON.parse(raw) as ServiceabilityState;
    if (parsed.verdict && typeof parsed.pincode === "string") {
      return parsed;
    }
  } catch {
    /* swallow corrupted or inaccessible storage */
  }
  return { verdict: "unknown", pincode: "" };
}

/** Persist latest serviceability state into localStorage for subsequent page visits. */
export function saveServiceabilityState(state: ServiceabilityState): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* swallow storage quotas or privacy constraints */
  }
}

/** Clear stored serviceability verdict when user initiates re-evaluating delivery location. */
export function clearServiceabilityState(): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* swallow errors */
  }
}

export interface ServiceabilityInterestResponse {
  ok: boolean;
  duplicate?: boolean;
}

/**
 * Submit unserviceable interest lead (OB-3 / II.3).
 * Posts {pincode, phone} to public POST /api/serviceability-interest.
 */
export async function submitServiceabilityInterest(
  pincode: string,
  phone: string,
  fetchImpl?: FetchImpl,
): Promise<ServiceabilityInterestResponse> {
  return apiPost<ServiceabilityInterestResponse>(
    "/serviceability-interest",
    { pincode: pincode.trim(), phone: phone.trim() },
    fetchImpl,
  );
}

