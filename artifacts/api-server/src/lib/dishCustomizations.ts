import type { DishCustomGroup } from "@workspace/menu-catalog";

/**
 * Server-side pricing and validation for per-dish customisation groups
 * (`DishCustomGroup[]`, e.g. "Choose Bread Type" → Brown / Multigrain).
 *
 * The client never asserts a price for a customised line — it sends
 * `{ dishId, qty, customizations: selections }` and nothing else. This module
 * is the only place a customisation's `priceModifier` is read and applied;
 * `POST /orders` (checkout.ts) calls it once per line and adds the result to
 * `dish.price`. If a client never called this at all, the storefront would be
 * exactly the bug this module exists to close: a configurator whose selections
 * are silently dropped between the browser and the bill (see
 * docs/stitch/BATCH-4-GROUNDING.md, finding 1).
 *
 * Validation fails CLOSED. An unknown group or option name is a 422, not a
 * silently-ignored selection — silently ignoring a selection would let a
 * customer believe a boost was billed when it wasn't, the same trust failure
 * as the bug this replaces.
 */

export interface CustomizationSelection {
  groupName: string;
  /** Chosen option names within that group. Empty is valid — it means "no
   *  selection for this group", which contributes zero to the price, exactly
   *  as the legacy PDP's `calculatedUnitPrice` treats an unset group. */
  optionNames: string[];
}

export interface CustomizationResolution {
  /** Sum of every selected option's `priceModifier`, paise. Added to the
   *  dish's base price by the caller — never applied here. */
  modifierPaise: number;
  /** Selected option names, EXCLUDING any marked `default: true` — mirrors
   *  the legacy PDP's `collectCustomizations()`, whose own comment states the
   *  reason: cart/kitchen labels should list only what the customer changed,
   *  not the standing default. Kitchen-facing (see lib/kds.ts ticketLines). */
  labels: string[];
}

export type CustomizationValidationResult =
  | ({ ok: true } & CustomizationResolution)
  | { ok: false; error: string };

/**
 * Resolve and price a line's customisation selections against the dish's own
 * `customizations` groups (the only source of truth for valid group/option
 * names and their price modifiers — never trust a name the client sends
 * without checking it against this list).
 */
export function resolveCustomizations(
  groups: readonly DishCustomGroup[],
  selections: readonly CustomizationSelection[] | undefined,
): CustomizationValidationResult {
  const groupByName = new Map(groups.map((g) => [g.groupName, g]));
  let modifierPaise = 0;
  const labels: string[] = [];
  const seenGroups = new Set<string>();

  for (const selection of selections ?? []) {
    if (seenGroups.has(selection.groupName)) {
      return { ok: false, error: `duplicate customisation group: ${selection.groupName}` };
    }
    seenGroups.add(selection.groupName);

    const group = groupByName.get(selection.groupName);
    if (!group) {
      return { ok: false, error: `unknown customisation group: ${selection.groupName}` };
    }

    if (group.type === "single" && selection.optionNames.length > 1) {
      return {
        ok: false,
        error: `group "${group.groupName}" accepts one selection, got ${selection.optionNames.length}`,
      };
    }

    const optionByName = new Map(group.options.map((o) => [o.name, o]));
    const chosenNames = new Set<string>();
    for (const name of selection.optionNames) {
      if (chosenNames.has(name)) {
        return { ok: false, error: `duplicate option "${name}" in group "${group.groupName}"` };
      }
      chosenNames.add(name);

      const option = optionByName.get(name);
      if (!option) {
        return { ok: false, error: `unknown option "${name}" in group "${group.groupName}"` };
      }
      modifierPaise += option.priceModifier;
      if (!option.default) labels.push(option.name);
    }
  }

  // TNM-MENU-01 R-4/§6 — required groups. A required group with no explicit
  // selection falls back to its `default` option (its modifier applies, no
  // kitchen label — the standing-default convention above). A required group
  // with neither a selection nor a default fails CLOSED: silently pricing an
  // unmade mandatory choice would be the same trust failure this module
  // exists to prevent. An empty optionNames array counts as "no selection" —
  // it means the client rendered the group and the customer chose nothing.
  for (const group of groups) {
    if (!group.required) continue;
    const selection = (selections ?? []).find((s) => s.groupName === group.groupName);
    if (selection && selection.optionNames.length > 0) continue;
    const fallback = group.options.find((o) => o.default);
    if (!fallback) {
      return {
        ok: false,
        error: `group "${group.groupName}" requires a selection`,
      };
    }
    modifierPaise += fallback.priceModifier;
  }

  return { ok: true, modifierPaise, labels };
}
