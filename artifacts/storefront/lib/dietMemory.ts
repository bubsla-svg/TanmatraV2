import type { DietFilterChip } from "./dietFilter";
import type { DietaryStyle } from "./preferencesApi";

/**
 * What a signed-out visitor told us about how they eat (Law 4 — never ask
 * twice).
 *
 * Both places that ask assumed a server round-trip would carry the answer, and
 * for an anonymous visitor neither does:
 *
 *   • The quick-setup wizard saves through `savePreferences`, best-effort, and
 *     swallows the 401 a signed-out visitor gets. Someone who has just answered
 *     "Strictly Vegetarian" then reaches /menu, where `resolveInitialDietChip`
 *     gates on `getAuthUser`, finds nobody, and returns "all" — so the menu
 *     shows them chicken. That is worse than asking twice: it is asking, being
 *     told, and then acting against the answer.
 *
 *   • In the other direction the menu's own Veg chip lives in component state
 *     and the URL, so walking into the wizard starts again from "Omnivore" —
 *     a default that contradicts what they just filtered for.
 *
 * Two facts of different strength are kept apart on purpose:
 *
 *   "declared"  — the wizard's dietary-style question. A statement about how
 *                 they eat, so the style is worth keeping in full.
 *   "filtered"  — a Veg/Non-veg chip tap on the menu. A request to narrow a
 *                 list, NOT a declaration of identity, so no `style` is
 *                 inferred from it. Reading "vegan" out of a Veg filter tap
 *                 would be inventing a clinical fact from a browsing gesture.
 *
 * Local only, and never a substitute for the server: `resolveInitialDietChip`
 * consults a signed-in customer's stored preferences first and only falls back
 * here when the server has no answer to give.
 */

export type DietMemorySource = "declared" | "filtered";

export interface DietMemory {
  chip: Exclude<DietFilterChip, "all">;
  source: DietMemorySource;
  /** Present only for "declared" — see the note above. */
  style?: DietaryStyle;
}

const STORAGE_KEY = "tnm_diet_memory";

const VEG_STYLES: readonly DietaryStyle[] = ["vegetarian", "vegan"];

/**
 * The chip a declared style narrows to.
 *
 * Only the unambiguously meat-free styles map to "veg", matching
 * `resolveInitialDietChip`'s existing reading. Pescatarian and keto do not
 * narrow to either chip — neither answer would be true — so they map to no
 * memory at all rather than a wrong one.
 */
export function chipForStyle(style: DietaryStyle): DietMemory["chip"] | null {
  if (VEG_STYLES.includes(style)) return "veg";
  if (style === "omnivore") return "non_veg";
  return null;
}

/**
 * The style they DECLARED, for re-seeding the question that asked it.
 *
 * Deliberately null for a "filtered" memory. Pre-selecting "Strictly
 * Vegetarian" because someone tapped a Veg chip would assert more than they
 * said — and the wizard saves its answer to their real preferences, so the
 * over-claim would outlive the session as a clinical-ish fact they never gave.
 * Re-asking a question they have not answered is the correct behaviour.
 */
export function recalledDietaryStyle(): DietaryStyle | null {
  const m = recallDiet();
  return m?.source === "declared" && m.style ? m.style : null;
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

/**
 * Record what they told us. A "filtered" fact never overwrites a "declared"
 * one: someone who answered the wizard and then browsed the menu with the
 * Non-veg chip has not retracted the answer they gave, and the wizard's
 * question is the one that was actually about them.
 */
export function rememberDiet(memory: DietMemory): void {
  if (!canUseStorage()) return;
  if (memory.source === "filtered" && recallDiet()?.source === "declared") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    /* storage denied (private mode / partitioned context) — nothing to carry */
  }
}

/** Forget it — for an explicit reset, and so a "declared" fact is replaceable. */
export function forgetDiet(): void {
  if (!canUseStorage()) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to do */
  }
}

/**
 * Read it back, or null. Untrusted JSON: a stored blob that does not parse to
 * a chip this app actually renders is discarded rather than coerced, since the
 * value drives which dishes a possibly-strict vegetarian is shown.
 */
export function recallDiet(): DietMemory | null {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const m = parsed as Record<string, unknown>;
    if (m.chip !== "veg" && m.chip !== "non_veg") return null;
    if (m.source !== "declared" && m.source !== "filtered") return null;
    return {
      chip: m.chip,
      source: m.source,
      ...(typeof m.style === "string" ? { style: m.style as DietaryStyle } : {}),
    };
  } catch {
    return null;
  }
}
