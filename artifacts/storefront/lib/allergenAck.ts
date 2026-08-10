/**
 * Pre-submit allergen-ack surfacing (A2 / D-19 audit finding G1). The server's
 * safety gate (`api-server/src/lib/checkoutSafety.ts` — `assessAllergenAck`)
 * requires a guest whose cart carries an allergen/contraindication-flagged
 * dish and who declared no allergen/medical-condition info to explicitly
 * acknowledge the risk before an order is accepted (422 `allergen_ack_required`
 * otherwise). That gate previously had no pre-submit affordance at all — every
 * allergen-cart guest ate one failed submit before ever seeing why.
 *
 * This mirrors the server's flagged-dish predicate EXACTLY (allergens.length>0
 * OR contraindications.length>0) so the checkbox names the same dishes and
 * allergens the server will check. It is deliberately NOT the enforcement
 * boundary — this module only decides what the checkout screen shows before
 * the customer taps Pay; `assessAllergenAck` on the server is still what
 * actually gates the order, unchanged and untouched by this branch.
 */

export interface AllergenFlaggedDish {
  id: number;
  name: string;
  allergens: string[];
}

export interface FlaggedCartAllergens {
  /** The flagged dishes present in the cart, for naming in the UI. */
  dishes: AllergenFlaggedDish[];
  /** Union of allergens across those dishes — same de-dup the server does. */
  allergens: string[];
}

/** Minimal shape this module needs from a catalog dish — deliberately not
 *  the full `DishData` import, so this stays a leaf with no menu-catalog
 *  dependency and is trivial to unit-test with plain literals. */
export interface AllergenSourceDish {
  id: number;
  name: string;
  allergens?: string[];
  contraindications?: string[];
}

/**
 * Which cart dishes (by id) carry a declared allergen or contraindication,
 * from the given menu snapshot. `cartDishIds` may contain ids the menu
 * snapshot doesn't have (a stale cache, a dish that left the menu) — those
 * are silently not flagged, matching the server: it can only flag dishes it
 * can resolve too.
 */
export function flagCartAllergens(
  cartDishIds: readonly number[],
  menuDishes: readonly AllergenSourceDish[],
): FlaggedCartAllergens {
  const wanted = new Set(cartDishIds);
  const flagged = menuDishes.filter(
    (d) => wanted.has(d.id) && ((d.allergens?.length ?? 0) > 0 || (d.contraindications?.length ?? 0) > 0),
  );
  const allergens = [...new Set(flagged.flatMap((d) => d.allergens ?? []))];
  return {
    dishes: flagged.map((d) => ({ id: d.id, name: d.name, allergens: d.allergens ?? [] })),
    allergens,
  };
}
