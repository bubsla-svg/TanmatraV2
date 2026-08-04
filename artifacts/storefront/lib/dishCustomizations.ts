import type { DishCustomGroup } from "@workspace/menu-catalog";

/**
 * Client-side DISPLAY preview for dish customisation pricing. Mirrors the
 * pricing rule in api-server/src/lib/dishCustomizations.ts (base price + sum
 * of every selected option's priceModifier; a selected `default: true` option
 * prices in but is excluded from the label list) so /custom-build can show a
 * live running total as the customer picks.
 *
 * Never authoritative. `POST /orders` sends only the selections below — never
 * a price — and the server resolves the real total against its own copy of
 * `dish.customizations`. An unrecognised group or option here is skipped
 * rather than rejected: a wrong PREVIEW only misleads before checkout, and
 * the server's stricter, fail-closed twin is what actually protects the bill
 * (see BATCH-4-GROUNDING.md finding 1 for why that split matters).
 */

export interface CustomizationSelection {
  groupName: string;
  optionNames: string[];
}

export interface CustomizationPreview {
  modifierPaise: number;
  /** Non-default selected option names — what the summary/cart line shows. */
  labels: string[];
}

export function previewCustomizations(
  groups: readonly DishCustomGroup[],
  selections: readonly CustomizationSelection[],
): CustomizationPreview {
  const groupByName = new Map(groups.map((g) => [g.groupName, g]));
  let modifierPaise = 0;
  const labels: string[] = [];

  for (const selection of selections) {
    const group = groupByName.get(selection.groupName);
    if (!group) continue;
    const optionByName = new Map(group.options.map((o) => [o.name, o]));
    for (const name of selection.optionNames) {
      const option = optionByName.get(name);
      if (!option) continue;
      modifierPaise += option.priceModifier;
      if (!option.default) labels.push(option.name);
    }
  }

  return { modifierPaise, labels };
}

/** The option marked `default: true` in a single-select group, if any —
 *  what a fresh selection UI should preselect so the price shown before any
 *  tap matches what an unmodified add would actually cost (₹0 extra). */
export function defaultOptionName(group: DishCustomGroup): string | undefined {
  return group.options.find((o) => o.default)?.name;
}
