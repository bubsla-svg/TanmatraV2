"use client";
// Clinical-profile editor (the subset /account/preferences deliberately leaves
// out). Server encrypts the conditions array at rest; we re-seed from its
// decrypted response. Inputs are disabled until health-data consent is granted.
import { useState } from "react";
import { Grid } from "@astryxdesign/core/Grid";
import { CheckboxList, CheckboxListItem } from "@astryxdesign/core/CheckboxList";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { NumberInput } from "@astryxdesign/core/NumberInput";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/apiClient";
import { saveClinical, MEDICAL_CONDITION_OPTIONS, MEDICAL_CONDITION_LABEL, type UserPreferences } from "@/lib/preferencesApi";

/* Stage-4 Astryx adoption: field chrome only. The hand-rolled condition
 * checkbox grid became CheckboxList/CheckboxListItem (collection mode:
 * value/onChange carry the same string[] the payload sends), the three
 * numeric fields became NumberInput with units + hasClear — clearing calls
 * onChange(null), so state moved from string to number|null and the old
 * numOrNull("" -> null) coercion is now the component's contract; the
 * saveClinical payload shape (number|null per field) is unchanged. The PCOS
 * toggle became a single CheckboxInput (a checkbox, not a Switch — there is
 * an explicit Save). Deliberately kept hand-rolled: the consent-gating
 * <fieldset disabled> wrapper (native disabled cascades to Astryx's native
 * inputs inside), the role="alert" error line and the "Saved." status line
 * (Astryx status messages carry no documented role), and the app Button —
 * gold stays the only action colour. saveClinical call, busy/error/saved
 * state and the onSaved re-seed are untouched. */
export function ClinicalForm({ prefs, disabled, onSaved }: {
  prefs: UserPreferences;
  disabled: boolean;
  onSaved: (p: UserPreferences) => void;
}) {
  const [conditions, setConditions] = useState<string[]>(prefs.medicalConditions);
  const [hba1c, setHba1c] = useState<number | null>(prefs.hba1cPct ?? null);
  const [pcos, setPcos] = useState(prefs.pcosHistory ?? false);
  const [height, setHeight] = useState<number | null>(prefs.heightCm ?? null);
  const [weight, setWeight] = useState<number | null>(prefs.weightKg ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true); setError(null); setSaved(false);
    try {
      const { preferences } = await saveClinical({
        medicalConditions: conditions,
        hba1cPct: hba1c,
        pcosHistory: pcos,
        heightCm: height,
        weightKg: weight,
      });
      onSaved(preferences); setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save your health details.");
    } finally { setBusy(false); }
  }

  return (
    <fieldset disabled={disabled} className="flex flex-col gap-5">
      <CheckboxList label="Medical conditions" value={conditions} onChange={setConditions} isDisabled={disabled}>
        {MEDICAL_CONDITION_OPTIONS.map((c) => (
          <CheckboxListItem key={c} value={c} label={MEDICAL_CONDITION_LABEL[c]} />
        ))}
      </CheckboxList>
      <Grid gap={4} columns={{ minWidth: 260 }}>
        <NumberInput
          label="HbA1c"
          value={hba1c}
          onChange={setHba1c}
          hasClear
          units="%"
          min={0}
          max={30}
          step={0.1}
          isDisabled={disabled}
        />
        <CheckboxInput
          label="PCOS history"
          value={pcos}
          onChange={(checked) => setPcos(checked)}
          isDisabled={disabled}
        />
        <NumberInput
          label="Height"
          value={height}
          onChange={setHeight}
          hasClear
          units="cm"
          min={50}
          max={300}
          isDisabled={disabled}
        />
        <NumberInput
          label="Weight"
          value={weight}
          onChange={setWeight}
          hasClear
          units="kg"
          min={10}
          max={500}
          isDisabled={disabled}
        />
      </Grid>
      {error && <p role="alert" className="text-xs font-medium text-[var(--danger)]">{error}</p>}
      {saved && <p className="text-xs font-medium text-sage-text">Saved.</p>}
      <Button type="button" onClick={save} disabled={busy} aria-busy={busy} aria-live="polite" shape="xl" size="fluid" className="self-start px-5 py-2.5 font-semibold disabled:opacity-60">
        {busy ? "Saving…" : "Save health details"}
      </Button>
    </fieldset>
  );
}
