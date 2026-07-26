/**
 * Ecosystem features frontend client library (PRD Phase 3: Features #4, #5, #7, #10).
 * Communicates with /api/symptom-logs, /api/community/qa, /api/nutrition-history, and /api/challenge-tracker.
 * Strictly uses relative imports in lib/ and session authentication cookies.
 */
import { apiGet, apiPost } from "./apiClient";

export interface SymptomLogEntry {
  id: number;
  loggedDate: string;
  symptomType: string;
  severity: number;
  notes: string;
  relatedDishSlug: string;
}

export interface QaThread {
  id: number;
  authorName: string;
  questionTitle: string;
  questionBody: string;
  category: string;
  rdAnswer: string;
  rdAnsweredBy: string;
  upvotes: number;
  createdAt: string;
}

export interface NutritionHistorySummary {
  logs: Array<{
    id: number;
    loggedFor: string;
    label: string;
    calories: number;
    proteinGrams: number;
    fiberGrams: number;
  }>;
  targets: {
    calorieTarget: number;
    proteinTargetGrams: number;
    fiberTargetGrams: number;
    waterTargetMl: number;
  };
}

export interface ChallengeTrackerData {
  challenges: Array<{
    id: number;
    slug: string;
    title: string;
    description: string;
    durationDays: number;
    rdName: string;
  }>;
  memberships: Array<{
    challengeId: number;
    joinedAt: string;
  }>;
  checkIns: Array<{
    id: number;
    title: string;
    scheduledAt: string;
    joinUrl: string;
  }>;
}

export async function getMySymptomLogs(): Promise<SymptomLogEntry[]> {
  return apiGet<SymptomLogEntry[]>("/symptom-logs");
}

export async function recordSymptomLog(input: Omit<SymptomLogEntry, "id">): Promise<SymptomLogEntry> {
  return apiPost<SymptomLogEntry>("/symptom-logs", input);
}

export async function getCommunityQaThreads(): Promise<QaThread[]> {
  return apiGet<QaThread[]>("/community/qa");
}

export async function submitQuestionThread(input: { questionTitle: string; questionBody: string; category: string }): Promise<QaThread> {
  return apiPost<QaThread>("/community/qa", input);
}

export async function getMyNutritionHistory(): Promise<NutritionHistorySummary> {
  return apiGet<NutritionHistorySummary>("/nutrition-history");
}

export async function getMyChallengeTracker(): Promise<ChallengeTrackerData> {
  return apiGet<ChallengeTrackerData>("/challenge-tracker");
}
