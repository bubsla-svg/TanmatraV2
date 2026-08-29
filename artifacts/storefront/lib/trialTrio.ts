/**
 * The fixed trial trio, resolved against the live catalogue.
 *
 * Extracted from `/trial`'s page so the QR landing can show the SAME three
 * dishes, with the same macro-trust rule, without a second copy of the logic.
 * Two surfaces selling one offer must not be able to disagree about what is in
 * the box — and a copy is exactly how they would.
 *
 * NO "@/" ALIAS IMPORTS (storefront lib rule).
 */
import type { DishData } from "@workspace/menu-catalog";
import { findDish } from "./catalog";
import { macroTrust } from "./dishTrust";
import { TRIAL_TRIO } from "./trial";

export type TrialTrack = "veg" | "nonveg";

export interface TrioDish {
  slug: string;
  name: string;
  image: string;
  /** Law 8 — the trio is the highest-intent dish moment in this funnel and it
   *  carried a name and a photo only, on a product whose whole claim is that
   *  the numbers are known. Absent when the catalog has none to give, never
   *  filled in. */
  macros?: { calories: number; protein: number };
  macrosEstimated?: boolean;
}

/**
 * Resolve a track's fixed slug trio against the live menu (name, image and the
 * dish's own macros for the preview). Missing slugs are DROPPED, not faked —
 * the price stays the spine's regardless, so a catalogue gap costs a thumbnail
 * rather than misstating what arrives.
 *
 * `sharedMacroKeys` comes from `buildSharedMacroKeys(dishes)` over the WHOLE
 * payload, not this trio: F-1 showed duplicated macro tuples arriving from the
 * DB with no `macrosProvisional` flag at all, and the shared-key half of
 * `macroTrust` is the only part that catches those.
 */
export function resolveTrio(
  track: TrialTrack,
  dishes: DishData[],
  sharedMacroKeys: ReadonlySet<string>,
): TrioDish[] {
  return (TRIAL_TRIO[track] ?? [])
    .map((slug) => findDish(slug, dishes))
    .filter((d): d is DishData => Boolean(d))
    .map((d) => ({
      slug: d.slug,
      name: d.name,
      image: d.image,
      ...(macroTrust(d, sharedMacroKeys) === "unverified"
        ? {}
        : {
            macros: { calories: d.macros.calories, protein: d.macros.protein },
            macrosEstimated: d.macrosEstimated === true,
          }),
    }));
}
