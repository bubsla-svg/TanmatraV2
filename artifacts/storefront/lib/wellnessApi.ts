import { apiGet, apiPost, apiDelete, type FetchImpl } from "./apiClient";

/**
 * Wellness nutrition tracker client (route-parity PHI v2). Manual food + water
 * logging against wellness.ts — all session-cookie authed. The wearable
 * subsystems (device push + cloud aggregator) are deliberately DEFERRED; this
 * is the manual tracker only, which stands alone.
 */

export type NutritionLogSource = "auto_order" | "manual" | "water" | "wearable_adjust";

export interface NutritionLog {
  id: number;
  source: NutritionLogSource;
  label: string;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  fiberGrams: number;
  waterMl: number;
  vegServings: number;
  createdAt: string;
}

export interface DayTotals {
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  fiberGrams: number;
  waterMl: number;
  vegServings: number;
}

export interface WellnessTargets {
  calorieTarget: number;
  proteinTargetGrams: number;
  fiberTargetGrams: number;
  waterTargetMl: number;
  vegTargetServings: number;
  /** calorieTarget + activityKcal (a synced wearable bumps it; 0 otherwise). */
  effectiveCalorieTarget: number;
  activityKcal: number;
}

export interface Streak {
  kind: "protein" | "veg";
  currentDays: number;
  bestDays: number;
}

export interface WellnessToday {
  date: string;
  targets: WellnessTargets;
  totals: DayTotals;
  logs: NutritionLog[];
  streaks: { protein: Streak | null; veg: Streak | null };
}

export type WeekDay = DayTotals & { date: string };

export interface WeekTargets {
  calorieTarget: number;
  proteinTargetGrams: number;
  fiberTargetGrams: number;
  waterTargetMl: number;
  vegTargetServings: number;
}

export interface WellnessWeek {
  from: string;
  to: string;
  days: WeekDay[];
  targets: WeekTargets | null;
}

export interface ManualLogInput {
  label: string;
  calories?: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;
  fiberGrams?: number;
  vegServings?: number;
}

export const WATER_PRESETS = [200, 250, 500];

export function getToday(fetchImpl?: FetchImpl): Promise<WellnessToday> {
  return apiGet("/wellness/today", fetchImpl);
}

/** Last-7-days totals (padded server-side, so the bars never have holes). */
export function getWeek(fetchImpl?: FetchImpl): Promise<WellnessWeek> {
  return apiGet("/wellness/week", fetchImpl);
}

export function logMeal(input: ManualLogInput, fetchImpl?: FetchImpl): Promise<{ log: NutritionLog }> {
  return apiPost("/wellness/log", input, fetchImpl);
}

export function logWater(ml: number, fetchImpl?: FetchImpl): Promise<{ log: NutritionLog }> {
  return apiPost("/wellness/water", { ml }, fetchImpl);
}

export function deleteLog(id: number, fetchImpl?: FetchImpl): Promise<{ ok: boolean }> {
  return apiDelete(`/wellness/log/${id}`, fetchImpl);
}

/** Progress % of a value toward a target, clamped to 0–100 for the ring arc. */
export function pctOf(value: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((value / target) * 100));
}
