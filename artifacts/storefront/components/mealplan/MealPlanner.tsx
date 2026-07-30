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
  if (mp.phase === "loading") {
    return (
      <div className="flex flex-col gap-6">
        <p className="sr-only">Loading your planner…</p>
        <div aria-hidden className="flex gap-2 overflow-hidden">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-20 w-12 shrink-0 animate-pulse rounded-full bg-surface-raised" />
          ))}
        </div>
        <div aria-hidden className="h-44 animate-pulse rounded-3xl bg-surface-raised" />
        <div aria-hidden className="h-72 animate-pulse rounded-3xl bg-surface-raised" />
      </div>
    );
  }

  const plan = mp.plan;
  const editable = plan?.status === "draft" && !mp.busy;

  return (
    <div className="flex flex-col gap-6">
      {mp.error && <p role="alert" className="text-xs font-medium text-[var(--danger)]">{mp.error}</p>}

      <div className="flex flex-col gap-1">
        <WeekCalendarStrip calendar={mp.weekCalendar} onCycle={mp.cycleDay} />
        <button type="button" onClick={() => setShowSettings(true)} className="-m-2 self-end p-2 text-xs font-semibold uppercase tracking-widest text-ink-muted hover:text-ink">
          Settings
        </button>
      </div>

      {!plan ? (
        <div className="rounded-3xl border border-line bg-surface p-8 text-center">
          <p className="text-sm font-semibold text-ink">No plan yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-ink-muted">
            Generate a 7-day plan tuned to your goals, diet, allergens and budget.
          </p>
          <Link href="/menu" className="-m-2 mt-3 inline-block p-2 text-sm font-medium text-gold-text underline-offset-4 hover:underline">
            Or browse the à la carte menu
          </Link>
        </div>
      ) : (
        <>
          <PlanSummary plan={plan} accepted={mp.accepted} />
          <div className="flex flex-col gap-4">
            {plan.days.map((day, i) => (
              <DayCard key={day.date + i} day={day} editable={editable} onSwap={(slot) => setSwap({ dayIndex: i, slot })} onRegen={() => void mp.regenDay(i)} />
            ))}
          </div>
          {plan.status !== "draft" && (
            <p className="text-center text-sm text-ink-muted">
              This plan is <span className="font-medium text-ink">{plan.status}</span>.{" "}
              <Link href="/account/subscriptions" className="font-medium text-gold-text hover:underline">Manage your subscription</Link>.
            </p>
          )}
        </>
      )}

      {/* Plan bar — the screen's single gold primary lives here: Accept &
          schedule while a draft exists, Generate/Regenerate otherwise. */}
      <div className="sticky bottom-16 z-10 -mx-4 border-t border-line bg-[var(--glass)] px-4 pb-3 pt-3 backdrop-blur-xl md:bottom-0">
        {plan?.status === "draft" ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void mp.discard()}
              disabled={mp.busy}
              className="-m-2 p-2 text-xs font-semibold uppercase tracking-widest text-ink-muted hover:text-ink disabled:opacity-60"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={() => void mp.generate()}
              disabled={mp.busy}
              className="ml-auto shrink-0 rounded-full border border-line px-4 py-3 text-xs font-semibold text-ink-muted hover:border-line-strong hover:text-ink active:scale-[0.98] disabled:opacity-60"
            >
              {mp.busy ? "Working…" : plan ? "Regenerate week" : "Generate my week"}
            </button>
            <button
              type="button"
              onClick={() => void mp.accept()}
              disabled={mp.busy}
              className="shrink-0 rounded-full bg-gold px-5 py-3 text-sm font-semibold text-[var(--gold-ink)] active:scale-[0.98] disabled:opacity-60"
            >
              Accept &amp; schedule
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void mp.generate()}
            disabled={mp.busy}
            className="w-full rounded-full bg-gold px-5 py-3 text-sm font-semibold text-[var(--gold-ink)] active:scale-[0.98] disabled:opacity-60"
          >
            {mp.busy ? "Working…" : plan ? "Regenerate week" : "Generate my week"}
          </button>
        )}
      </div>

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

