"use client";
// Read-only preview of a generated weekly lunch plan: per-day picks with the
// "why", any constraint warnings, and a provenance pill (AI vs rule-based). The
// Schedule button hands off to the parent (server fans out office_orders).
import { formatPaise } from "@/lib/format";
import type { LunchPlanProposal } from "@/lib/b2bPlannerApi";

const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });

export function LunchPlanPreview({ proposal, onSchedule, scheduling, perEmployeePaise, scheduledHour }: {
  proposal: LunchPlanProposal | null;
  onSchedule: () => void;
  scheduling: boolean;
  perEmployeePaise: number;
  scheduledHour: number;
}) {
  if (!proposal) {
    return <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink-muted">No plan yet — generate one from the saved profile.</p>;
  }

  const { plan, status, scheduledOfficeOrderIds } = proposal;
  const scheduled = status === "scheduled" || scheduledOfficeOrderIds.length > 0;
  const hour12 = ((scheduledHour + 11) % 12) + 1;
  const ampm = scheduledHour < 12 ? "AM" : "PM";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${plan.generatedBy === "ai" ? "bg-[color-mix(in_srgb,var(--gold)_14%,transparent)] text-gold-text" : "bg-sage-soft text-sage-text"}`}>
          {plan.generatedBy === "ai" ? "AI-generated" : "Rule-based"}
        </span>
        {scheduled && <span className="rounded-full bg-sage px-2.5 py-0.5 text-[11px] font-semibold text-sage-foreground">Scheduled</span>}
        <span className="text-xs text-ink-faint">Week of {dayLabel(plan.weekStartDate)}</span>
      </div>

      {plan.summary && <p className="text-sm text-ink-muted">{plan.summary}</p>}

      <ul className="flex flex-col gap-2">
        {plan.days.map((d) => (
          <li key={d.date} className="rounded-xl border border-line bg-surface px-4 py-3">
            <p className="text-sm font-semibold text-ink">{dayLabel(d.date)}</p>
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {d.picks.map((p) => (
                <li key={p.menuItemId}>
                  <p className="text-sm text-ink">{p.name}</p>
                  {p.why && <p className="text-xs text-ink-faint">{p.why}</p>}
                </li>
              ))}
            </ul>
            {d.warnings.length > 0 && (
              <ul className="mt-2 flex flex-col gap-0.5">
                {d.warnings.map((w) => <li key={w} className="text-xs text-[var(--danger)]">⚠ {w}</li>)}
              </ul>
            )}
          </li>
        ))}
      </ul>

      {scheduled ? (
        <p className="text-sm font-medium text-sage-text">
          Scheduled — {scheduledOfficeOrderIds.length} office {scheduledOfficeOrderIds.length === 1 ? "lunch" : "lunches"} created. Members can now pick their meals.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <button type="button" onClick={onSchedule} disabled={scheduling} className="self-start rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-[var(--gold-ink)] disabled:opacity-40">
            {scheduling ? "Scheduling…" : "Schedule this week"}
          </button>
          <p className="text-xs text-ink-faint">Creates one office lunch per day at {hour12} {ampm}, {formatPaise(perEmployeePaise)}/person. Members pick within budget.</p>
        </div>
      )}
    </div>
  );
}
