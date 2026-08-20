"use client";
// Meal-planner lifecycle: load the active plan, generate, swap a slot, accept,
// discard. Session-gated — a 401 anywhere flips `phase` to "needsAuth" so the
// island can offer inline sign-in. Kept in a hook so MealPlanner.tsx stays thin.
import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/apiClient";
import {
  getPlans, generatePlan, swapSlot as apiSwapSlot, acceptPlan, discardPlan, regenerateDay, pickActivePlan,
  WEEK_CALENDAR_CYCLE, type MealPlan, type MealPlanSlot, type AcceptResult, type WeekDayCalendarKind,
} from "@/lib/mealPlanApi";
import { planSwapWarning } from "@/lib/planMacroGuard";

type Phase = "loading" | "ready" | "needsAuth";

const msg = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);
const isAuthError = (e: unknown) => e instanceof ApiError && e.status === 401;

export interface UseMealPlan {
  plan: MealPlan | null;
  phase: Phase;
  busy: boolean;
  error: string | null;
  accepted: AcceptResult | null;
  /**
   * Amber notice when the last swap left that day off its prescribed macro
   * targets. Null when the day is on target, when the plan sets no targets, or
   * when nothing has been swapped this session. NOT an error — the swap
   * succeeded; this is the clinical consequence of it.
   */
  macroWarning: string | null;
  weekCalendar: WeekDayCalendarKind[];
  cycleDay: (dayIndex: number) => void;
  reload: () => Promise<void>;
  generate: () => Promise<void>;
  accept: () => Promise<void>;
  discard: () => Promise<void>;
  swap: (dayIndex: number, slot: MealPlanSlot, dishId: number) => Promise<void>;
  regenDay: (dayIndex: number) => Promise<void>;
}

const PLAN_QUERY_KEY = ["mealplan", "current"] as const;

