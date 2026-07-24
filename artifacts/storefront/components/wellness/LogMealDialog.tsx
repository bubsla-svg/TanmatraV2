"use client";
// Manual food-log sheet: a label + the macro numbers. The label is required so
// the entry is recognisable later; everything else defaults to 0 server-side.
import { useState } from "react";
import { Dialog } from "radix-ui";
import { ApiError } from "@/lib/apiClient";
import { logMeal, type ManualLogInput } from "@/lib/wellnessApi";

const FIELDS: { key: keyof Omit<ManualLogInput, "label">; label: string }[] = [
  { key: "calories", label: "kcal" },
  { key: "proteinGrams", label: "Protein g" },
  { key: "fiberGrams", label: "Fibre g" },
  { key: "carbsGrams", label: "Carbs g" },
  { key: "fatGrams", label: "Fat g" },
  { key: "vegServings", label: "Veg servings" },
];

export function LogMealDialog({ onClose, onLogged }: { onClose: () => void; onLogged: () => void }) {
  const [label, setLabel] = useState("");
  const [nums, setNums] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (label.trim() === "") { setError("Add a label so you remember what this was."); return; }
    setBusy(true); setError(null);
    const input: ManualLogInput = { label: label.trim() };
    for (const f of FIELDS) { const v = Number(nums[f.key]); if (Number.isFinite(v) && v > 0) input[f.key] = Math.round(v); }
    try { await logMeal(input); onLogged(); onClose(); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Couldn't save that log."); setBusy(false); }
  }

  const cls = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-[var(--gold)]";
  return (
    <Dialog.Root open onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[var(--ink)]/40 backdrop-blur-sm" />
        <Dialog.Content aria-describedby={undefined} className="fixed bottom-0 left-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 rounded-t-2xl border border-line bg-surface p-5 shadow-lg sm:bottom-auto sm:top-24 sm:rounded-2xl">
          <Dialog.Title className="text-sm font-semibold text-ink">Log a meal or snack</Dialog.Title>
          <label className="mt-4 block text-sm text-ink-muted">What was it?
            <input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Greek yoghurt with berries" className={`mt-1 ${cls}`} />
          </label>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {FIELDS.map((f) => (
              <label key={f.key} className="text-[11px] text-ink-muted">{f.label}
                <input type="number" min="0" inputMode="numeric" value={nums[f.key] ?? ""} onChange={(e) => setNums((n) => ({ ...n, [f.key]: e.target.value }))} className={`mt-1 ${cls}`} />
              </label>
            ))}
          </div>
          {error && <p role="alert" className="mt-2 text-xs font-medium text-[var(--danger)]">{error}</p>}
          <div className="mt-5 flex justify-end gap-3">
            <Dialog.Close className="rounded-lg px-4 py-2 text-sm font-medium text-ink-muted hover:text-ink">Cancel</Dialog.Close>
            <button type="button" onClick={save} disabled={busy} className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-[var(--gold-ink)] disabled:opacity-60">{busy ? "Saving…" : "Save log"}</button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
