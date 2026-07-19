// Minimal serviceable-pincode lookup for the Noida NCR launch zone.
// Each entry: pincode → { area, city, state }. Used by the Checkout new-
// address form for inline serviceability + city auto-fill.
//
// This is the SHIPPING-SIDE source of truth; the server is expected to
// re-validate at order finalize. Edit this map when ops adds zones.
//
// To extend beyond Noida NCR, replace with a lazy fetch against the
// India Post Pincode API (`api.postalpincode.in/pincode/{pin}`) and
// cache responses.
export interface PincodeInfo {
  area: string;
  city: string;
  state: string;
}

const SERVICEABLE: Record<string, PincodeInfo> = {
  // Noida Core
  "201301": { area: "Noida Sector 1-11 / Harola", city: "Noida", state: "Uttar Pradesh" },
  "201303": { area: "Noida Sector 62 / Shipra", city: "Noida", state: "Uttar Pradesh" },
  "201304": { area: "Noida Sector 63-65 / Mamura", city: "Noida", state: "Uttar Pradesh" },
  "201305": { area: "Noida Sector 82 / Phase II", city: "Noida", state: "Uttar Pradesh" },
  "201306": { area: "Noida Sector 104 / Hazipur", city: "Noida", state: "Uttar Pradesh" },
  "201307": { area: "Noida Sector 12-15 / Naya Bans", city: "Noida", state: "Uttar Pradesh" },
  "201309": { area: "Noida Sector 137 / Expressway", city: "Noida", state: "Uttar Pradesh" },
  "201318": { area: "Noida Sector 150 / Sports City", city: "Noida", state: "Uttar Pradesh" },
};

const PINCODE_RE = /^\d{6}$/;

export type PincodeCheckResult =
  | { state: "empty" }
  | { state: "invalid" }
  | { state: "unserviceable"; pincode: string }
  | { state: "serviceable"; pincode: string; info: PincodeInfo };

export function checkPincode(raw: string): PincodeCheckResult {
  const v = raw.trim();
  if (!v) return { state: "empty" };
  if (!PINCODE_RE.test(v)) return { state: "invalid" };
  const info = SERVICEABLE[v];
  if (!info) return { state: "unserviceable", pincode: v };
  return { state: "serviceable", pincode: v, info };
}
