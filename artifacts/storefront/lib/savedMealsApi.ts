/**
 * Protocol Vault ("My Favorites & Saved Meals") frontend API client (PRD Feature #1).
 * Communicates with /api/saved-meals endpoints using session cookies and relative imports.
 */
import { apiGet, apiPost, apiDelete } from "./apiClient";

export interface SavedMeal {
  id: number;
  userId: string;
  dishSlug: string;
  dishName: string;
  notes: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SaveMealInput {
  dishSlug: string;
  dishName: string;
  notes?: string;
  tags?: string[];
}

export async function getMySavedMeals(): Promise<SavedMeal[]> {
  return apiGet<SavedMeal[]>("/saved-meals");
}

export async function saveMealToVault(input: SaveMealInput): Promise<SavedMeal> {
  return apiPost<SavedMeal>("/saved-meals", input);
}

export async function removeMealFromVault(dishSlug: string): Promise<{ success: boolean }> {
  return apiDelete<{ success: boolean }>(`/saved-meals/${encodeURIComponent(dishSlug)}`);
}
