// ─────────────────────────────────────────────────────────────────────────────
// Combo / bundle discount math — PURE (no DB), so the checkout money-path
// invariant is unit-testable without Postgres:
//
//   A combo's saving applies ONLY when the cart contains every one of its
//   component dishes in sufficient quantity. Drop a component (or send a stale
//   combo slug) and the discount is forfeited — the cart reverts to the sum of
//   standalone item prices. The saving amount comes from the server-side bundle
//   row, never from the client.
//
// `finalizeOrder` loads the bundle rows from the DB and delegates the actual
// discount computation here, so this and the live checkout path share one
// source of truth. See loyaltyEngine.bundles.test.ts for the DB-backed
// integration coverage and bundlePricing.test.ts for the pure cases.
// ─────────────────────────────────────────────────────────────────────────────

export interface BundleDef {
  slug: string;
  /** Component dish ids; a repeated id means the combo needs that many. */
  dishIds: number[];
  originalPricePaise: number;
  pricePaise: number;
}

export interface CartLine {
  id: number;
  qty: number;
}

/**
 * Total bundle discount (paise) for the requested combo slugs against the cart.
 *
 * Fail-closed by construction:
 *  - A bundle contributes `originalPricePaise - pricePaise` ONLY if every
 *    component id is present in the cart in sufficient quantity.
 *  - Multiplicity is preserved: the same slug requested twice earns two
 *    discounts only when the cart stocks enough of each component for both.
 *  - Overlapping bundles draw from a shared per-dish remaining budget (higher-
 *    saving bundles applied first), so one line can't satisfy two combos.
 *  - Unknown / empty / unsatisfiable bundles are silently dropped (never throw).
 *  - The total is capped at `grossPaise` so a malformed catalog can't push the
 *    order negative.
 */
export function computeBundleDiscountPaise(input: {
  /** Requested slugs, WITH multiplicity (a combo bought twice appears twice). */
  requestedSlugs: string[];
  /** Resolved bundle rows for the (unique) requested slugs. */
  bundles: BundleDef[];
  items: CartLine[];
  grossPaise: number;
}): number {
  const requestedSlugs = input.requestedSlugs.filter(
    (s) => typeof s === "string" && s.length > 0,
  );
  if (requestedSlugs.length === 0) return 0;

  const bundleBySlug = new Map(input.bundles.map((b) => [b.slug, b]));

  // Per-dish remaining budget from the cart (floored, non-negative).
  const remaining = new Map<number, number>();
  for (const it of input.items) {
    remaining.set(it.id, (remaining.get(it.id) ?? 0) + Math.max(0, Math.floor(it.qty)));
  }

  // Apply higher-savings bundles first so overlapping combos resolve
  // deterministically and in the customer's favour.
  const expanded = requestedSlugs
    .map((s) => bundleBySlug.get(s))
    .filter((b): b is BundleDef => Boolean(b));
  expanded.sort(
    (a, b) =>
      b.originalPricePaise - b.pricePaise - (a.originalPricePaise - a.pricePaise),
  );

  let bundleDiscountPaise = 0;
  for (const b of expanded) {
    const dishIds = Array.isArray(b.dishIds) ? b.dishIds : [];
    if (dishIds.length === 0) continue;

    const required = new Map<number, number>();
    for (const id of dishIds) required.set(id, (required.get(id) ?? 0) + 1);

    let satisfiable = true;
    for (const [id, need] of required) {
      if ((remaining.get(id) ?? 0) < need) {
        satisfiable = false;
        break;
      }
    }
    if (!satisfiable) continue;

    for (const [id, need] of required) {
      remaining.set(id, (remaining.get(id) ?? 0) - need);
    }
    bundleDiscountPaise += Math.max(0, b.originalPricePaise - b.pricePaise);
  }

  return Math.min(bundleDiscountPaise, input.grossPaise);
}
