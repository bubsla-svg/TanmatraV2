/**
 * Price-write authority guard (TNM-ADM-01 ADM-28).
 *
 * `lib/menu.ts::updatePrice` had no validation at all, and
 * `POST /integrations/petpooja/push-menu` bulk-upserts `menu_items` including
 * `price_paise` from an external POS payload — an operator's catalog price
 * could be silently reverted by the next inbound sync. Two independent fixes
 * close this: `push-menu` no longer writes `price_paise` on an existing row
 * (see routes/petpooja.ts), and `updatePrice` itself now rejects a price that
 * isn't a sane value for the dish's category, so a fat-fingered or malicious
 * write can't land even through the one path still allowed to set it.
 *
 * Bands are keyed by `@workspace/menu-catalog`'s canonical `DishCategory`
 * enum (beverages/breakfast/salads/soups/pasta/wraps/bowls/snacks/mains) and
 * were derived from the actual observed price range for each category in
 * `lib/menu-catalog/src/index.ts`'s seed data, padded roughly 30-50% below
 * the observed minimum and 50-100% above the observed maximum so a real
 * promotional or inflation-driven price change still clears the guard.
 * `menu_items.category` is a free-form varchar, not an enum — the admin CMS
 * and PetPooja both write arbitrary category strings (e.g. "Main", "juice",
 * "supplements") that predate this enum, so unmatched categories fall back to
 * DEFAULT_BAND_PAISE, a generous catch-all rather than a hard rejection.
 */

export interface PriceBand {
  minPaise: number;
  maxPaise: number;
}

// Observed ranges (paise), from lib/menu-catalog/src/index.ts's DISHES seed:
//   beverages 6900-23000   breakfast 7900-28000   salads 8900-26900
//   soups     13900-16000  pasta     17900-26900  wraps     6900-26000
//   bowls     19900-25900  snacks    11900-13000  mains    17900-36000
export const CATEGORY_PRICE_BANDS_PAISE: Record<string, PriceBand> = {
  beverages: { minPaise: 4_900, maxPaise: 35_000 },
  breakfast: { minPaise: 4_900, maxPaise: 45_000 },
  salads: { minPaise: 4_900, maxPaise: 40_000 },
  soups: { minPaise: 4_900, maxPaise: 30_000 },
  pasta: { minPaise: 9_900, maxPaise: 45_000 },
  wraps: { minPaise: 4_900, maxPaise: 40_000 },
  bowls: { minPaise: 9_900, maxPaise: 40_000 },
  snacks: { minPaise: 2_900, maxPaise: 30_000 },
  mains: { minPaise: 9_900, maxPaise: 60_000 },
};

/** Catch-all for category strings outside the canonical DishCategory enum
 *  (legacy free-form values, PetPooja-originated categories). Wide enough to
 *  rarely block a legitimate price, narrow enough to still catch a zero, a
 *  decimal-point slip (paise vs. rupees), or a stray extra digit. */
export const DEFAULT_BAND_PAISE: PriceBand = { minPaise: 1_900, maxPaise: 99_900 };

function bandForCategory(category: string): PriceBand {
  const normalized = category.trim().toLowerCase();
  return CATEGORY_PRICE_BANDS_PAISE[normalized] ?? DEFAULT_BAND_PAISE;
}

export class PriceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PriceValidationError";
  }
}

/**
 * Throws PriceValidationError unless `pricePaise` is a positive integer
 * within the band for `category`. Called from updatePrice() so the check
 * applies regardless of caller (admin REST, the CMS agent tool, or the
 * menu-engineering pricing-suggestion approval flow).
 */
export function validatePricePaise(category: string, pricePaise: number): void {
  if (!Number.isInteger(pricePaise)) {
    throw new PriceValidationError(`pricePaise must be an integer, got ${pricePaise}`);
  }
  if (pricePaise <= 0) {
    throw new PriceValidationError(`pricePaise must be positive, got ${pricePaise}`);
  }
  const band = bandForCategory(category);
  if (pricePaise < band.minPaise || pricePaise > band.maxPaise) {
    throw new PriceValidationError(
      `pricePaise ${pricePaise} is outside the band for category "${category}" ` +
        `(${band.minPaise}-${band.maxPaise})`,
    );
  }
}
