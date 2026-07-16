import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import { F } from "./data";
import {
  b2bPlannerApi,
  type LunchPlanProposal,
  type TeamDietConstraints,
  type TeamDietProfile,
} from "@/lib/b2bPlannerApi";

/* Full-parity re-port of the System-A CorporateLunchPlanner (git 2507084) into
 * the v2 (.tnm2) design language — SAME state, math, handlers and endpoints,
 * v2 UI (steppers, chips, cards, sticky dock). */

const ALLERGENS = [
  "peanut",
  "tree_nut",
  "milk",
  "egg",
  "wheat",
  "gluten",
  "soy",
  "shellfish",
  "fish",
  "sesame",
];

const EMPTY: TeamDietConstraints = {
  headcount: 10,
  vegPct: 0,
  vegCount: 6,
  veganCount: 1,
  glutenFreeCount: 0,
  jainCount: 0,
  halalCount: 0,
  allergens: [],
  cuisinePrefs: [],
  calorieFloor: null,
  calorieCeiling: null,
  notes: "",
};

// Constants used verbatim by onSchedule — surfaced in the totals ribbon.
const PER_EMPLOYEE_PAISE = 40_000;
const SCHEDULED_HOUR = 13;

export default function V2CorporateLunchPlanner() {
  const { slug = "" } = useParams<{ slug: string }>();
  const [profile, setProfile] = useState<TeamDietProfile | null>(null);
  const [form, setForm] = useState<TeamDietConstraints>(EMPTY);
  const [cuisineInput, setCuisineInput] = useState("");
  const [proposal, setProposal] = useState<LunchPlanProposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [p, c] = await Promise.all([
          b2bPlannerApi.getDietProfile(slug),
          b2bPlannerApi.getCurrentPlan(slug),
        ]);
        if (cancelled) return;
        if (p.profile) {
          setProfile(p.profile);
          setForm(p.profile.constraints);
        }
        setProposal(c.proposal);
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const remainingNonVeg = useMemo(
    () => Math.max(0, form.headcount - form.vegCount),
    [form.headcount, form.vegCount],
  );

  const toggleAllergen = (a: string) =>
    setForm((f) => ({
      ...f,
      allergens: f.allergens.includes(a)
        ? f.allergens.filter((x) => x !== a)
        : [...f.allergens, a],
    }));

  const addCuisine = () => {
    const v = cuisineInput.trim().toLowerCase();
    if (!v) return;
    if (form.cuisinePrefs.includes(v)) return;
    setForm((f) => ({ ...f, cuisinePrefs: [...f.cuisinePrefs, v] }));
    setCuisineInput("");
  };
  const removeCuisine = (c: string) =>
    setForm((f) => ({
      ...f,
      cuisinePrefs: f.cuisinePrefs.filter((x) => x !== c),
    }));

  const onSave = async () => {
    setSaving(true);
    try {
      const r = await b2bPlannerApi.saveDietProfile(slug, form);
      setProfile(r.profile);
      setForm(r.profile.constraints);
      toast.success("Diet profile saved");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const onGenerate = async () => {
    setGenerating(true);
    try {
      const r = await b2bPlannerApi.generatePlan(slug);
      setProposal(r.proposal);
      toast.success(
        `Plan ready (${r.proposal.plan.generatedBy === "ai" ? "AI" : "deterministic"})`,
      );
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const onSchedule = async () => {
    if (!proposal) return;
    setScheduling(true);
    try {
      const r = await b2bPlannerApi.schedulePlan(proposal.id, {
        scheduledHour: SCHEDULED_HOUR,
        perEmployeeBudgetPaise: PER_EMPLOYEE_PAISE,
      });
      setProposal(r.proposal);
      toast.success(
        `Scheduled ${r.scheduledOfficeOrderIds.length} office orders`,
      );
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setScheduling(false);
    }
  };

  const isScheduled = proposal?.status === "scheduled";

  return (
    <div className="tnm2 nn" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div
        style={{
          maxWidth: 480,
          margin: "0 auto",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* App bar */}
        <div className="appbar">
          <Link
            className="iconbtn"
            to={`/corporate/${slug}`}
            aria-label="Back to admin"
          >
            <i className="ph-bold ph-arrow-left" />
          </Link>
          <div className="abt">Office lunch planner</div>
          <span className="iconbtn" aria-hidden="true">
            <i className="ph-bold ph-buildings" />
          </span>
        </div>

        {loading ? (
          <div className="content padx" style={{ paddingTop: 4 }}>
            <div className="card mb12">
              <div className="skel" style={{ height: 16, width: "40%" }} />
              <div
                className="grid mt10"
                style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}
              >
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="skel" style={{ height: 40 }} />
                ))}
              </div>
            </div>
            <div className="card mb12">
              <div className="skel" style={{ height: 15, width: "50%" }} />
              <div className="skel mt10" style={{ height: 60, width: "100%" }} />
            </div>
          </div>
        ) : (
          <>
            <div
              className="content padx"
              style={{ paddingTop: 4, paddingBottom: 24 }}
            >
              {/* Hero */}
              <div
                className="lab"
                style={{
                  color: "var(--safb)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <i className="ph-fill ph-users-three" />
                B2B planning
              </div>
              <p className="small mut mt6">
                Capture your team's diet shape, then let the planner build a
                constraint-respecting weekly menu you can schedule.
              </p>

              {/* ---- Team diet profile ---- */}
              <div className="fx ac jb mt20 mb10">
                <div className="sh">Team diet profile</div>
                {profile ? (
                  <span className="lab">
                    Updated {new Date(profile.lastSurveyAt).toLocaleDateString()}
                  </span>
                ) : null}
              </div>

              <div className="card mb12">
                <div
                  className="grid"
                  style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}
                >
                  <Stepper
                    label="Headcount"
                    value={form.headcount}
                    onChange={(n) => setForm({ ...form, headcount: n })}
                  />
                  <Stepper
                    label="Vegetarian"
                    value={form.vegCount}
                    onChange={(n) => setForm({ ...form, vegCount: n })}
                  />
                  <div>
                    <div className="lab mb6">Non-veg (computed)</div>
                    <div
                      className="inp"
                      style={{ justifyContent: "space-between" }}
                    >
                      <span className="mono" style={{ color: "var(--safb)" }}>
                        {remainingNonVeg}
                      </span>
                      <i className="ph-bold ph-lock-simple" />
                    </div>
                  </div>
                  <Stepper
                    label="Vegan"
                    value={form.veganCount}
                    onChange={(n) => setForm({ ...form, veganCount: n })}
                  />
                  <Stepper
                    label="Gluten-free"
                    value={form.glutenFreeCount}
                    onChange={(n) => setForm({ ...form, glutenFreeCount: n })}
                  />
                  <Stepper
                    label="Jain"
                    value={form.jainCount}
                    onChange={(n) => setForm({ ...form, jainCount: n })}
                  />
                  <Stepper
                    label="Halal"
                    value={form.halalCount}
                    onChange={(n) => setForm({ ...form, halalCount: n })}
                  />
                </div>

                <div
                  className="grid mt14"
                  style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}
                >
                  <div>
                    <div className="lab mb6">Calorie floor / meal</div>
                    <div className="inp">
                      <i className="ph-bold ph-arrow-line-down" />
                      <input
                        type="number"
                        placeholder="none"
                        value={form.calorieFloor ?? ""}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            calorieFloor:
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                          })
                        }
                        aria-label="Calorie floor per meal"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="lab mb6">Calorie ceiling / meal</div>
                    <div className="inp">
                      <i className="ph-bold ph-arrow-line-up" />
                      <input
                        type="number"
                        placeholder="none"
                        value={form.calorieCeiling ?? ""}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            calorieCeiling:
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                          })
                        }
                        aria-label="Calorie ceiling per meal"
                      />
                    </div>
                  </div>
                </div>

                {/* Allergens */}
                <div className="lab mt14 mb6">Allergens to exclude</div>
                <div className="fx ac g6 wrap">
                  {ALLERGENS.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => toggleAllergen(a)}
                      className={form.allergens.includes(a) ? "chip on" : "chip"}
                      style={{ textTransform: "capitalize" }}
                      aria-pressed={form.allergens.includes(a)}
                    >
                      {form.allergens.includes(a) ? (
                        <i className="ph-bold ph-prohibit" />
                      ) : null}
                      {a.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>

                {/* Cuisine preferences */}
                <div className="lab mt14 mb6">Cuisine preferences</div>
                <div className="fx ac gap8">
                  <div className="inp f1">
                    <i className="ph-bold ph-cooking-pot" />
                    <input
                      value={cuisineInput}
                      onChange={(e) => setCuisineInput(e.target.value)}
                      placeholder="e.g. indian, thai, mediterranean"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addCuisine();
                        }
                      }}
                      aria-label="Add cuisine preference"
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-s"
                    onClick={addCuisine}
                    style={{ flex: "none" }}
                  >
                    <i className="ph-bold ph-plus" />
                    Add
                  </button>
                </div>
                {form.cuisinePrefs.length > 0 ? (
                  <div className="fx ac g6 wrap mt10">
                    {form.cuisinePrefs.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className="chip on"
                        onClick={() => removeCuisine(c)}
                        style={{ textTransform: "capitalize" }}
                      >
                        {c}
                        <i className="ph-bold ph-x" style={{ fontSize: 12 }} />
                      </button>
                    ))}
                  </div>
                ) : null}

                {/* Notes */}
                <div className="lab mt14 mb6">Notes for the planner</div>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="e.g. avoid heavy lunches on Mondays; prefer rotating cuisines"
                  rows={3}
                  aria-label="Notes for the planner"
                  style={{
                    width: "100%",
                    background: "var(--s1)",
                    border: "1px solid var(--ln2)",
                    borderRadius: 10,
                    color: "var(--tx)",
                    fontSize: 14.5,
                    fontFamily: "inherit",
                    padding: "10px 14px",
                    resize: "vertical",
                    outline: "none",
                  }}
                />

                <button
                  type="button"
                  className={"btn btn-g btn-blk mt14" + (saving ? " dis" : "")}
                  onClick={onSave}
                  disabled={saving}
                >
                  <i className="ph-bold ph-floppy-disk" />
                  {saving
                    ? "Saving…"
                    : profile
                      ? "Update profile"
                      : "Save profile"}
                </button>
              </div>

              {/* ---- Schedule totals (from onSchedule constants) ---- */}
              <div className="card mb12">
                <div className="lab mb6">Scheduling basis</div>
                <div className="billrow">
                  <span>Per employee budget</span>
                  <span className="price safc">{F(PER_EMPLOYEE_PAISE)}</span>
                </div>
                <div className="billrow">
                  <span>Delivery hour</span>
                  <span className="mono">{SCHEDULED_HOUR}:00</span>
                </div>
                <div className="billrow">
                  <span>Headcount</span>
                  <span className="mono">{form.headcount}</span>
                </div>
                <div className="billrow tot">
                  <span>Per-day team total</span>
                  <span className="price">
                    {F(PER_EMPLOYEE_PAISE * form.headcount)}
                  </span>
                </div>
              </div>

              {/* ---- This week's menu plan ---- */}
              <div className="sh mt20 mb10">This week's menu plan</div>

              {!profile ? (
                <div
                  className="note mb12"
                  style={{
                    background: "var(--safd)",
                    borderColor: "var(--saf)",
                    color: "var(--safb)",
                  }}
                >
                  <i className="ph-fill ph-warning" />
                  <span>
                    Save a team diet profile above to enable plan generation.
                  </span>
                </div>
              ) : null}

              {proposal ? (
                <>
                  <div className="fx ac g6 wrap mb10">
                    <span className="pill">
                      <i className="ph-bold ph-calendar-dots" />
                      Week of {proposal.plan.weekStartDate}
                    </span>
                    <span
                      className={
                        proposal.status === "scheduled" ? "pill sg" : "pill"
                      }
                    >
                      {proposal.status}
                    </span>
                    <span
                      className={
                        proposal.plan.generatedBy === "ai" ? "pill sg" : "pill"
                      }
                    >
                      {proposal.plan.generatedBy === "ai" ? (
                        <i className="ph-fill ph-sparkle" />
                      ) : null}
                      {proposal.plan.generatedBy === "ai"
                        ? "AI"
                        : "deterministic"}
                    </span>
                  </div>

                  {proposal.plan.summary ? (
                    <p className="small mb12">{proposal.plan.summary}</p>
                  ) : null}

                  {proposal.plan.days.map((day) => (
                    <div key={day.date} className="card mb12">
                      <div className="fx ac jb mb10">
                        <div className="tt">{day.date}</div>
                        {day.warnings.length > 0 ? (
                          <span
                            className="pill"
                            style={{
                              background: "color-mix(in oklab, var(--color-error) 16%, transparent)",
                              color: "var(--dgr)",
                            }}
                          >
                            <i className="ph-bold ph-warning" />
                            {day.warnings.length} warn
                          </span>
                        ) : null}
                      </div>
                      <div>
                        {day.picks.map((p, i) => (
                          <div
                            key={p.menuItemId}
                            style={{
                              padding: "10px 0",
                              borderBottom:
                                i < day.picks.length - 1
                                  ? "1px solid var(--ln)"
                                  : "none",
                            }}
                          >
                            <div
                              className="small"
                              style={{ fontWeight: 600 }}
                            >
                              {p.name}
                            </div>
                            <div className="fine mt2">{p.why}</div>
                          </div>
                        ))}
                      </div>
                      {day.warnings.length > 0 ? (
                        <div
                          className="fine mt10"
                          style={{ color: "var(--dgr)" }}
                        >
                          {day.warnings.map((w) => (
                            <div key={w} className="fx g6 mt2">
                              <i className="ph-bold ph-warning-circle" />
                              <span>{w}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </>
              ) : (
                <div className="tc" style={{ padding: "32px 20px" }}>
                  <i
                    className="ph-bold ph-calendar-blank"
                    style={{ fontSize: 32, color: "var(--fnt)" }}
                  />
                  <div className="fine mt10">
                    No plan yet for the upcoming week.
                  </div>
                </div>
              )}
            </div>

            {/* Sticky dock — generate + schedule */}
            <div className="dock">
              <div className="fx gap12">
                <button
                  type="button"
                  className={
                    "btn btn-g f1" +
                    (generating || !profile ? " dis" : "")
                  }
                  onClick={onGenerate}
                  disabled={generating || !profile}
                >
                  <i
                    className={
                      generating
                        ? "ph-bold ph-arrows-clockwise"
                        : "ph-bold ph-sparkle"
                    }
                  />
                  {generating
                    ? "Planning…"
                    : proposal
                      ? "Regenerate"
                      : "Generate"}
                </button>
                {proposal ? (
                  <button
                    type="button"
                    className={
                      "btn btn-p f1" +
                      (scheduling || isScheduled ? " dis" : "")
                    }
                    onClick={onSchedule}
                    disabled={scheduling || isScheduled}
                  >
                    <i className="ph-bold ph-calendar-check" />
                    {isScheduled
                      ? "Scheduled"
                      : scheduling
                        ? "Scheduling…"
                        : "Schedule orders"}
                  </button>
                ) : null}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <div className="lab mb6">{label}</div>
      <div className="fx ac gap8">
        <button
          type="button"
          className="qbtn"
          onClick={() => onChange(Math.max(0, value - 1))}
          aria-label={`Decrease ${label}`}
        >
          <i className="ph-bold ph-minus" />
        </button>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
          className="mono"
          style={{
            flex: 1,
            minWidth: 0,
            height: 36,
            textAlign: "center",
            background: "var(--s1)",
            border: "1px solid var(--ln2)",
            borderRadius: 9,
            color: "var(--tx)",
            fontSize: 14.5,
            outline: "none",
          }}
        />
        <button
          type="button"
          className="qbtn"
          onClick={() => onChange(value + 1)}
          aria-label={`Increase ${label}`}
        >
          <i className="ph-bold ph-plus" />
        </button>
      </div>
    </div>
  );
}
