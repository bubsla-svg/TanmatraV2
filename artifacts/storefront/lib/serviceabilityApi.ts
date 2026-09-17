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
 * T5 (CRO handoff 2026-09-17): the verdict also lives in two cookies, so a
 * server component or middleware can read the customer's PIN without waiting
 * for hydration, and a `tnm:serviceability` window event lets every island
 * (header pill, Add buttons, the first-visit banner, checkout) share one
 * answer without a second copy of the state.
 */
export const PIN_COOKIE = "tnm_pin";
export const PIN_OK_COOKIE = "tnm_pin_ok";
export const SERVICEABILITY_EVENT = "tnm:serviceability";
const PIN_COOKIE_MAX_AGE_SEC = 365 * 24 * 60 * 60;

/** The `document.cookie` assignments for a state — set for a verdict, expired
 *  for unknown. Pure, so the shape is testable without a DOM. */
export function serviceabilityCookies(state: ServiceabilityState): string[] {
  const attrs = "; path=/; samesite=lax";
  if (state.verdict === "unknown" || !/^\d{6}$/.test(state.pincode)) {
    return [`${PIN_COOKIE}=${attrs}; max-age=0`, `${PIN_OK_COOKIE}=${attrs}; max-age=0`];
  }
  return [
    `${PIN_COOKIE}=${state.pincode}${attrs}; max-age=${PIN_COOKIE_MAX_AGE_SEC}`,
    `${PIN_OK_COOKIE}=${state.verdict === "serviceable" ? "1" : "0"}${attrs}; max-age=${PIN_COOKIE_MAX_AGE_SEC}`,
  ];
}

function broadcast(state: ServiceabilityState): void {
  if (typeof document !== "undefined") {
    try {
      for (const c of serviceabilityCookies(state)) document.cookie = c;
    } catch {
      /* cookies blocked — localStorage still carries the verdict */
    }
  }
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function" && typeof CustomEvent === "function") {
    window.dispatchEvent(new CustomEvent(SERVICEABILITY_EVENT, { detail: state }));
  }
}

/**
 * The city a PIN belongs to, for prefilling the checkout's city field from
 * the PIN the customer already gave the location gate (Law 4). Prefix table
 * for the NCR only — anywhere else returns null and the field stays blank
 * rather than guessing. Ghaziabad / Delhi / Gurugram are listed because a
 * visitor there still types a PIN, and the refusal reads better with the
 * city named.
 */
export function cityForPincode(pincode: string): string | null {
  const pin = pincode.trim();
  if (!/^\d{6}$/.test(pin)) return null;
  if (pin.startsWith("2013") || pin.startsWith("2103")) return "Noida";
  if (pin.startsWith("2010") || pin.startsWith("2011") || pin.startsWith("2012")) return "Ghaziabad";
  if (pin.startsWith("110")) return "Delhi";
  if (pin.startsWith("122")) return "Gurugram";
  if (pin.startsWith("121")) return "Faridabad";
  return null;
}

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

/**
 * Law 4 ("never ask twice") — the PIN the customer already handed the
 * serviceability check, ready to carry into any later address form. Returns ""
 * when there is nothing usable to carry, so a caller can seed a field with it
 * unconditionally and get today's blank-field behaviour when no check has run.
 *
 * The verdict is deliberately NOT filtered to "serviceable". An unserviceable
 * PIN is still the customer's own answer to "where do you live", and carrying
 * it forward makes the quote say so immediately rather than after they retype
 * it — a stated refusal with a next step beats a blank field (Laws 9, 10).
 *
 * The digit check lives here rather than at each call site: loadServiceability-
 * State only type-checks the stored blob, so a truncated or corrupted PIN would
 * otherwise reach a form field and quietly produce a quote for nowhere.
 */
export function carriedPincode(): string {
  const { verdict, pincode } = loadServiceabilityState();
  if (verdict === "unknown") return "";
  return /^\d{6}$/.test(pincode) ? pincode : "";
}

/** Persist latest serviceability state into localStorage for subsequent page visits. */
export function saveServiceabilityState(state: ServiceabilityState): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* swallow storage quotas or privacy constraints */
  }
  broadcast(state);
}

/** Clear stored serviceability verdict when user initiates re-evaluating delivery location. */
export function clearServiceabilityState(): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* swallow errors */
  }
  broadcast({ verdict: "unknown", pincode: "" });
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

