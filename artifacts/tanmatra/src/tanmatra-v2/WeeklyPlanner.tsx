import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import {
  mealPlanApi,
  formatPaise,
  formatDay,
  type MealPlan,
  type MealPlanSettings,
  type MealPlanSlot,
  type MealPlanSlotEntry,
  type WeekDayCalendarKind,
} from "@/lib/mealPlanApi";

const CALENDAR_KINDS: WeekDayCalendarKind[] = ["normal", "gym", "travel", "wfh"];
const CALENDAR_LABEL: Record<WeekDayCalendarKind, string> = {
  normal: "Normal",
  gym: "Gym",
  travel: "Travel",
  wfh: "WFH",
};
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const SLOTS: MealPlanSlot[] = ["breakfast", "lunch", "dinner"];
const SLOT_LABEL: Record<MealPlanSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

// Shared v2 surface for the shadcn Dialog portals (rendered outside the main
// .tnm2 scope, so each DialogContent becomes its own .tnm2 root).
const DIALOG_SURFACE: any = {
  background: "var(--s1)",
  border: "1px solid var(--ln2)",
  color: "var(--tx)",
};

export default function V2WeeklyPlanner() {
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [activePlan, setActivePlan] = useState<MealPlan | null>(null);
  const [settings, setSettings] = useState<MealPlanSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [busyDay, setBusyDay] = useState<number | null>(null);
  const [swapDialog, setSwapDialog] = useState<{
    dayIndex: number;
    slot: MealPlanSlot;
    suggestions: MealPlanSlotEntry[];
    loading: boolean;
  } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [weekCalendar, setWeekCalendar] = useState<WeekDayCalendarKind[]>(
    () => Array<WeekDayCalendarKind>(7).fill("normal"),
  );

  const cycleCalendar = (i: number) => {
    setWeekCalendar((prev) => {
      const next = [...prev];
      const cur = next[i] ?? "normal";
      const idx = CALENDAR_KINDS.indexOf(cur);
      next[i] = CALENDAR_KINDS[(idx + 1) % CALENDAR_KINDS.length]!;
      return next;
    });
  };
  const [settingsDraft, setSettingsDraft] = useState<{
    autoReplanEnabled: boolean;
    weeklyBudgetRupees: string;
    maxRepetitionsPerDish: number;
  }>({
    autoReplanEnabled: false,
    weeklyBudgetRupees: "",
    maxRepetitionsPerDish: 2,
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [{ plans }, { settings }] = await Promise.all([
        mealPlanApi.listPlans(),
        mealPlanApi.getSettings(),
      ]);
      setPlans(plans);
      setSettings(settings);
      const draftOrLatest =
        plans.find((p) => p.status === "draft") ?? plans[0] ?? null;
      setActivePlan(draftOrLatest);
    } catch (err) {
      toast.error("Could not load meal plans");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!settings) return;
    setSettingsDraft({
      autoReplanEnabled: settings.autoReplanEnabled,
      weeklyBudgetRupees:
        settings.weeklyBudgetPaise != null
          ? String(Math.round(settings.weeklyBudgetPaise / 100))
          : "",
      maxRepetitionsPerDish: settings.maxRepetitionsPerDish,
    });
  }, [settings]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { plan, usedFallback } = await mealPlanApi.generate({
        overrides: { weekCalendar },
      });
      setActivePlan(plan);
      setPlans((prev) => {
        const without = prev.filter((p) => p.id !== plan.id);
        return [plan, ...without];
      });
      toast.success(
        usedFallback
          ? "Plan generated using rule-based fallback."
          : "Personalized weekly plan ready!",
      );
    } catch (err) {
      toast.error("Could not generate plan");
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenDay = async (dayIndex: number) => {
    if (!activePlan) return;
    setBusyDay(dayIndex);
    try {
      const { plan } = await mealPlanApi.regenerateDay(activePlan.id, dayIndex);
      setActivePlan(plan);
      toast.success("Day refreshed");
    } catch (err) {
      toast.error((err as Error).message || "Could not regenerate day");
    } finally {
      setBusyDay(null);
    }
  };

  const openSwap = async (dayIndex: number, slot: MealPlanSlot) => {
    if (!activePlan) return;
    setSwapDialog({ dayIndex, slot, suggestions: [], loading: true });
    try {
      const { suggestions } = await mealPlanApi.swapSuggestions(
        activePlan.id,
        dayIndex,
        slot,
      );
      setSwapDialog({ dayIndex, slot, suggestions, loading: false });
    } catch (err) {
      toast.error("Could not load swap options");
      setSwapDialog(null);
      console.error(err);
    }
  };

  const handleSwap = async (dishId: number) => {
    if (!activePlan || !swapDialog) return;
    try {
      const { plan } = await mealPlanApi.swapSlot(
        activePlan.id,
        swapDialog.dayIndex,
        swapDialog.slot,
        dishId,
      );
      setActivePlan(plan);
      setSwapDialog(null);
      toast.success("Swapped");
    } catch (err) {
      toast.error((err as Error).message || "Swap rejected");
    }
  };

  const handleAccept = async () => {
    if (!activePlan) return;
    try {
      const result = await mealPlanApi.accept(activePlan.id);
      setActivePlan(result.plan);
      setPlans((prev) =>
        prev.map((p) => (p.id === result.plan.id ? result.plan : p)),
      );
      if (result.subscriptionId) {
        toast.success(
          `Plan accepted — ${result.deliveryIds.length} deliveries scheduled.`,
        );
      } else {
        toast.success(
          "Plan accepted. Start a weekly subscription to schedule deliveries.",
        );
      }
    } catch (err) {
      toast.error((err as Error).message || "Could not accept plan");
    }
  };

  const handleDiscard = async () => {
    if (!activePlan) return;
    try {
      const { plan } = await mealPlanApi.discard(activePlan.id);
      setActivePlan(plan);
      setPlans((prev) => prev.map((p) => (p.id === plan.id ? plan : p)));
      toast.success("Plan discarded");
    } catch (err) {
      toast.error((err as Error).message || "Could not discard");
    }
  };

  const saveSettings = async () => {
    const budgetRupees = settingsDraft.weeklyBudgetRupees.trim();
    const patch = {
      autoReplanEnabled: settingsDraft.autoReplanEnabled,
      weeklyBudgetPaise:
        budgetRupees === "" ? null : Math.round(Number(budgetRupees) * 100),
      maxRepetitionsPerDish: settingsDraft.maxRepetitionsPerDish,
    };
    if (
      patch.weeklyBudgetPaise !== null &&
      (!Number.isFinite(patch.weeklyBudgetPaise) ||
        patch.weeklyBudgetPaise < 0)
    ) {
      toast.error("Invalid budget");
      return;
    }
    try {
      const { settings } = await mealPlanApi.updateSettings(patch);
      setSettings(settings);
      setSettingsOpen(false);
      toast.success("Settings saved");
    } catch (err) {
      toast.error((err as Error).message || "Could not save settings");
    }
  };

  const isDraft = activePlan?.status === "draft";

  return (
    <div className="tnm2" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className="appbar">
          <Link className="iconbtn" to="/" aria-label="Home">
            <i className="ph-bold ph-arrow-left" />
          </Link>
          <div className="abt">Meal planner</div>
          <button
            type="button"
            className="iconbtn"
            onClick={() => setSettingsOpen(true)}
            aria-label="Meal planner settings"
            data-testid="button-meal-plan-settings"
          >
            <i className="ph-bold ph-gear" />
          </button>
        </div>

        <div className="content padx" style={{ paddingTop: 4, paddingBottom: 24 }}>
          {/* Hero */}
          <div
            className="lab"
            style={{ color: "var(--safb)", display: "flex", alignItems: "center", gap: 6 }}
          >
            <i className="ph-fill ph-sparkle" />
            AI-personalised
          </div>
          <h1 className="disp mt6" style={{ color: "#fff" }}>
            Weekly meal planner
          </h1>
          <p className="small mut mt6">
            A personalized 7-day plan tuned to your goals, diet, allergens and
            budget. Swap, regenerate or accept — accepting schedules the week on
            your active weekly subscription.
          </p>

          <button
            type="button"
            className={"btn btn-p btn-lg btn-blk mt16" + (generating ? " dis" : "")}
            onClick={handleGenerate}
            disabled={generating}
            data-testid="button-generate-plan"
          >
            <i
              className={
                generating ? "ph-bold ph-arrows-clockwise" : "ph-bold ph-sparkle"
              }
            />
            {generating
              ? "Generating…"
              : activePlan
                ? "Regenerate week"
                : "Generate plan"}
          </button>

          {loading ? (
            <div className="mt16">
              <div className="card mb12">
                <div className="skel" style={{ height: 16, width: "45%" }} />
                <div className="skel mt10" style={{ height: 44, width: "100%" }} />
              </div>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="card mb12">
                  <div className="fx ac jb">
                    <div className="skel" style={{ height: 15, width: "35%" }} />
                    <div className="skel" style={{ height: 26, width: 64 }} />
                  </div>
                  <div className="skel mt10" style={{ height: 40, width: "100%" }} />
                  <div className="skel mt8" style={{ height: 40, width: "100%" }} />
                  <div className="skel mt8" style={{ height: 40, width: "100%" }} />
                </div>
              ))}
            </div>
          ) : !activePlan ? (
            <div className="tc" style={{ padding: "40px 20px" }}>
              <i
                className="ph-bold ph-calendar-dots"
                style={{ fontSize: 32, color: "var(--fnt)" }}
              />
              <div className="tt mt10">No plan yet</div>
              <div className="fine mt6">
                Generate your first 7-day plan tailored to your preferences.
              </div>
              <button
                type="button"
                className={"btn btn-p mt20" + (generating ? " dis" : "")}
                onClick={handleGenerate}
                disabled={generating}
              >
                <i className="ph-bold ph-sparkle" />
                Generate plan
              </button>
              <div className="mt16">
                <Link className="linkq" to="/menu">
                  <i className="ph-bold ph-fork-knife" />
                  Browse the à la carte menu instead
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* Week calendar */}
              <div className="card mb12 mt16">
                <div className="fx ac gap8 mb10">
                  <i className="ph-bold ph-calendar-dots fntc" />
                  <span className="fine">
                    Tap a day to mark gym/travel/WFH — applied next time you
                    regenerate.
                  </span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7, 1fr)",
                    gap: 6,
                  }}
                >
                  {weekCalendar.map((kind, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => cycleCalendar(i)}
                      data-testid={`button-calendar-${i}`}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 4,
                        padding: "8px 2px",
                        borderRadius: 8,
                        border: "1px solid var(--ln)",
                        background: "var(--s1)",
                      }}
                    >
                      <span className="lab">{DAY_LABELS[i]}</span>
                      <span
                        className={kind === "normal" ? "pill" : "pill sg"}
                        style={{ padding: "3px 7px", fontSize: 9 }}
                      >
                        {CALENDAR_LABEL[kind]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <PlanSummary plan={activePlan} />

              <div className="sh mt20 mb10">Your 7 days</div>
              {activePlan.days.map((day, idx) => (
                <DayCard
                  key={day.date}
                  day={day}
                  dayIndex={idx}
                  editable={!!isDraft}
                  busy={busyDay === idx}
                  onRegenerate={() => handleRegenDay(idx)}
                  onSwap={(slot) => openSwap(idx, slot)}
                />
              ))}

              {isDraft ? (
                <div className="fx gap12 mt16">
                  <button
                    type="button"
                    className="btn btn-g f1"
                    onClick={handleDiscard}
                    data-testid="button-discard-plan"
                  >
                    <i className="ph-bold ph-trash" />
                    Discard
                  </button>
                  <button
                    type="button"
                    className="btn btn-p f1"
                    onClick={handleAccept}
                    data-testid="button-accept-plan"
                  >
                    <i className="ph-bold ph-check" />
                    Accept &amp; schedule
                  </button>
                </div>
              ) : (
                <div className="tc mt16">
                  <div className="fine">
                    Status{" "}
                    <span className="pill" style={{ marginLeft: 4 }}>
                      {activePlan.status}
                    </span>
                  </div>
                  <div className="mt10">
                    <Link className="linkq" to="/subscribe">
                      Set up weekly subscription
                      <i className="ph-bold ph-arrow-right" />
                    </Link>
                  </div>
                </div>
              )}

              {plans.length > 1 ? (
                <>
                  <div className="sh mt20 mb10">Recent plans</div>
                  <div className="fx wrap g6">
                    {plans.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={p.id === activePlan.id ? "chip on" : "chip"}
                        onClick={() => setActivePlan(p)}
                      >
                        {formatDay(p.weekStartDate)} · {p.status}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* Swap dialog */}
      {swapDialog !== null && (
        <div
          className="tnm2"
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setSwapDialog(null)}
        >
          <div className="card" style={{ ...DIALOG_SURFACE, maxWidth: 520, width: "100%" }} onClick={(e) => e.stopPropagation()}>
            <div className="h2" style={{ color: "var(--tx)" }}>
              Swap {swapDialog ? SLOT_LABEL[swapDialog.slot] : ""}
            </div>
          {swapDialog?.loading ? (
            <div>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="card mb10">
                  <div className="fx ac jb">
                    <div className="skel" style={{ height: 15, width: "55%" }} />
                    <div className="skel" style={{ height: 15, width: 48 }} />
                  </div>
                  <div className="skel mt8" style={{ height: 12, width: "40%" }} />
                </div>
              ))}
            </div>
          ) : swapDialog && swapDialog.suggestions.length === 0 ? (
            <div className="tc" style={{ padding: "24px 8px" }}>
              <i
                className="ph-bold ph-prohibit"
                style={{ fontSize: 28, color: "var(--fnt)" }}
              />
              <div className="fine mt10">
                No safe alternatives match your constraints.
              </div>
              <button
                type="button"
                className="btn btn-g mt16"
                onClick={() => {
                  setSwapDialog(null);
                  setSettingsOpen(true);
                }}
              >
                <i className="ph-bold ph-gear" />
                Adjust plan settings
              </button>
            </div>
          ) : (
            <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
              {swapDialog?.suggestions.map((s) => (
                <button
                  key={s.dishId}
                  type="button"
                  className="card pointer w100 mb10"
                  onClick={() => handleSwap(s.dishId)}
                  data-testid={`button-swap-${s.dishId}`}
                  style={{ display: "block" }}
                >
                  <div className="fx ac jb gap8">
                    <span
                      className="small clamp1 f1"
                      style={{ fontWeight: 600, minWidth: 0 }}
                    >
                      {s.name}
                    </span>
                    <span className="price safc" style={{ flex: "none" }}>
                      {formatPaise(s.pricePaise)}
                    </span>
                  </div>
                  <div className="fine mt4">
                    {s.calories} kcal · {s.protein}g protein
                  </div>
                </button>
              ))}
            </div>
          )}
            <div className="fx gap8 mt16">
              <button
                type="button"
                className="btn btn-g btn-blk"
                onClick={() => setSwapDialog(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings dialog */}
      {settingsOpen && (
        <div
          className="tnm2"
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setSettingsOpen(false)}
        >
          <div className="card" style={{ ...DIALOG_SURFACE, maxWidth: 460, width: "100%" }} onClick={(e) => e.stopPropagation()}>
            <div className="h2" style={{ color: "var(--tx)" }}>
              Meal planner settings
            </div>
          <div className="mt10">
            <div className="fx ac jb gap12 mb16">
              <div className="f1" style={{ minWidth: 0 }}>
                <div className="small" style={{ fontWeight: 600 }}>
                  Auto-replan weekly
                </div>
                <div className="fine mt2">
                  We'll draft next week's plan automatically (you still confirm).
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settingsDraft.autoReplanEnabled}
                aria-label="Auto-replan weekly"
                className={settingsDraft.autoReplanEnabled ? "sw on" : "sw"}
                onClick={() =>
                  setSettingsDraft((d) => ({
                    ...d,
                    autoReplanEnabled: !d.autoReplanEnabled,
                  }))
                }
                data-testid="switch-auto-replan"
              />
            </div>
            <div className="mb16">
              <div className="lab mb6">Weekly budget (₹)</div>
              <div className="inp">
                <i className="ph-bold ph-wallet" />
                <input
                  type="number"
                  min={0}
                  placeholder="No limit"
                  value={settingsDraft.weeklyBudgetRupees}
                  onChange={(e) =>
                    setSettingsDraft((d) => ({
                      ...d,
                      weeklyBudgetRupees: e.target.value,
                    }))
                  }
                  aria-label="Weekly budget in rupees"
                  data-testid="input-weekly-budget"
                />
              </div>
            </div>
            <div className="mb16">
              <div className="lab mb6">Max repetitions per dish (per week)</div>
              <div className="inp">
                <i className="ph-bold ph-repeat" />
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={settingsDraft.maxRepetitionsPerDish}
                  onChange={(e) =>
                    setSettingsDraft((d) => ({
                      ...d,
                      maxRepetitionsPerDish: Math.max(
                        1,
                        Math.min(7, Number(e.target.value) || 1),
                      ),
                    }))
                  }
                  aria-label="Max repetitions per dish"
                  data-testid="input-max-repetitions"
                />
              </div>
            </div>
          </div>
            <div className="fx gap8 mt16" style={{ justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn-g"
                onClick={() => setSettingsOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-p"
                onClick={saveSettings}
                data-testid="button-save-settings"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlanSummary({ plan }: { plan: MealPlan }) {
  const c = plan.constraints;
  const t = plan.totals;
  const aria = `Weekly totals: ${
    t ? formatPaise(t.totalPaise) : "no total yet"
  }, average ${t?.avgCalories ?? 0} kilocalories per day, ${
    t?.avgProteinGrams ?? 0
  } grams protein per day`;
  const hasTargets =
    c.weeklyBudgetPaise != null ||
    c.dailyCalorieTarget != null ||
    c.dailyProteinTargetGrams != null;
  return (
    <div className="card mb12 mt16">
      <div className="fx ac jb gap12 mb10">
        <div style={{ minWidth: 0 }}>
          <div className="lab">Week of</div>
          <div className="tt mt2">{formatDay(plan.weekStartDate)}</div>
        </div>
        <span className="pill sg" style={{ flex: "none" }}>
          <i className="ph-fill ph-sparkle" />
          {plan.model ? "AI plan" : "Plan"}
        </span>
      </div>

      <div className="ribbon cmp" role="group" aria-label={aria}>
        <div className="rc">
          <span className="rl">Total</span>
          <span className="rv sf">{t ? formatPaise(t.totalPaise) : "—"}</span>
        </div>
        <div className="rc">
          <span className="rl">Kcal / day</span>
          <span className="rv">{t?.avgCalories ?? "—"}</span>
        </div>
        <div className="rc">
          <span className="rl">Protein / day</span>
          <span className="rv">
            {t?.avgProteinGrams ?? "—"}
            <i className="ru">g</i>
          </span>
        </div>
      </div>

      {hasTargets ? (
        <div className="fine mt8">
          {c.weeklyBudgetPaise != null ? (
            <span>Budget {formatPaise(c.weeklyBudgetPaise)}</span>
          ) : null}
          {c.dailyCalorieTarget != null ? (
            <span>
              {c.weeklyBudgetPaise != null ? " · " : ""}
              Target {c.dailyCalorieTarget} kcal
            </span>
          ) : null}
          {c.dailyProteinTargetGrams != null ? (
            <span>
              {c.weeklyBudgetPaise != null || c.dailyCalorieTarget != null
                ? " · "
                : ""}
              {c.dailyProteinTargetGrams}g protein
            </span>
          ) : null}
        </div>
      ) : null}

      {c.allergens.length > 0 ? (
        <div className="mt10">
          <div className="lab mb6">Avoiding</div>
          <div className="fx wrap g6">
            {c.allergens.map((a) => (
              <span key={a} className="pill">
                {a}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DayCard({
  day,
  dayIndex,
  editable,
  busy,
  onRegenerate,
  onSwap,
}: {
  day: { date: string } & Record<MealPlanSlot, MealPlanSlotEntry>;
  dayIndex: number;
  editable: boolean;
  busy: boolean;
  onRegenerate: () => void;
  onSwap: (slot: MealPlanSlot) => void;
}) {
  return (
    <div className="card mb12">
      <div className="fx ac jb mb10">
        <div className="tt">{formatDay(day.date)}</div>
        {editable ? (
          <button
            type="button"
            className="chip"
            onClick={onRegenerate}
            disabled={busy}
            style={busy ? { opacity: 0.5 } : undefined}
            data-testid={`button-regen-day-${dayIndex}`}
          >
            <i className="ph-bold ph-arrows-clockwise" />
            Regen
          </button>
        ) : null}
      </div>
      <div>
        {SLOTS.map((slot, i) => {
          const entry = day[slot];
          return (
            <div
              key={slot}
              className="fx ac jb gap8"
              style={{
                padding: "10px 0",
                borderBottom: i < SLOTS.length - 1 ? "1px solid var(--ln)" : "none",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div className="lab">{SLOT_LABEL[slot]}</div>
                {entry ? (
                  <>
                    <div
                      className="small clamp1 mt2"
                      style={{ fontWeight: 600 }}
                    >
                      {entry.name}
                    </div>
                    <div className="fine mt2">
                      {entry.calories} kcal · {entry.protein}g ·{" "}
                      <span className="price">{formatPaise(entry.pricePaise)}</span>
                    </div>
                  </>
                ) : (
                  <div className="fine safc mt2" style={{ fontStyle: "italic" }}>
                    No dish picked — try Swap or Regen
                  </div>
                )}
              </div>
              {editable ? (
                <button
                  type="button"
                  className="qbtn"
                  onClick={() => onSwap(slot)}
                  aria-label={`Swap ${SLOT_LABEL[slot]}`}
                  style={{ flex: "none" }}
                  data-testid={`button-swap-${dayIndex}-${slot}`}
                >
                  <i className="ph-bold ph-swap" />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
