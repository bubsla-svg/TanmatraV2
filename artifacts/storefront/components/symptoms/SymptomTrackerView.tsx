"use client";
// Client: interactive physiological symptom logger correlating post-meal reactions against macro intake.
import { useCallback, useState, useEffect } from "react";
import { ApiError } from "@/lib/apiClient";
import { getMySymptomLogs, recordSymptomLog, type SymptomLogEntry } from "@/lib/ecosystemApi";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";

export function SymptomTrackerView() {
  const [logs, setLogs] = useState<SymptomLogEntry[] | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [symptom, setSymptom] = useState("bloating");
  const [severity, setSeverity] = useState(2);
  const [notes, setNotes] = useState("");
  const [dishSlug, setDishSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await getMySymptomLogs();
      setLogs(res);
      setNeedsAuth(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setNeedsAuth(true);
      else setLoadError(e instanceof ApiError ? e.message : "Couldn't load your symptom history.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const entry = await recordSymptomLog({
        loggedDate: new Date().toISOString().slice(0, 10),
        symptomType: symptom,
        severity,
        notes,
        ...(dishSlug.trim() ? { relatedDishSlug: dishSlug.trim() } : {}),
      });
      setLogs((p) => [entry, ...(p ?? [])]);
      setNotes("");
      setDishSlug("");
      setMsg("Physiological response logged successfully to clinical record.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setNeedsAuth(true);
      else setMsg("Couldn't save this entry. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (needsAuth) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">Sign in to log and view your symptom history.</p>
        <PhoneAuth onVerified={() => void load()} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
      <form onSubmit={handleSubmit} className="lg:col-span-5 flex flex-col gap-5 rounded-2xl border border-line bg-surface p-6 h-fit">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-gold-text">Physiological Telemetry</span>
          <h3 className="text-lg font-semibold text-ink mt-1">Log Post-Meal Symptom</h3>
          <p className="text-xs text-ink-muted mt-1 leading-relaxed">
            Record GI comfort, blood sugar stability, or satiety responses to inform your dietitian prescriptions.
          </p>
        </div>

        {msg && <div className="rounded-xl border border-gold/20 bg-gold/5 p-3 text-xs font-semibold text-gold-text">{msg}</div>}

        <div className="flex flex-col gap-1.5 text-xs">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Symptom Classification</label>
          <select
            value={symptom}
            onChange={(e) => setSymptom(e.target.value)}
            className="rounded-xl border border-line bg-surface p-2.5 font-medium text-ink focus:border-gold outline-none"
          >
            <option value="bloating">Post-Meal Bloating &amp; Gas</option>
            <option value="glucose_spike">Afternoon Lethargy / Glucose Dip</option>
            <option value="high_energy">Optimal Sustained Energy</option>
            <option value="satiety_low">Early Hunger / Low Satiety</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Reaction Severity</span>
            <span className="tabular text-sm font-semibold text-ink">{severity} / 5</span>
          </div>
          <input
            type="range"
            min={1}
            max={5}
            value={severity}
            onChange={(e) => setSeverity(Number(e.target.value))}
            className="w-full accent-gold cursor-pointer"
          />
          <div className="flex justify-between px-0.5 text-[9px] font-semibold uppercase tracking-wider text-ink-faint">
            <span>Mild</span>
            <span>Severe</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 text-xs">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Related Dish or Meal (Optional)</label>
          <input
            type="text"
            value={dishSlug}
            onChange={(e) => setDishSlug(e.target.value)}
            placeholder="e.g. hp-paneer-bowl"
            className="rounded-xl border border-line bg-surface p-2.5 font-medium text-ink focus:border-gold outline-none"
          />
        </div>

        <div className="flex flex-col gap-1.5 text-xs">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Clinical Annotations</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="e.g. Experienced slight heaviness 45 mins after eating…"
            className="rounded-xl border border-line bg-surface p-2.5 font-medium text-ink focus:border-gold outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-gold py-3 text-xs font-semibold text-[var(--gold-ink)] hover:bg-gold/90 transition-colors mt-2"
        >
          {busy ? "Recording Telemetry…" : "Record Symptom Log →"}
        </button>
      </form>

      <div className="lg:col-span-7 flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gold-text">Recorded Symptom History</h2>
        {logs === null ? (
          <div className="rounded-2xl border border-line bg-surface p-8 text-center text-xs text-ink-muted">
            {loadError ?? "Loading your symptom history…"}
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface p-8 text-center text-xs text-ink-muted">
            No physiological symptom observations recorded in this billing cycle yet.
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            {logs.map((l) => (
              <div key={l.id} className="rounded-2xl border border-line bg-surface p-5 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-sage-soft px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-sage-text">
                    {l.symptomType.replace("_", " ")}
                  </span>
                  <span className="text-xs font-medium text-ink-muted">{l.loggedDate}</span>
                </div>
                <div className="text-xs font-medium text-ink-muted">
                  Severity: <strong className="tabular text-sm font-bold text-gold-text">{l.severity} / 5</strong>
                  {l.relatedDishSlug && (
                    <>
                      {" "}&bull; Correlated with: <span className="font-mono text-ink">{l.relatedDishSlug}</span>
                    </>
                  )}
                </div>
                {l.notes && <p className="text-xs text-ink-muted italic border-t border-line pt-2.5 mt-0.5">&ldquo;{l.notes}&rdquo;</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
