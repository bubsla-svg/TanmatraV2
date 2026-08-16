/**
 * What an address form starts with, and in what order (Law 4 — never ask twice).
 *
 * Three things can fill a blank address form, and they are not equally strong.
 * Keeping the ranking here rather than inline in a component makes it one rule
 * with one test, instead of a rule re-derived per form — which is how the two
 * checkout forms came to disagree in the first place.
 *
 * Precedence, strongest first:
 *   1. Anything already in the field — the customer's own typing, or a saved
 *      address that has landed. Never overwritten, by anything.
 *   2. The session draft — what they typed on this screen before navigating
 *      away. Specific to this form, so it beats a bare PIN.
 *   3. The carried PIN — the answer they gave the serviceability check on the
 *      landing page or /menu. The weakest, and the one that used to be dropped.
 *
 * Pure and DOM-free: the caller reads storage and applies the result.
 */

export interface AddressFields {
  line1: string;
  city: string;
  pincode: string;
}

/** A restored draft. Every field optional — a draft is written mid-typing. */
export type AddressDraft = Partial<AddressFields>;

export function seedAddressFields(
  current: AddressFields,
  draft: AddressDraft,
  carriedPin: string,
): AddressFields {
  return {
    line1: current.line1 === "" ? draft.line1 ?? "" : current.line1,
    city: current.city === "" ? draft.city ?? "" : current.city,
    // The only field with a third source: a PIN is the one piece of an address
    // the customer may have given us somewhere else entirely.
    pincode: current.pincode === "" ? draft.pincode || carriedPin : current.pincode,
  };
}

/**
 * Read a stored address draft, or nothing. Storage access can throw (private
 * mode, partitioned contexts) and the stored JSON is untrusted — a form that
 * cannot restore a draft must still render, and must still seed from the other
 * two sources, so both failures resolve to an empty draft rather than an early
 * return that would skip the carried PIN too.
 */
export function readAddressDraft(storageKey: string): AddressDraft {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const d = parsed as Record<string, unknown>;
    return {
      ...(typeof d.line1 === "string" ? { line1: d.line1 } : {}),
      ...(typeof d.city === "string" ? { city: d.city } : {}),
      ...(typeof d.pincode === "string" ? { pincode: d.pincode } : {}),
    };
  } catch {
    return {};
  }
}
