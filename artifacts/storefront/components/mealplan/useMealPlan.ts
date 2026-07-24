"use client";
// Meal-planner lifecycle: load the active plan, generate, swap a slot, accept,
// discard. Session-gated — a 401 anywhere flips `phase` to "needsAuth" so the
// island can offer inline sign-in. Kept in a hook so MealPlanner.tsx stays thin.
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/apiClient";
import {
  getPlans, generatePlan, swapSlot as apiSwapSlot, acceptPlan, discardPlan, pickActivePlan,
  type MealPlan, type MealPlanSlot, type AcceptResult,
} from "@/lib/mealPlanApi";

type Phase = "loading" | "ready" | "needsAuth";

const msg = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

export interface UseMealPlan {
  plan: MealPlan | null;
  phase: Phase;
  busy: boolean;
  error: string | null;
  accepted: AcceptResult | null;
  reload: () => Promise<void>;
  generate: () => Promise<void>;
  accept: () => Promise<void>;
  discard: () => Promise<void>;
  swap: (dayIndex: number, slot: MealPlanSlot, dishId: number) => Promise<void>;
}

export function useMealPlan(): UseMealPlan {
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<AcceptResult | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const { plans } = await getPlans();
      setPlan(pickActivePlan(plans));
      setPhase("ready");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setPhase("needsAuth");
      else { setError(msg(e, "Couldn't load your meal plans.")); setPhase("ready"); }
    }
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  // Shared wrapper for the write actions: one busy flag, 401 → auth gate.
  const run = useCallback(async (fn: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setPhase("needsAuth");
      else setError(msg(e, fallback));
    } finally {
      setBusy(false);
    }
  }, []);

  const generate = useCallback(
    () => run(async () => { const { plan: p } = await generatePlan(); setPlan(p); setAccepted(null); },
      "Couldn't generate a plan."),
    [run],
  );

  const accept = useCallback(
    () => run(async () => { if (!plan) return; const res = await acceptPlan(plan.id); setPlan(res.plan); setAccepted(res); },
      "Couldn't accept the plan."),
    [run, plan],
  );

  const discard = useCallback(
    () => run(async () => { if (!plan) return; await discardPlan(plan.id); setPlan(null); setAccepted(null); },
      "Couldn't discard the plan."),
    [run, plan],
  );

  const swap = useCallback(
    (dayIndex: number, slot: MealPlanSlot, dishId: number) =>
      run(async () => { if (!plan) return; const { plan: p } = await apiSwapSlot(plan.id, dayIndex, slot, dishId); setPlan(p); },
        "Couldn't swap that dish."),
    [run, plan],
  );

  return { plan, phase, busy, error, accepted, reload, generate, accept, discard, swap };
}
