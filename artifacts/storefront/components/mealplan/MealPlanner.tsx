"use client";
// Weekly meal-planner island. Session-gated (401 → inline PhoneAuth). Generate a
// week, swap dishes on the draft, then accept (schedules onto an active weekly
// subscription — no new charge) or discard. Lifecycle lives in useMealPlan.
import { useState } from "react";
import Link from "next/link";
import { useMealPlan } from "./useMealPlan";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";
import { PlanSummary } from "./PlanSummary";
import { DayCard } from "./DayCard";
import { SwapDialog } from "./SwapDialog";
import { WeekCalendarStrip } from "./WeekCalendarStrip";
import { SettingsDialog } from "./SettingsDialog";
import type { MealPlanSlot } from "@/lib/mealPlanApi";

export function MealPlanner() {
  const mp = useMealPlan();
  const [swap, setSwap] = useState<{ dayIndex: number; slot: MealPlanSlot } | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  if (mp.phase === "needsAuth") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">Sign in to plan and edit your week.</p>
        <PhoneAuth onVerified={() => void mp.reload()} />
      </div>
    );
  }
  if (mp.phase === "loading") return <p className="text-sm text-ink-muted">Loading your planner…</p>;

  const plan = mp.plan;
  const editable = plan?.status === "draft" && !mp.busy;

  return (
    <div className="flex flex-col gap-6">
      {mp.error && <p role="alert" className="text-xs font-medium text-[var(--danger)]">{mp.error}</p>}

      <WeekCalendarStrip calendar={mp.weekCalendar} onCycle={mp.cycleDay} />

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => void mp.generate()}
          disabled={mp.busy}
          className="rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-[var(--gold-ink)] disabled:opacity-60"
        >
          {mp.busy ? "Working…" : plan ? "Regenerate week" : "Generate my week"}
        </button>
        <button type="button" onClick={() => setShowSettings(true)} className="text-sm font-medium text-ink-muted hover:text-ink">Settings</button>
      </div>

      {!plan ? (
        <div className="rounded-2xl border border-line bg-surface p-8 text-center">
          <p className="text-sm font-semibold text-ink">No plan yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">
            Generate a 7-day plan tuned to your goals, diet, allergens and budget.
          </p>
          <Link href="/menu" className="mt-3 inline-block text-sm font-medium text-gold-text hover:underline">
            Or browse the à la carte menu
          </Link>
        </div>
      ) : (
        <>
          <PlanSummary plan={plan} accepted={mp.accepted} />
          <div className="flex flex-col gap-3">
            {plan.days.map((day, i) => (
              <DayCard key={day.date + i} day={day} editable={editable} onSwap={(slot) => setSwap({ dayIndex: i, slot })} onRegen={() => void mp.regenDay(i)} />
            ))}
          </div>
          {plan.status === "draft" ? (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void mp.discard()}
                disabled={mp.busy}
                className="flex-1 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:border-line-strong disabled:opacity-60"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={() => void mp.accept()}
                disabled={mp.busy}
                className="flex-1 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-[var(--gold-ink)] disabled:opacity-60"
              >
                Accept &amp; schedule
              </button>
            </div>
          ) : (
            <p className="text-center text-sm text-ink-muted">
              This plan is <span className="font-medium text-ink">{plan.status}</span>.{" "}
              <Link href="/account/subscriptions" className="font-medium text-gold-text hover:underline">Manage your subscription</Link>.
            </p>
          )}
        </>
      )}

      {plan && swap && (
        <SwapDialog
          planId={plan.id}
          target={swap}
          onClose={() => setSwap(null)}
          onPick={(dishId) => { const t = swap; setSwap(null); void mp.swap(t.dayIndex, t.slot, dishId); }}
        />
      )}

      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
    </div>
  );
}

