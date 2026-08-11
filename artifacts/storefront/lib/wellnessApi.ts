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

export interface FastingLog {
  id: number;
  userId: string;
  targetHours: number;
  startTime: string;
  endTime: string | null;
  createdAt: string;
}

export function startFasting(targetHours: number, fetchImpl?: FetchImpl): Promise<{ log: FastingLog }> {
  return apiPost("/wellness/fasting/start", { targetHours }, fetchImpl);
}

export function endFasting(fetchImpl?: FetchImpl): Promise<{ log: FastingLog }> {
  return apiPost("/wellness/fasting/end", {}, fetchImpl);
}

export function getActiveFasting(fetchImpl?: FetchImpl): Promise<{ log: FastingLog | null }> {
  return apiGet("/wellness/fasting/active", fetchImpl);
}

export interface FamilyMember {
  id: string;
  name: string;
  relation: string;
  avatar: string;
  healthScore: number;
  streakDays: number;
  hydrationPercent: number;
  proteinPercent: number;
  points: number;
  badge: string;
  rank: number;
}

export function getFamilyLeaderboard(fetchImpl?: FetchImpl): Promise<{ members: FamilyMember[] }> {
  return apiGet("/wellness/family", fetchImpl);
}

export interface PrecisionPlannerInput {
  age: number;
  gender: "male" | "female" | "other";
  heightCm: number;
  weightKg: number;
  activityLevel: "sedentary" | "light" | "moderate" | "active" | "very_active";
  goal: "fat_loss" | "muscle_gain" | "maintenance" | "diabetic_friendly";
  dietPreference: "any" | "veg" | "vegan" | "keto";
  allergens?: string[];
}

export interface ThaliMeal {
  id: number;
  slug: string;
  name: string;
  category: string;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  pricePaise: number;
  image?: string;
}

export interface DailyThali {
  dayNumber: number;
  dayName: string;
  meals: ThaliMeal[];
  totals: {
    calories: number;
    proteinGrams: number;
    carbsGrams: number;
    fatGrams: number;
    pricePaise: number;
  };
}

export interface PrecisionPlanResult {
  bmr: number;
  tdee: number;
  targetCalories: number;
  targetProteinG: number;
  targetCarbsG: number;
  targetFatG: number;
  dailyThalis: DailyThali[];
  totalPlanPricePaise: number;
}

/** Generating ALSO persists the plan as an authoritative draft (opaque
 *  `draftId`, guest-cookie ownership while unauthenticated) so it survives
 *  navigation and the auth boundary — see
 *  docs/audit/PRECISION-PLANNER-DRAFT-ID.md. */
export function generatePrecisionPlan(
  input: PrecisionPlannerInput,
  fetchImpl?: FetchImpl
): Promise<{ plan: PrecisionPlanResult; draftId: string }> {
  return apiPost("/wellness/precision-planner/generate", input, fetchImpl);
}

export interface PrecisionPlanDraft {
  id: string;
  input: PrecisionPlannerInput;
  result: PrecisionPlanResult;
}

/** Resolve a previously-generated draft (reload, or after a sign-in
 *  redirect) instead of forcing the customer to redo the quiz. */
export function getPrecisionPlanDraft(
  draftId: string,
  fetchImpl?: FetchImpl
): Promise<{ draft: PrecisionPlanDraft }> {
  return apiGet(`/wellness/precision-planner/drafts/${encodeURIComponent(draftId)}`, fetchImpl);
}

/** Claim a guest-owned draft once signed in. */
export function claimPrecisionPlanDraft(
  draftId: string,
  fetchImpl?: FetchImpl
): Promise<{ draft: PrecisionPlanDraft }> {
  return apiPost(`/wellness/precision-planner/drafts/${encodeURIComponent(draftId)}/claim`, {}, fetchImpl);
}

export interface DetectedIngredient {
  name: string;
  category: string;
  confidenceScore: number;
}

export interface SuggestedAddOnProduct {
  id: number;
  slug: string;
  name: string;
  category: string;
  pricePaise: number;
  image?: string;
  rationale: string;
}

export interface PantryScanResult {
  detectedIngredients: DetectedIngredient[];
  suggestedRecipes: Array<{
    title: string;
    description: string;
    usesIngredients: string[];
    prepTimeMins: number;
  }>;
  suggestedTanmatraAddOns: SuggestedAddOnProduct[];
}

export function scanPantryVision(
  imageContent: string = "",
  fetchImpl?: FetchImpl
): Promise<{ scanResult: PantryScanResult }> {
  return apiPost("/wellness/pantry-scan", { imageContent }, fetchImpl);
}
