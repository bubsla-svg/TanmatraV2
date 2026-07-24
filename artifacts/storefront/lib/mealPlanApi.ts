import { apiGet, apiPost, apiPatch, apiPut, type FetchImpl } from "@/lib/apiClient";

/**
 * Weekly meal-planner client (route-parity Wave H). Wraps the api-server's
 * /meal-plans endpoints — all session-cookie authed (401 without a session).
 * Ported from the legacy app's mealPlanApi; the DB shape is authoritative, so
 * day slots are OPTIONAL here (a generated plan fills all 21, but render
 * defensively). NO charge path: accept just assigns dishes to already-scheduled
 * deliveries on an active weekly subscription (or marks the draft accepted).
 */

export type MealPlanSlot = "breakfast" | "lunch" | "dinner";
export type MealPlanStatus = "draft" | "accepted" | "scheduled" | "discarded";
export const MEAL_SLOTS: MealPlanSlot[] = ["breakfast", "lunch", "dinner"];

export interface MealPlanSlotEntry {
  dishId: number;
  slug: string;
  name: string;
  image: string;
  pricePaise: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MealPlanDay {
  date: string;
  breakfast?: MealPlanSlotEntry;
  lunch?: MealPlanSlotEntry;
  dinner?: MealPlanSlotEntry;
}

export interface MealPlanConstraints {
  dailyCalorieTarget: number | null;
  dailyProteinTargetGrams: number | null;
  weeklyBudgetPaise: number | null;
  maxRepetitionsPerDish: number;
  allergens: string[];
  dietaryStyle: string | null;
  spiceLevel: string | null;
  goal: string | null;
  weekCalendar?: ("normal" | "gym" | "travel" | "wfh")[];
}

export interface MealPlanTotals {
  totalPaise: number;
  avgCalories: number;
  avgProteinGrams: number;
  avgCarbsGrams: number;
  avgFatGrams: number;
}

export interface MealPlan {
  id: number;
  userId: string;
  weekStartDate: string;
  status: MealPlanStatus;
  constraints: MealPlanConstraints;
  days: MealPlanDay[];
  totals: MealPlanTotals | null;
  subscriptionId: number | null;
  model: string | null;
  notes: string | null;
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AcceptResult {
  plan: MealPlan;
  deliveryIds: number[];
  subscriptionId: number | null;
}

export type GenerateOverrides = Partial<
  Pick<MealPlanConstraints, "weeklyBudgetPaise" | "maxRepetitionsPerDish" | "dailyCalorieTarget" | "dailyProteinTargetGrams" | "weekCalendar">
>;

export function getPlans(fetchImpl?: FetchImpl): Promise<{ plans: MealPlan[] }> {
  return apiGet("/meal-plans", fetchImpl);
}

export function generatePlan(
  input?: { weekStartDate?: string; overrides?: GenerateOverrides },
  fetchImpl?: FetchImpl,
): Promise<{ plan: MealPlan; usedFallback: boolean }> {
  return apiPost("/meal-plans/generate", input ?? {}, fetchImpl);
}

export function swapSlot(
  id: number, dayIndex: number, slot: MealPlanSlot, dishId: number, fetchImpl?: FetchImpl,
): Promise<{ plan: MealPlan }> {
  return apiPatch(`/meal-plans/${id}/slot`, { dayIndex, slot, dishId }, fetchImpl);
}

export function getSwapSuggestions(
  planId: number, dayIndex: number, slot: MealPlanSlot, fetchImpl?: FetchImpl,
): Promise<{ suggestions: MealPlanSlotEntry[] }> {
  return apiPost("/meal-plans/swap-suggestions", { planId, dayIndex, slot }, fetchImpl);
}

export function acceptPlan(id: number, fetchImpl?: FetchImpl): Promise<AcceptResult> {
  return apiPost(`/meal-plans/${id}/accept`, {}, fetchImpl);
}

export function discardPlan(id: number, fetchImpl?: FetchImpl): Promise<{ plan: MealPlan }> {
  return apiPost(`/meal-plans/${id}/discard`, {}, fetchImpl);
}

/** Active plan = the draft if one exists, else the most recent, else null
 *  (mirrors the legacy planner's selection). */
export function pickActivePlan(plans: MealPlan[]): MealPlan | null {
  return plans.find((p) => p.status === "draft") ?? plans[0] ?? null;
}

/** Weekday label for a plan-day's ISO date, rendered in IST-agnostic UTC so the
 *  Mon–Sun grid never shifts a day across timezones. */
export function formatPlanDay(iso: string): string {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
  });
}

// ── v2: week calendar · per-day regenerate · settings ────────────────────────

export type WeekDayCalendarKind = "normal" | "gym" | "travel" | "wfh";
export const WEEK_CALENDAR_CYCLE: WeekDayCalendarKind[] = ["normal", "gym", "travel", "wfh"];

export interface MealPlanSettings {
  autoReplanEnabled: boolean;
  weeklyBudgetPaise: number | null;
  maxRepetitionsPerDish: number;
}

/** Regenerate a single day of a DRAFT plan (409 if not draft). */
export function regenerateDay(id: number, dayIndex: number, fetchImpl?: FetchImpl): Promise<{ plan: MealPlan }> {
  return apiPost(`/meal-plans/${id}/regenerate-day`, { dayIndex }, fetchImpl);
}

export function getSettings(fetchImpl?: FetchImpl): Promise<{ settings: MealPlanSettings }> {
  return apiGet("/meal-plan-settings", fetchImpl);
}

export function updateSettings(patch: Partial<MealPlanSettings>, fetchImpl?: FetchImpl): Promise<{ settings: MealPlanSettings }> {
  return apiPut("/meal-plan-settings", patch, fetchImpl);
}
