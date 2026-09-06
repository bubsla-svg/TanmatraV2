"use client";
// Client: interactive physiological symptom logger correlating post-meal reactions against macro intake.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/apiClient";
import { getMySymptomLogs, recordSymptomLog } from "@/lib/ecosystemApi";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";
import { Button } from "@/components/ui/button";

const isAuthError = (e: unknown) => e instanceof ApiError && e.status === 401;

export function SymptomTrackerView() {
  const queryClient = useQueryClient();
  const logsQuery = useQuery({ queryKey: ["wellness", "symptoms"], queryFn: () => getMySymptomLogs() });

  const [symptom, setSymptom] = useState("bloating");
  const [severity, setSeverity] = useState(2);
  const [notes, setNotes] = useState("");
  const [dishSlug, setDishSlug] = useState("");

  const recordMutation = useMutation({
    mutationFn: (input: Parameters<typeof recordSymptomLog>[0]) => recordSymptomLog(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["wellness", "symptoms"] });
      setNotes("");
      setDishSlug("");
    },
    onError: (e) => { if (isAuthError(e)) void logsQuery.refetch(); },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (recordMutation.isPending) return;
    recordMutation.mutate({
      loggedDate: new Date().toISOString().slice(0, 10),
      symptomType: symptom,
      severity,
      notes,
      ...(dishSlug.trim() ? { relatedDishSlug: dishSlug.trim() } : {}),
    });
  }

  if (isAuthError(logsQuery.error)) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">Sign in to log and view your symptom history.</p>
        <PhoneAuth startExpanded onVerified={() => void logsQuery.refetch()} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
      <form onSubmit={handleSubmit} className="lg:col-span-5 flex flex-col gap-5 rounded-2xl border border-line bg-surface p-6 h-fit">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-[.18em] text-accent">Physiological Telemetry</span>
          <h3 className="mt-1 font-display text-lg font-semibold leading-tight text-primary">Log Post-Meal Symptom</h3>
          <p className="text-xs text-ink-muted mt-1 leading-relaxed">
            Record GI comfort, blood sugar stability, or satiety responses so we can tune what we send you.
          </p>
        </div>

        {recordMutation.isSuccess && (
          <div className="rounded-2xl bg-sage-soft p-3 text-xs font-semibold text-sage-text">
            Physiological response logged successfully to clinical record.
          </div>
        )}
        {recordMutation.isError && (
          <div role="alert" className="rounded-2xl bg-secondary p-3 text-xs font-semibold text-[var(--danger)]">
            Couldn&rsquo;t save this entry. Please try again.
          </div>
        )}

        <div className="flex flex-col gap-1.5 text-xs">
          <label className="text-[10px] font-bold uppercase tracking-[.16em] text-ink-muted">Symptom Classification</label>
          <select
            value={symptom}
            onChange={(e) => setSymptom(e.target.value)}
            className="min-h-[50px] rounded-2xl border border-line bg-surface px-4 py-3 font-medium text-ink placeholder:text-ink-faint focus-visible:border-primary outline-none"
          >
            <option value="bloating">Post-Meal Bloating &amp; Gas</option>
            <option value="glucose_spike">Afternoon Lethargy / Glucose Dip</option>
            <option value="high_energy">Optimal Sustained Energy</option>
            <option value="satiety_low">Early Hunger / Low Satiety</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-[.16em] text-ink-muted">Reaction Severity</span>
            <span className="font-data text-sm font-semibold text-ink">{severity} / 5</span>
          </div>
          <input
            type="range"
            min={1}
            max={5}
            value={severity}
            onChange={(e) => setSeverity(Number(e.target.value))}
            className="w-full accent-gold cursor-pointer"
          />
          <div className="flex justify-between px-0.5 text-[10px] font-bold uppercase tracking-[.16em] text-ink-faint">
            <span>Mild</span>
            <span>Severe</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 text-xs">
          <label className="text-[10px] font-bold uppercase tracking-[.16em] text-ink-muted">Related Dish or Meal (Optional)</label>
          <input
            type="text"
            value={dishSlug}
            onChange={(e) => setDishSlug(e.target.value)}
            placeholder="e.g. hp-paneer-bowl"
            className="min-h-[50px] rounded-2xl border border-line bg-surface px-4 py-3 font-medium text-ink placeholder:text-ink-faint focus-visible:border-primary outline-none"
          />
        </div>

        <div className="flex flex-col gap-1.5 text-xs">
          <label className="text-[10px] font-bold uppercase tracking-[.16em] text-ink-muted">Clinical Annotations</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="e.g. Experienced slight heaviness 45 mins after eating…"
            className="min-h-[50px] rounded-2xl border border-line bg-surface px-4 py-3 font-medium text-ink placeholder:text-ink-faint focus-visible:border-primary outline-none"
          />
        </div>

        <Button
          type="submit"
          disabled={recordMutation.isPending}
          aria-busy={recordMutation.isPending}
          aria-live="polite"
          shape="pill"
          size="fluid"
          className="min-h-12 py-3 text-xs font-semibold mt-2"
        >
          {recordMutation.isPending ? "Recording Telemetry…" : "Record Symptom Log →"}
        </Button>
      </form>

      <div className="lg:col-span-7 flex flex-col gap-4">
        <h2 className="text-[10px] font-bold uppercase tracking-[.16em] text-ink-muted">Recorded Symptom History</h2>
        {logsQuery.isPending ? (
          <SymptomHistorySkeleton />
        ) : logsQuery.isError ? (
          <div className="rounded-2xl border border-line bg-surface p-8 text-center flex flex-col gap-3">
            <p className="text-xs font-semibold text-[var(--danger)]">Couldn&rsquo;t load your symptom history</p>
            <button type="button" onClick={() => void logsQuery.refetch()} className="mx-auto rounded-full border border-line px-5 py-2 text-xs font-semibold text-primary transition-opacity hover:opacity-80">Try again</button>
          </div>
        ) : logsQuery.data.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface p-8 text-center text-xs text-ink-muted">
            No physiological symptom observations recorded in this billing cycle yet.
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            {logsQuery.data.map((l) => (
              <div key={l.id} className="rounded-2xl border border-line bg-surface p-5 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-sage-soft px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[.12em] text-sage-text">
                    {l.symptomType.replace("_", " ")}
                  </span>
                  <span className="text-xs font-medium text-ink-muted">{l.loggedDate}</span>
                </div>
                <div className="text-xs font-medium text-ink-muted">
                  Severity: <strong className="font-data text-sm font-bold text-primary">{l.severity} / 5</strong>
                  {l.relatedDishSlug && (
                    <>
                      {" "}&bull; Correlated with: <span className="font-data text-ink">{l.relatedDishSlug}</span>
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

function SymptomHistorySkeleton() {
  return (
    <div className="flex flex-col gap-3.5">
      <p className="sr-only">Loading your symptom history…</p>
      <div aria-hidden className="flex flex-col gap-3.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-secondary" />
        ))}
      </div>
    </div>
  );
}
