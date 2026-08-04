"use client";
// Read-only preview of a generated weekly lunch plan: per-day picks with the
// "why", any constraint warnings, and a provenance pill (AI vs rule-based). The
// Schedule button hands off to the parent (server fans out office_orders).
import { formatPaise } from "@/lib/format";
import type { LunchPlanProposal } from "@/lib/b2bPlannerApi";
import { Button } from "@/components/ui/button";

const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });

export function LunchPlanPreview({ proposal, onSchedule, scheduling, perEmployeePaise, scheduledHour }: {
  proposal: LunchPlanProposal | null;
  onSchedule: () => void;
  scheduling: boolean;
  perEmployeePaise: number;
  scheduledHour: number;
}) {
  if (!proposal) {
    return <p className="rounded-2xl border border-dashed border-line bg-surface px-4 py-10 text-center text-sm text-ink-muted">No plan yet — generate one from the saved profile.</p>;
  }

  const { plan, status, scheduledOfficeOrderIds } = proposal;
  const scheduled = status === "scheduled" || scheduledOfficeOrderIds.length > 0;
  const hour12 = ((scheduledHour + 11) % 12) + 1;
  const ampm = scheduledHour < 12 ? "AM" : "PM";

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-6">
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${plan.generatedBy === "ai" ? "bg-[color-mix(in_srgb,var(--gold)_14%,transparent)] text-gold-text" : "bg-sage-soft text-sage-text"}`}>
            {plan.generatedBy === "ai" ? "AI-generated" : "Rule-based"}
          </span>
          {scheduled && <span className="rounded-full bg-sage-soft px-2.5 py-0.5 text-[11px] font-semibold text-sage-text">Scheduled</span>}
        </div>
        <h3 className="text-base font-semibold tracking-tight text-ink">Week of {dayLabel(plan.weekStartDate)}</h3>
        {plan.summary && <p className="text-sm text-ink-muted">{plan.summary}</p>}
      </div>

      <ul className="flex flex-col">
        {plan.days.map((d) => (
          <li key={d.date} className="flex flex-col gap-1.5 border-b border-line py-4 first:pt-0 last:border-b-0 last:pb-0">
            <p className="text-sm font-semibold text-ink">{dayLabel(d.date)}</p>
            <ul className="flex flex-col gap-1">
              {d.picks.map((p) => (
                <li key={p.menuItemId}>
                  <p className="text-sm text-ink">{p.name}</p>
                  {p.why && <p className="text-xs text-ink-faint">{p.why}</p>}
                </li>
              ))}
            </ul>
            {d.warnings.length > 0 && (
              <ul className="mt-1 flex flex-col gap-1 rounded-lg border border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--danger)_6%,transparent)] px-3 py-2">
                {d.warnings.map((w) => (
                  <li key={w} className="flex items-start gap-1.5 text-xs font-medium text-[var(--danger)]">
                    <span aria-hidden="true">⚠</span><span>{w}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      {scheduled ? (
        <p className="rounded-xl bg-sage-soft px-4 py-3 text-sm font-medium text-sage-text">
          Scheduled — {scheduledOfficeOrderIds.length} office {scheduledOfficeOrderIds.length === 1 ? "lunch" : "lunches"} created. Members can now pick their meals.
        </p>
      ) : (
        <div className="flex flex-col gap-2 border-t border-line pt-5">
          <Button type="button" onClick={onSchedule} disabled={scheduling} shape="xl" size="fluid" className="w-full px-5 py-3.5 font-semibold disabled:opacity-40">
            {scheduling ? "Scheduling…" : "Schedule this week"}
          </Button>
          <p className="text-xs text-ink-faint">Creates one office lunch per day at {hour12} {ampm}, {formatPaise(perEmployeePaise)}/person. Members pick within budget.</p>
        </div>
      )}
    </div>
  );
}
