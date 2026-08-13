"use client";
// Clinical-profile editor (the subset /account/preferences deliberately leaves
// out). Server encrypts the conditions array at rest; we re-seed from its
// decrypted response. Inputs are disabled until health-data consent is granted.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/apiClient";
import { saveClinical, MEDICAL_CONDITION_OPTIONS, MEDICAL_CONDITION_LABEL, type UserPreferences } from "@/lib/preferencesApi";

const numOrNull = (s: string): number | null => (s.trim() === "" ? null : Number(s));

export function ClinicalForm({ prefs, disabled, onSaved }: {
  prefs: UserPreferences;
  disabled: boolean;
  onSaved: (p: UserPreferences) => void;
}) {
  const [conditions, setConditions] = useState<string[]>(prefs.medicalConditions);
  const [hba1c, setHba1c] = useState(prefs.hba1cPct?.toString() ?? "");
  const [pcos, setPcos] = useState(prefs.pcosHistory ?? false);
  const [height, setHeight] = useState(prefs.heightCm?.toString() ?? "");
  const [weight, setWeight] = useState(prefs.weightKg?.toString() ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const toggle = (c: string) =>
    setConditions((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));

  async function save() {
    setBusy(true); setError(null); setSaved(false);
    try {
      const { preferences } = await saveClinical({
        medicalConditions: conditions,
        hba1cPct: numOrNull(hba1c),
        pcosHistory: pcos,
        heightCm: numOrNull(height),
        weightKg: numOrNull(weight),
      });
      onSaved(preferences); setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save your health details.");
    } finally { setBusy(false); }
  }

  const input = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus-visible:border-[var(--gold)] disabled:opacity-50";
  return (
    <fieldset disabled={disabled} className="flex flex-col gap-5">
      <div>
        <p className="text-sm font-medium text-ink">Medical conditions</p>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {MEDICAL_CONDITION_OPTIONS.map((c) => (
            <label key={c} className="flex items-center gap-2 text-sm text-ink-muted">
              <input type="checkbox" checked={conditions.includes(c)} onChange={() => toggle(c)} className="accent-[var(--gold)]" />
              {MEDICAL_CONDITION_LABEL[c]}
            </label>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm text-ink-muted">HbA1c %<input type="number" step="0.1" min="0" max="30" value={hba1c} onChange={(e) => setHba1c(e.target.value)} className={`mt-1 ${input}`} /></label>
        <label className="flex items-end gap-2 pb-2 text-sm text-ink-muted"><input type="checkbox" checked={pcos} onChange={(e) => setPcos(e.target.checked)} className="accent-[var(--gold)]" />PCOS history</label>
        <label className="text-sm text-ink-muted">Height (cm)<input type="number" min="50" max="300" value={height} onChange={(e) => setHeight(e.target.value)} className={`mt-1 ${input}`} /></label>
        <label className="text-sm text-ink-muted">Weight (kg)<input type="number" min="10" max="500" value={weight} onChange={(e) => setWeight(e.target.value)} className={`mt-1 ${input}`} /></label>
      </div>
      {error && <p role="alert" className="text-xs font-medium text-[var(--danger)]">{error}</p>}
      {saved && <p className="text-xs font-medium text-sage-text">Saved.</p>}
      <Button type="button" onClick={save} disabled={busy} shape="xl" size="fluid" className="self-start px-5 py-2.5 font-semibold disabled:opacity-60">
        {busy ? "Saving…" : "Save health details"}
      </Button>
    </fieldset>
  );
}
