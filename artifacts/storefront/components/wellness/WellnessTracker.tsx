"use client";
// Manual nutrition tracker: today's rings vs targets, water quick-add, streaks,
// and today's entries with delete. Session-gated (401 → PhoneAuth). Wearable
// sync is deferred, so there's no consent modal here (food/water only).
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Star, Droplet } from "lucide-react";
import { ApiError } from "@/lib/apiClient";
import { getToday, getWeek, logWater, deleteLog, pctOf, WATER_PRESETS, type NutritionLog } from "@/lib/wellnessApi";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";
import { Button } from "@/components/ui/button";
import { NutritionRing } from "./NutritionRing";
import { LogMealDialog } from "./LogMealDialog";
import { WeekBars } from "./WeekBars";

const SOURCE_LABEL: Record<string, string> = { auto_order: "From an order", manual: "Manual", water: "Water", wearable_adjust: "Activity" };

const isAuthError = (e: unknown) => e instanceof ApiError && e.status === 401;

export function WellnessTracker() {
  const queryClient = useQueryClient();
  const [logOpen, setLogOpen] = useState(false);

  const todayQuery = useQuery({ queryKey: ["wellness", "log"], queryFn: () => getToday() });
  // Best-effort — the 7-day view must never block or break the tracker.
  const weekQuery = useQuery({ queryKey: ["wellness", "week"], queryFn: () => getWeek(), enabled: todayQuery.isSuccess });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["wellness", "log"] });
    void queryClient.invalidateQueries({ queryKey: ["wellness", "week"] });
  };
  const onAuthError = (e: unknown) => { if (isAuthError(e)) void todayQuery.refetch(); };

  const logWaterMutation = useMutation({
    mutationFn: (ml: number) => logWater(ml),
    onSuccess: invalidate,
    onError: (e) => onAuthError(e),
  });
  const deleteLogMutation = useMutation({
    mutationFn: (id: number) => deleteLog(id),
    onSuccess: invalidate,
    onError: (e) => onAuthError(e),
  });

  const busy = logWaterMutation.isPending || deleteLogMutation.isPending;
  const actionError = logWaterMutation.error ?? deleteLogMutation.error;

  if (isAuthError(todayQuery.error)) return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-muted">Sign in to track your daily nutrition, water and streaks.</p>
      <PhoneAuth startExpanded onVerified={() => void todayQuery.refetch()} />
    </div>
  );

  if (todayQuery.isPending) return <WellnessTrackerSkeleton />;

  if (todayQuery.isError) {
    return (
      <div className="rounded-2xl border border-line bg-surface px-6 py-10 text-center">
        <p className="text-sm font-semibold text-[var(--danger)]">Couldn&rsquo;t load your tracker</p>
        <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-ink-faint">Something went wrong on our end — this usually clears up on retry.</p>
        <button type="button" onClick={() => void todayQuery.refetch()} className="mt-4 rounded-lg border border-line px-5 py-2 text-xs font-semibold text-gold-text transition-opacity hover:opacity-80">Try again</button>
      </div>
    );
  }

  const { totals, targets, streaks, logs } = todayQuery.data;
  const week = weekQuery.data ?? null;
  return (
    <div className="flex flex-col gap-12">
      {actionError && (
        <p role="alert" className="text-xs font-medium text-[var(--danger)]">
          {actionError instanceof ApiError ? actionError.message : "Something went wrong. Please try again."}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <NutritionRing label="Calories" value={totals.calories} target={targets.effectiveCalorieTarget} unit="kcal" done={pctOf(totals.calories, targets.effectiveCalorieTarget)} />
        <NutritionRing label="Protein" value={totals.proteinGrams} target={targets.proteinTargetGrams} unit="g" done={pctOf(totals.proteinGrams, targets.proteinTargetGrams)} />
        <NutritionRing label="Fibre" value={totals.fiberGrams} target={targets.fiberTargetGrams} unit="g" done={pctOf(totals.fiberGrams, targets.fiberTargetGrams)} />
        <NutritionRing label="Water" value={totals.waterMl} target={targets.waterTargetMl} unit="ml" done={pctOf(totals.waterMl, targets.waterTargetMl)} />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex shrink-0 gap-2">
          {WATER_PRESETS.map((ml) => (
            <button key={ml} type="button" onClick={() => logWaterMutation.mutate(ml)} disabled={busy} className="tabular rounded-full border border-line px-4 py-2 text-xs text-ink-muted transition-colors hover:bg-surface hover:brightness-110 disabled:opacity-50">+{ml} ml</button>
          ))}
        </div>
        <Button type="button" onClick={() => setLogOpen(true)} shape="pill" size="fluid" className="flex shrink-0 items-center gap-2 px-6 py-3 font-semibold hover:brightness-110">
          <Plus aria-hidden className="h-4 w-4" />
          Log meal
        </Button>
      </div>

      {(streaks.protein || streaks.veg) && (
        <div className="flex flex-wrap gap-2">
          {streaks.protein && (
            <span className="tabular inline-flex items-center gap-2 rounded-full border border-sage/20 bg-sage-soft px-4 py-2 text-xs text-sage-text">
              <Star aria-hidden className="h-3.5 w-3.5" />
              Protein streak {streaks.protein.currentDays}d · best {streaks.protein.bestDays}d
            </span>
          )}
          {streaks.veg && (
            <span className="tabular inline-flex items-center gap-2 rounded-full border border-sage/20 bg-sage-soft px-4 py-2 text-xs text-sage-text">
              <Droplet aria-hidden className="h-3.5 w-3.5" />
              Veg streak {streaks.veg.currentDays}d · best {streaks.veg.bestDays}d
            </span>
          )}
        </div>
      )}

      <div>
        <h2 className="text-xl font-medium text-ink">Today&rsquo;s entries</h2>
        {logs.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">Nothing logged yet today. Order a meal or add one manually.</p>
        ) : (
          <ul className="mt-6 flex flex-col gap-3">
            {logs.map((l) => <Entry key={l.id} log={l} onRemove={() => deleteLogMutation.mutate(l.id)} busy={busy} />)}
          </ul>
        )}
      </div>

      {week && <WeekBars week={week} />}

      <p className="text-center text-[11px] leading-relaxed text-ink-faint opacity-70">
        Tanmatra is not a medical service — this tracker is for your own awareness, not diagnosis
        or treatment. Consult a healthcare professional before making significant dietary changes.
      </p>

      {logOpen && <LogMealDialog onClose={() => setLogOpen(false)} onLogged={invalidate} />}
    </div>
  );
}

