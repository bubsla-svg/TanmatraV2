/**
 * Food-preferences client (Wave-3). Backs the /account/preferences editor
 * against routes/preferences.ts. GET is soft-authed — it returns
 * { preferences: null } at 200 even when signed out (so the UI gates on
 * getAuthUser, not on this read); PATCH is a partial upsert that 401s on a
 * lapsed session. The server owns validation and lowercases + dedupes the
 * free-text lists (allergens/dislikedIngredients/cuisines), so callers must
 * re-seed from the response rather than assume their input casing survives.
 * Kept out of lib/api.ts to stay under the file cap.
 */
import { apiGet, apiPatch, type FetchImpl } from "./apiClient";

export type DietaryStyle = "omnivore" | "vegetarian" | "vegan" | "pescatarian" | "keto";
export type SpiceLevel = "none" | "mild" | "medium" | "hot";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type WellnessGoal = "lose_weight" | "maintain" | "gain_muscle" | "general_wellness";

/** The full server row (routes/preferences.ts returns the decrypted row — the
 *  clinical arrays come back as plaintext). This slice only EDITS the taste/goal
 *  subset (see PreferencesPatch); the clinical metrics are read-only here and
 *  managed on their own future surface. */
export interface UserPreferences {
  userId: string;
  allergens: string[];
  dislikedIngredients: string[];
  medicalConditions: string[];
  cuisines: string[];
  spiceLevel: SpiceLevel;
  dietaryStyle: DietaryStyle;
  goal: WellnessGoal;
  activityLevel: ActivityLevel;
  calorieTarget: number | null;
  proteinTargetGrams: number | null;
  carbsTargetGrams: number | null;
  fatTargetGrams: number | null;
  hba1cPct: number | null;
  pcosHistory: boolean | null;
  heightCm: number | null;
  weightKg: number | null;
  quizCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** The editable subset this slice ships. Clinical metrics
 *  (hba1c/pcos/height/weight/medicalConditions) and macro targets are
 *  deliberately out of scope — a separate, consent-framed surface. */
export interface PreferencesPatch {
  dietaryStyle?: DietaryStyle;
  spiceLevel?: SpiceLevel;
  goal?: WellnessGoal;
  activityLevel?: ActivityLevel;
  allergens?: string[];
  dislikedIngredients?: string[];
  cuisines?: string[];
}

export function getPreferences(
  fetchImpl?: FetchImpl,
): Promise<{ preferences: UserPreferences | null }> {
  return apiGet("/preferences", fetchImpl);
}

export function savePreferences(
  patch: PreferencesPatch,
  fetchImpl?: FetchImpl,
): Promise<{ preferences: UserPreferences }> {
  return apiPatch("/preferences", patch, fetchImpl);
}
