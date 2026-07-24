"use client";
// Planner settings: weekly budget (₹→paise), max repetitions per dish, and
// auto-replan. Loads on open; saves via PUT /meal-plan-settings.
import { useEffect, useState } from "react";
import { Dialog } from "radix-ui";
import { getSettings, updateSettings } from "@/lib/mealPlanApi";

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const [budget, setBudget] = useState("");
  const [maxReps, setMaxReps] = useState("2");
  const [autoReplan, setAutoReplan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSettings().then(({ settings }) => {
      setBudget(settings.weeklyBudgetPaise != null ? String(Math.round(settings.weeklyBudgetPaise / 100)) : "");
      setMaxReps(String(settings.maxRepetitionsPerDish));
      setAutoReplan(settings.autoReplanEnabled);
    }).catch(() => {});
  }, []);

  async function save() {
    const rupees = budget.trim();
    if (rupees !== "" && (!Number.isFinite(Number(rupees)) || Number(rupees) < 0)) { setError("Enter a valid budget."); return; }
    setBusy(true); setError(null);
    try {
      await updateSettings({
        weeklyBudgetPaise: rupees === "" ? null : Math.round(Number(rupees) * 100),
        maxRepetitionsPerDish: Math.max(1, Math.min(7, Number(maxReps) || 2)),
        autoReplanEnabled: autoReplan,
      });
      onClose();
    } catch { setError("Couldn't save settings."); setBusy(false); }
  }

  const input = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-[var(--gold)]";
  return (
    <Dialog.Root open onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[var(--ink)]/40 backdrop-blur-sm" />
        <Dialog.Content aria-describedby={undefined} className="fixed left-1/2 top-24 z-50 w-[92vw] max-w-sm -translate-x-1/2 rounded-xl border border-line bg-surface p-5 shadow-lg">
          <Dialog.Title className="text-sm font-semibold text-ink">Meal planner settings</Dialog.Title>
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
            {error && <p role="alert" className="text-xs font-medium text-[var(--danger)]">{error}</p>}
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <Dialog.Close className="rounded-lg px-4 py-2 text-sm font-medium text-ink-muted hover:text-ink">Cancel</Dialog.Close>
            <button type="button" onClick={save} disabled={busy} className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-[var(--gold-ink)] disabled:opacity-60">{busy ? "Saving…" : "Save"}</button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
