/**
 * "Why this dish" rationale client (Wave-3). POST /dish-rationales returns a
 * short, per-dish explanation tying the dish to the signed-in customer's
 * profile. The server grounds every line in the dish's real macros/ingredients,
 * forbids allergy-safety claims, and falls back to a plain macro summary when
 * the model is unavailable — so a rendered rationale is always safe to show.
 * Auth-required (401 when signed out). Kept out of lib/api.ts for the file cap.
 */
import { apiPost, type FetchImpl } from "./apiClient";

export type RationaleSource = "cache" | "generated" | "fallback";

export interface DishRationale {
  dishId: number;
  /** One short sentence (≤140 chars). */
  rationale: string;
  /** 2–3 sentence elaboration (≤360 chars); may equal `rationale`. */
  expanded: string;
  source: RationaleSource;
}

/** Batched (the server caps at 12 ids/request); the drawer asks for one. */
export function getDishRationales(
  dishIds: number[],
  fetchImpl?: FetchImpl,
): Promise<{ rationales: DishRationale[] }> {
  return apiPost("/dish-rationales", { dishIds }, fetchImpl);
}