function WellnessTrackerSkeleton() {
  return (
    <div className="flex flex-col gap-12">
      <p className="sr-only">Loading your tracker…</p>
      <div aria-hidden className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="aspect-square animate-pulse rounded-2xl bg-surface-raised" />
        ))}
      </div>
      <div aria-hidden className="h-11 animate-pulse rounded-full bg-surface-raised" />
      <div aria-hidden className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface-raised" />
        ))}
      </div>
    </div>
  );
}

function Entry({ log, onRemove, busy }: { log: NutritionLog; onRemove: () => void; busy: boolean }) {
  // route-10 shows the full macro split; every field here is server-returned.
  const meta =
    log.source === "water"
      ? `${log.waterMl} ml`
      : `${log.calories} kcal · ${log.proteinGrams}P · ${log.carbsGrams}C · ${log.fatGrams}F`;
  return (
    <li className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface-raised p-4">
      <div className="min-w-0">
        <p className="truncate text-base text-ink">{log.label}</p>
        <p className="tabular mt-0.5 text-xs text-ink-muted">
          {SOURCE_LABEL[log.source] ?? "Manual"} · {meta}
        </p>
      </div>
      <button type="button" onClick={onRemove} disabled={busy} aria-label="Delete entry" className="shrink-0 text-xs text-ink-faint hover:text-[var(--danger)] disabled:opacity-50">Delete</button>
    </li>
  );
}