export function useMealPlan(): UseMealPlan {
  const queryClient = useQueryClient();
  const plansQuery = useQuery({ queryKey: PLAN_QUERY_KEY, queryFn: () => getPlans() });

  const [accepted, setAccepted] = useState<AcceptResult | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  // A discarded draft's id, hidden from `plan` even if it's still the most
  // recent row server-side — keeps discard landing on the "No plan yet" empty
  // state instead of resurfacing an older non-draft plan.
  const [hiddenPlanId, setHiddenPlanId] = useState<number | null>(null);
  // gym/travel/wfh per weekday — applied on the NEXT generate (as overrides).
  const [weekCalendar, setWeekCalendar] = useState<WeekDayCalendarKind[]>(() => Array(7).fill("normal"));
  // Which day the last successful swap touched. Remembered rather than computed
  // in onSuccess: the warning has to read the REFRESHED day, and onSuccess fires
  // before the invalidated query has come back. Deriving it below means the
  // notice appears once the new day actually lands, and updates if it changes.
  const [lastSwappedDay, setLastSwappedDay] = useState<number | null>(null);

  const cycleDay = useCallback((dayIndex: number) => {
    setWeekCalendar((cal) => cal.map((k, i) => {
      if (i !== dayIndex) return k;
      return WEEK_CALENDAR_CYCLE[(WEEK_CALENDAR_CYCLE.indexOf(k) + 1) % WEEK_CALENDAR_CYCLE.length]!;
    }));
  }, []);

  const invalidatePlans = useCallback(
    () => queryClient.invalidateQueries({ queryKey: PLAN_QUERY_KEY }),
    [queryClient],
  );

  // Shared write-error handling: a 401 re-runs the read (whose own 401 flips
  // `phase` to "needsAuth"); anything else surfaces a message the same way
  // the read error does.
  const onWriteError = useCallback((e: unknown, fallback: string) => {
    if (isAuthError(e)) void plansQuery.refetch();
    else setWriteError(msg(e, fallback));
  }, [plansQuery]);

  const generateMutation = useMutation({
    mutationFn: () => generatePlan({ overrides: { weekCalendar } }),
    onMutate: () => setWriteError(null),
    onSuccess: () => { setAccepted(null); setHiddenPlanId(null); setLastSwappedDay(null); return invalidatePlans(); },
    onError: (e) => onWriteError(e, "Couldn't generate a plan."),
  });

  const acceptMutation = useMutation({
    mutationFn: (planId: number) => acceptPlan(planId),
    onMutate: () => setWriteError(null),
    // Clearing on accept is deliberate: the notice exists to be seen BEFORE
    // committing, and its copy ("This swap leaves the day…") reads as stale
    // next to a scheduling confirmation.
    onSuccess: (res) => { setAccepted(res); setLastSwappedDay(null); return invalidatePlans(); },
    onError: (e) => onWriteError(e, "Couldn't accept the plan."),
  });

  const discardMutation = useMutation({
    mutationFn: (planId: number) => discardPlan(planId),
    onMutate: () => setWriteError(null),
    onSuccess: (_res, planId) => { setAccepted(null); setHiddenPlanId(planId); setLastSwappedDay(null); return invalidatePlans(); },
    onError: (e) => onWriteError(e, "Couldn't discard the plan."),
  });

  const swapMutation = useMutation({
    mutationFn: (args: { planId: number; dayIndex: number; slot: MealPlanSlot; dishId: number }) =>
      apiSwapSlot(args.planId, args.dayIndex, args.slot, args.dishId),
    onMutate: () => setWriteError(null),
    onSuccess: (_res, args) => { setLastSwappedDay(args.dayIndex); return invalidatePlans(); },
    onError: (e) => onWriteError(e, "Couldn't swap that dish."),
  });

  const regenDayMutation = useMutation({
    mutationFn: (args: { planId: number; dayIndex: number }) => regenerateDay(args.planId, args.dayIndex),
    onMutate: () => setWriteError(null),
    // Only the regenerated day forgets its swap; a warning about a DIFFERENT
    // day is still true and stays. Functional updater so this reads the current
    // value rather than the one captured when the mutation was created.
    onSuccess: (_res, args) => {
      setLastSwappedDay((d) => (d === args.dayIndex ? null : d));
      return invalidatePlans();
    },
    onError: (e) => onWriteError(e, "Couldn't refresh that day."),
  });

  const rawPlan = plansQuery.data ? pickActivePlan(plansQuery.data.plans) : null;
  const plan = rawPlan && rawPlan.id === hiddenPlanId ? null : rawPlan;
  const phase: Phase = plansQuery.isPending ? "loading" : isAuthError(plansQuery.error) ? "needsAuth" : "ready";
  const readError = plansQuery.isError && !isAuthError(plansQuery.error)
    ? msg(plansQuery.error, "Couldn't load your meal plans.")
    : null;
  const busy = generateMutation.isPending || acceptMutation.isPending || discardMutation.isPending
    || swapMutation.isPending || regenDayMutation.isPending;

  const reload = useCallback(async () => { await plansQuery.refetch(); }, [plansQuery]);

  // mutate() (not mutateAsync()) throughout: callers do `void mp.generate()`
  // etc. with no .catch, so these must never reject — errors are surfaced via
  // `error` above, exactly like the read path.
  const generate = useCallback(() => new Promise<void>((resolve) => {
    generateMutation.mutate(undefined, { onSettled: () => resolve() });
  }), [generateMutation]);

  const accept = useCallback(() => new Promise<void>((resolve) => {
    if (!plan) { resolve(); return; }
    acceptMutation.mutate(plan.id, { onSettled: () => resolve() });
  }), [acceptMutation, plan]);

  const discard = useCallback(() => new Promise<void>((resolve) => {
    if (!plan) { resolve(); return; }
    discardMutation.mutate(plan.id, { onSettled: () => resolve() });
  }), [discardMutation, plan]);

  const swap = useCallback((dayIndex: number, slot: MealPlanSlot, dishId: number) => new Promise<void>((resolve) => {
    if (!plan) { resolve(); return; }
    swapMutation.mutate({ planId: plan.id, dayIndex, slot, dishId }, { onSettled: () => resolve() });
  }), [swapMutation, plan]);

  const regenDay = useCallback((dayIndex: number) => new Promise<void>((resolve) => {
    if (!plan) { resolve(); return; }
    regenDayMutation.mutate({ planId: plan.id, dayIndex }, { onSettled: () => resolve() });
  }), [regenDayMutation, plan]);

  return { plan, phase, busy, error: writeError ?? readError, accepted, macroWarning: planSwapWarning(plan, lastSwappedDay), weekCalendar, cycleDay, reload, generate, accept, discard, swap, regenDay };
}
