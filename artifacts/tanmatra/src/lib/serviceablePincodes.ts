// Minimal serviceable-pincode lookup for the Noida / Delhi / Gurgaon launch zone.
// Each entry: pincode → { area, city, state }. Used by the Checkout new-
// address form for inline serviceability + city auto-fill.
//
// This is the SHIPPING-SIDE source of truth; the server is expected to
// re-validate at order finalize. Edit this map when ops adds zones.
//
// To extend beyond Noida / Delhi / Gurgaon, replace with a lazy fetch against the
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

  // Ghaziabad (bordering Noida)
  "201010": { area: "Indirapuram", city: "Ghaziabad", state: "Uttar Pradesh" },
  "201012": { area: "Vasundhara", city: "Ghaziabad", state: "Uttar Pradesh" },
  "201014": { area: "Vaishali / Kaushambi", city: "Ghaziabad", state: "Uttar Pradesh" },

  // Delhi East (bordering Noida)
  "110091": { area: "Mayur Vihar Phase I", city: "Delhi", state: "Delhi" },
  "110092": { area: "Laxmi Nagar / Anand Vihar", city: "Delhi", state: "Delhi" },
  "110096": { area: "Mayur Vihar Phase III / Vasundhara Enclave", city: "Delhi", state: "Delhi" },

  // Delhi (Central & South)
  "110001": { area: "Connaught Place", city: "Delhi", state: "Delhi" },
  "110016": { area: "Hauz Khas / Green Park", city: "Delhi", state: "Delhi" },
  "110017": { area: "Saket / Malviya Nagar", city: "Delhi", state: "Delhi" },
  "110019": { area: "Kalkaji / Nehru Place", city: "Delhi", state: "Delhi" },
  "110020": { area: "Okhla Phase I–III", city: "Delhi", state: "Delhi" },
  "110024": { area: "Lajpat Nagar", city: "Delhi", state: "Delhi" },
  "110025": { area: "New Friends Colony / Jamia", city: "Delhi", state: "Delhi" },
  "110048": { area: "Greater Kailash I–II", city: "Delhi", state: "Delhi" },
  "110049": { area: "South Extension", city: "Delhi", state: "Delhi" },
  "110065": { area: "East of Kailash", city: "Delhi", state: "Delhi" },

  // Gurgaon
  "122001": { area: "Sadar Bazaar / Civil Lines", city: "Gurgaon", state: "Haryana" },
  "122002": { area: "DLF Phase 1–3 / Sector 24–28", city: "Gurgaon", state: "Haryana" },
  "122003": { area: "DLF Phase 4 / Sector 27", city: "Gurgaon", state: "Haryana" },
  "122004": { area: "Sector 14–17 / Old Gurgaon", city: "Gurgaon", state: "Haryana" },
  "122009": { area: "Sector 39–47 / Sohna Road", city: "Gurgaon", state: "Haryana" },
  "122011": { area: "Sector 56 / Sushant Lok II", city: "Gurgaon", state: "Haryana" },
  "122015": { area: "Sector 30–32 / Jharsa", city: "Gurgaon", state: "Haryana" },
  "122016": { area: "Cyber City / Udyog Vihar", city: "Gurgaon", state: "Haryana" },
  "122017": { area: "Sector 44–46", city: "Gurgaon", state: "Haryana" },
  "122018": { area: "Sector 48–50 / Sohna Road", city: "Gurgaon", state: "Haryana" },
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
