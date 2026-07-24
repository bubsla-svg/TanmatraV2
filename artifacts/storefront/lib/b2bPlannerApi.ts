import { apiGet, apiPost, apiPut, type FetchImpl } from "@/lib/apiClient";

/**
 * B2B lunch-planner client (route-parity Wave E, admin). Capture a team diet
 * profile → generate a constraint-respecting weekly menu → schedule it (fans out
 * into office_orders). No money-path; the server owns dish resolution + pricing.
 */

export interface TeamDietConstraints {
  headcount: number; vegPct: number; vegCount: number; veganCount: number;
  glutenFreeCount: number; jainCount: number; halalCount: number;
  allergens: string[]; cuisinePrefs: string[];
  calorieFloor: number | null; calorieCeiling: number | null; notes: string;
}
export interface TeamDietProfile { companyId: number; constraints: TeamDietConstraints; lastSurveyAt: string | null; updatedAt: string }

export interface LunchPlanDay { date: string; picks: { menuItemId: number; slug: string; name: string; why: string }[]; warnings: string[] }
export interface LunchPlan { weekStartDate: string; days: LunchPlanDay[]; summary: string; modelId: string; generatedBy: "ai" | "deterministic" }
export type LunchPlanStatus = "draft" | "approved" | "scheduled";
export interface LunchPlanProposal { id: number; companyId: number; weekStartDate: string; plan: LunchPlan; status: LunchPlanStatus; scheduledOfficeOrderIds: number[] }

export interface DietSurveyInput {
  headcount: number; vegCount?: number; veganCount?: number; glutenFreeCount?: number; jainCount?: number; halalCount?: number;
  allergens?: string[]; cuisinePrefs?: string[]; calorieFloor?: number | null; calorieCeiling?: number | null; notes?: string;
}

export const ALLERGEN_OPTIONS = ["peanut", "tree_nut", "milk", "egg", "wheat", "gluten", "soy", "shellfish", "fish", "sesame"];

export function getDietProfile(slug: string, fetchImpl?: FetchImpl): Promise<{ profile: TeamDietProfile | null }> {
  return apiGet(`/companies/${encodeURIComponent(slug)}/diet-profile`, fetchImpl);
}
export function saveDietProfile(slug: string, input: DietSurveyInput, fetchImpl?: FetchImpl): Promise<{ profile: TeamDietProfile }> {
  return apiPut(`/companies/${encodeURIComponent(slug)}/diet-profile`, input, fetchImpl);
}
export function getCurrentPlan(slug: string, fetchImpl?: FetchImpl): Promise<{ proposal: LunchPlanProposal | null }> {
  return apiGet(`/companies/${encodeURIComponent(slug)}/lunch-plan/current`, fetchImpl);
}
export function generatePlan(slug: string, fetchImpl?: FetchImpl): Promise<{ proposal: LunchPlanProposal }> {
  return apiPost(`/companies/${encodeURIComponent(slug)}/lunch-plan/generate`, {}, fetchImpl);
}
export function schedulePlan(id: number, input: { scheduledHour?: number; perEmployeeBudgetPaise?: number }, fetchImpl?: FetchImpl): Promise<{ proposal: LunchPlanProposal; scheduledOfficeOrderIds: number[] }> {
  return apiPost(`/lunch-plans/${id}/schedule`, input, fetchImpl);
}
