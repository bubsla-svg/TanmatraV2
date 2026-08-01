/**
 * Which saved address is the ambient header currently delivering to.
 *
 * Split out of the component because the selection rule has real edge cases —
 * a remembered id that no longer exists, several addresses flagged default,
 * none flagged — and each is a way to render the WRONG address in a bar the
 * user reads as authoritative. Pure and DB/DOM-free so all of them are
 * unit-testable without mounting anything.
 */
import type { Address } from "./api";

const STORAGE_KEY = "tnm_active_address_id";

/**
 * Resolution order: remembered choice → server default → first row.
 *
 * The remembered id is checked for EXISTENCE, not trusted. Addresses are
 * deletable from `/account/addresses` and on another device, so a stored id
 * routinely outlives its row; honouring it blindly would leave the bar
 * either blank or — worse — silently falling through to a different address
 * than the one named.
 */
export function pickActiveAddress(
  addresses: readonly Address[],
  rememberedId: string | null,
): Address | null {
  if (addresses.length === 0) return null;
  if (rememberedId !== null) {
    const remembered = addresses.find((a) => a.id === rememberedId);
    if (remembered) return remembered;
  }
  // `.find` takes the FIRST default. Nothing in the schema stops two rows
  // carrying isDefault, and picking deterministically beats picking whichever
  // the query happened to order first.
  return addresses.find((a) => a.isDefault) ?? addresses[0] ?? null;
}

/**
 * The bar reads "Delivering to: Home (Sector 54)" — label plus the most
 * specific locality hint available.
 *
 * `line2` is preferred over `city` because in Noida it carries the sector,
 * which is what actually distinguishes two saved addresses; "Home (Noida)"
 * and "Work (Noida)" tell the user nothing. Falls back to city, then to the
 * label alone rather than rendering an empty bracket.
 */
export function formatDeliveryLabel(address: Address): string {
  const hint = (address.line2 || "").trim() || (address.city || "").trim();
  return hint ? `${address.label} (${hint})` : address.label;
}

/* ─────────────────────────────── persistence ─────────────────────────────── */

/** Reads are guarded: localStorage throws in sandboxed iframes and is absent
 *  during SSR. A failure here must degrade to "no remembered choice", never
 *  take the header down. */
export function loadActiveAddressId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveActiveAddressId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Private-mode quota or a sandboxed frame. The choice still applies for
    // this session via component state; only its persistence is lost.
  }
}
