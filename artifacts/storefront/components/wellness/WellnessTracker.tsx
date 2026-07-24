"use client";
// Manual nutrition tracker: today's rings vs targets, water quick-add, streaks,
// and today's entries with delete. Session-gated (401 → PhoneAuth). Wearable
// sync is deferred, so there's no consent modal here (food/water only).
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/apiClient";
import { getToday, logWater, deleteLog, pctOf, WATER_PRESETS, type WellnessToday, type NutritionLog } from "@/lib/wellnessApi";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";
import { NutritionRing } from "./NutritionRing";
import { LogMealDialog } from "./LogMealDialog";

const SOURCE_LABEL: Record<string, string> = { auto_order: "From an order", manual: "Manual", water: "Water", wearable_adjust: "Activity" };

export function WellnessTracker() {
  const [today, setToday] = useState<WellnessToday | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try { setToday(await getToday()); setNeedsAuth(false); }
    catch (e) { if (e instanceof ApiError && e.status === 401) setNeedsAuth(true); else setError("Couldn't load your tracker."); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const act = useCallback(async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); await load(); }
    catch (e) { if (e instanceof ApiError && e.status === 401) setNeedsAuth(true); }
    finally { setBusy(false); }
  }, [load]);

  if (needsAuth) return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-muted">Sign in to track your daily nutrition, water and streaks.</p>
      <PhoneAuth onVerified={() => void load()} />
    </div>
  );
  if (!today) return <p className="text-sm text-ink-muted">{error ?? "Loading your tracker…"}</p>;

  const { totals, targets, streaks, logs } = today;
  return (
    <div className="flex flex-col gap-6">
      {error && <p role="alert" className="text-xs font-medium text-[var(--danger)]">{error}</p>}

      <div className="grid grid-cols-4 gap-2 rounded-2xl border border-line bg-surface p-4">
        <NutritionRing label="Calories" value={totals.calories} target={targets.effectiveCalorieTarget} unit="" done={pctOf(totals.calories, targets.effectiveCalorieTarget)} />
        <NutritionRing label="Protein" value={totals.proteinGrams} target={targets.proteinTargetGrams} unit="g" done={pctOf(totals.proteinGrams, targets.proteinTargetGrams)} />
        <NutritionRing label="Fibre" value={totals.fiberGrams} target={targets.fiberTargetGrams} unit="g" done={pctOf(totals.fiberGrams, targets.fiberTargetGrams)} />
        <NutritionRing label="Water" value={totals.waterMl} target={targets.waterTargetMl} unit="ml" done={pctOf(totals.waterMl, targets.waterTargetMl)} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink-muted">Add water</span>
        {WATER_PRESETS.map((ml) => (
          <button key={ml} type="button" onClick={() => void act(() => logWater(ml))} disabled={busy} className="rounded-full border border-line px-3 py-1 text-xs font-medium text-ink-muted hover:border-[var(--gold)] hover:text-ink disabled:opacity-50">+{ml} ml</button>
        ))}
        <button type="button" onClick={() => setLogOpen(true)} className="ml-auto rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-[var(--gold-ink)]">+ Log meal</button>
      </div>

      {(streaks.protein || streaks.veg) && (
        <div className="flex flex-wrap gap-2">
          {streaks.protein && <span className="tabular rounded-full bg-sage-soft px-3 py-1 text-xs font-medium text-sage-text">Protein streak {streaks.protein.currentDays}d · best {streaks.protein.bestDays}d</span>}
          {streaks.veg && <span className="tabular rounded-full bg-sage-soft px-3 py-1 text-xs font-medium text-sage-text">Veg streak {streaks.veg.currentDays}d · best {streaks.veg.bestDays}d</span>}
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-ink">Today&rsquo;s entries</h2>
        {logs.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">Nothing logged yet today. Order a meal or add one manually.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {logs.map((l) => <Entry key={l.id} log={l} onRemove={() => void act(() => deleteLog(l.id))} busy={busy} />)}
          </ul>
        )}
      </div>

      <p className="text-[11px] text-ink-faint">Tanmatra is not a medical service — this tracker is for your own awareness, not diagnosis or treatment.</p>

      {logOpen && <LogMealDialog onClose={() => setLogOpen(false)} onLogged={() => void load()} />}
    </div>
  );
}

function Entry({ log, onRemove, busy }: { log: NutritionLog; onRemove: () => void; busy: boolean }) {
  const meta = log.source === "water" ? `${log.waterMl} ml` : `${log.calories} kcal · P${log.proteinGrams}g · F${log.fiberGrams}g`;
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink">{log.label}</p>
        <p className="tabular text-[11px] text-ink-faint">{SOURCE_LABEL[log.source] ?? "Manual"} · {meta}</p>
      </div>
      <button type="button" onClick={onRemove} disabled={busy} aria-label="Delete entry" className="shrink-0 text-xs text-ink-faint hover:text-[var(--danger)] disabled:opacity-50">Delete</button>
    </li>
  );
}
