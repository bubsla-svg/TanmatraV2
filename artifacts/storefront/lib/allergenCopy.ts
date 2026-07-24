import { getAllergenDisclosure, type DishData } from "@workspace/menu-catalog";

/** Visual weight for the disclosure card: `warn` for the unreviewed state that
 *  a customer with allergies must act on, `neutral` for everything else. */
export type AllergenTone = "neutral" | "warn";

export interface AllergenView {
  tone: AllergenTone;
  heading: string;
  /** Named allergens to chip out (may be empty). */
  items: string[];
  /** Provenance caveat shown under the heading. */
  note: string;
  /** True only for the reviewed-and-empty case — the ONE state that may state
   *  "no declared allergens" as fact. Never true for derived-empty/unchecked. */
  affirmativeNone: boolean;
}

type AllergenFields = Pick<DishData, "allergens" | "allergensReviewed" | "allergensDerived">;

/**
 * Turn a dish's allergen disclosure into PDP copy, preserving the catalog's
 * three-state safety distinction (see menu-catalog `getAllergenDisclosure`):
 *
 *  - reviewed + items      → "Contains …" (RD-reviewed).
 *  - reviewed + empty      → affirmative "No declared allergens" (RD-reviewed).
 *  - derived + items       → "Auto-detected …" — flags presence, cannot certify
 *    absence, so it is NEVER an affirmative "none".
 *  - derived + empty       → "No allergens auto-detected" — still not a promise
 *    of absence.
 *  - unchecked             → "under review": data is UNKNOWN, so the card warns
 *    and never renders "no allergens".
 *
 * Keeping this mapping here (not in JSX) is what the unit test pins.
 */
export function allergenView(dish: AllergenFields): AllergenView {
  const disclosure = getAllergenDisclosure(dish);

  if (disclosure.state === "unchecked") {
    return {
      tone: "warn",
      heading: "Allergen information under review",
      items: [],
      note: "Not yet reviewed — if you have food allergies, check with our team before ordering.",
      affirmativeNone: false,
    };
  }

  if (disclosure.state === "derived") {
    const hasItems = disclosure.allergens.length > 0;
    return {
      tone: "neutral",
      heading: hasItems ? "Auto-detected allergens" : "No allergens auto-detected",
      items: disclosure.allergens,
      note: "Auto-detected from the ingredient list — this flags what's present but can't certify absence.",
      affirmativeNone: false,
    };
  }

  // reviewed
  if (disclosure.allergens.length === 0) {
    return {
      tone: "neutral",
      heading: "No declared allergens",
      items: [],
      note: "RD-reviewed disclosure.",
      affirmativeNone: true,
    };
  }
  return {
    tone: "neutral",
    heading: "Contains",
    items: disclosure.allergens,
    note: "RD-reviewed disclosure.",
    affirmativeNone: false,
  };
}
