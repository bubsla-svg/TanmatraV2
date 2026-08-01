"use client";
// Planner settings: weekly budget (₹→paise), max repetitions per dish, and
// auto-replan. Loads on open; saves via PUT /meal-plan-settings.
// Only rendered from /meal-planner (a Stitch dark route, lib/stitchRoutes.ts).
// Radix portals the panel to document.body, but data-stitch lives on <html>
// (a DOM ancestor of body), so color-scheme inherits through the portal with
// no scope attribute needed here.
import { useEffect, useState } from "react";
import { Dialog } from "radix-ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { getSettings, updateSettings, type MealPlanSettings } from "@/lib/mealPlanApi";
import { useOverlayHistory } from "@/components/ui/useOverlayHistory";

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  // Mounted only while "open" (see MealPlanner.tsx) — the back gesture closes
  // this dialog instead of leaving /meal-planner.
  useOverlayHistory(true, onClose);

  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: ["mealplan", "settings"], queryFn: () => getSettings() });

  const [budget, setBudget] = useState("");
  const [maxReps, setMaxReps] = useState("2");
  const [autoReplan, setAutoReplan] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    const settings = settingsQuery.data?.settings;
    if (!settings) return;
    setBudget(settings.weeklyBudgetPaise != null ? String(Math.round(settings.weeklyBudgetPaise / 100)) : "");
    setMaxReps(String(settings.maxRepetitionsPerDish));
    setAutoReplan(settings.autoReplanEnabled);
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (patch: Partial<MealPlanSettings>) => updateSettings(patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mealplan", "settings"] });
      onClose();
    },
  });

  function save() {
    const rupees = budget.trim();
    if (rupees !== "" && (!Number.isFinite(Number(rupees)) || Number(rupees) < 0)) { setValidationError("Enter a valid budget."); return; }
    setValidationError(null);
    saveMutation.mutate({
      weeklyBudgetPaise: rupees === "" ? null : Math.round(Number(rupees) * 100),
      maxRepetitionsPerDish: Math.max(1, Math.min(7, Number(maxReps) || 2)),
      autoReplanEnabled: autoReplan,
    });
  }

  const busy = saveMutation.isPending;
  const errorText = validationError ?? (saveMutation.isError ? "Couldn't save settings." : null);

  const input = "w-full rounded-2xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-[var(--gold)]";
  return (
    <Dialog.Root open onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        {/* Scrim: --scrim, never data-stitch — see the invariant on
            components/ui/drawer.tsx's DrawerOverlay. */}
        <Dialog.Overlay className="fixed inset-0 z-[var(--z-modal)] animate-fade-in bg-[var(--scrim)] backdrop-blur-sm" />
        <Dialog.Content aria-describedby={undefined} className="fixed left-1/2 top-24 z-[var(--z-modal)] w-[92vw] max-w-sm -translate-x-1/2 animate-dialog-in rounded-3xl border border-line bg-surface p-5 shadow-lg">
          <Dialog.Title className="text-sm font-semibold text-ink">Meal planner settings</Dialog.Title>
          {settingsQuery.isError && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3 py-2">
              <p className="text-xs font-medium text-[var(--danger)]">Couldn&rsquo;t load your current settings.</p>
              <button type="button" onClick={() => void settingsQuery.refetch()} className="shrink-0 text-xs font-semibold text-gold-text hover:opacity-80">Try again</button>
            </div>
          )}
          <div className="mt-4 flex flex-col gap-4">
            <label className="flex items-center justify-between gap-3 text-sm text-ink-muted">
              Auto-replan weekly
              <input type="checkbox" role="switch" checked={autoReplan} onChange={(e) => setAutoReplan(e.target.checked)} className="accent-[var(--gold)]" />
            </label>
            <label className="text-sm text-ink-muted">Weekly budget (₹)
              <input type="number" min="0" inputMode="numeric" placeholder="No limit" value={budget} onChange={(e) => setBudget(e.target.value)} className={`mt-1 ${input}`} />
            </label>
            <label className="text-sm text-ink-muted">Max repetitions per dish (per week)
              <input type="number" min="1" max="7" value={maxReps} onChange={(e) => setMaxReps(e.target.value)} className={`mt-1 ${input}`} />
            </label>
            {errorText && <p role="alert" className="text-xs font-medium text-[var(--danger)]">{errorText}</p>}
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <Dialog.Close className="rounded-full px-4 py-2 text-sm font-medium text-ink-muted hover:text-ink">Cancel</Dialog.Close>
            <Button type="button" onClick={save} disabled={busy} shape="pill" size="fluid" className="px-4 py-2 font-semibold disabled:opacity-60">{busy ? "Saving…" : "Save"}</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
