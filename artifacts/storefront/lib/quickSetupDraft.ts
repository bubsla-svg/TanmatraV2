/**
 * Quick Setup wizard draft (Journey 3 / SF-0x, D-04B contract). The 3-step
 * survey lived in plain component state with no persistence — a refresh, an
 * accidental back gesture, or a tab switch mid-wizard silently discarded
 * every answer, with no confirmation and no way back. sessionStorage mirrors
 * postCheckout.ts's shape: same-tab, dies with the tab, storage failures
 * never break the wizard (private-mode Safari throws on access).
 *
 * `conditions` (local-only PCOS/diabetes checkboxes) was dropped under D-04B:
 * the contract is exactly three one-question viewports (goal, dietary style,
 * allergens) — a condition signal now arrives only via the incoming
 * `?condition=` query param from /care, never a fourth in-wizard question.
 */

export interface QuickSetupDraft {
  step: 1 | 2 | 3;
  goal: string;
  dietaryStyle: string;
  allergens: string[];
}

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const KEY = "tnm:quick-setup-draft";

function defaultStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function isStep(v: unknown): v is QuickSetupDraft["step"] {
  return v === 1 || v === 2 || v === 3;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

/** Never throws — a storage quirk must not break the wizard. */
export function stashQuickSetupDraft(
  draft: QuickSetupDraft,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // Quota or privacy failures — this tick just doesn't persist.
  }
}

/** null when absent, corrupt, or storage is unreadable — callers fall back
 *  to the wizard's normal step-1 defaults. */
export function readQuickSetupDraft(
  storage: StorageLike | null = defaultStorage(),
): QuickSetupDraft | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const p = parsed as Record<string, unknown>;
    if (!isStep(p.step)) return null;
    if (typeof p.goal !== "string") return null;
    if (typeof p.dietaryStyle !== "string") return null;
    if (!isStringArray(p.allergens)) return null;
    return { step: p.step, goal: p.goal, dietaryStyle: p.dietaryStyle, allergens: p.allergens };
  } catch {
    return null;
  }
}

/** Called once the survey completes (step 4 / save attempted) — the draft's
 *  job was bridging an in-progress survey, not tracking a finished one. */
export function clearQuickSetupDraft(storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(KEY);
  } catch {
    // ignore
  }
}
