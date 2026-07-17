import { useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import {
  ALLERGEN_OPTIONS,
  CUISINE_OPTIONS,
  DIETARY_STYLE_LABEL,
  GOAL_LABEL,
  ACTIVITY_LABEL,
  SPICE_LABEL,
  MEDICAL_CONDITION_OPTIONS,
  MEDICAL_CONDITION_LABEL,
  type DietaryStyle,
  type SpiceLevel,
  type ActivityLevel,
  type WellnessGoal,
  type ClinicalContraindication,
} from "@/lib/preferencesApi";
import { usePreferences } from "@/lib/preferencesContext";
import {
  recommendPlansForPreferences,
  PLAN_GOAL_LABEL,
  type PlanGoal,
} from "@/lib/rdPlans";
import DpdpaConsentCapture, {
  type DpdpaConsentState,
} from "@/components/DpdpaConsentCapture";
import { userConsentsApi } from "@/lib/userConsentsApi";

export default function V2Preferences() {
  const { preferences, loading, unauthorized, update, refresh } =
    usePreferences();

  const [dietaryStyle, setDietaryStyle] = useState<DietaryStyle>("omnivore");
  const [goal, setGoal] = useState<WellnessGoal>("general_wellness");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("moderate");
  const [spiceLevel, setSpiceLevel] = useState<SpiceLevel>("medium");
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [allergens, setAllergens] = useState<string[]>([]);
  const [medicalConditions, setMedicalConditions] = useState<string[]>([]);
  const [dislikes, setDislikes] = useState("");
  const [calorieTarget, setCalorieTarget] = useState("");
  const [proteinTargetGrams, setProteinTargetGrams] = useState("");
  const [carbsTargetGrams, setCarbsTargetGrams] = useState("");
  const [fatTargetGrams, setFatTargetGrams] = useState("");
  const [saving, setSaving] = useState(false);
  const [consentState, setConsentState] = useState<Partial<DpdpaConsentState>>({
    purposeClinicalDelivery: true,
    purposeMarketing: false,
    purposeAiPersonalization: false,
    purposeHealthDataProcessing: false,
    consentVersion: "2023_DPDPA_v1",
  });
  const [consentLoading, setConsentLoading] = useState<boolean>(true);

  useEffect(() => {
    userConsentsApi
      .get()
      .then((res) => {
        if (res.consent) {
          setConsentState({
            purposeClinicalDelivery: res.consent.purposeClinicalDelivery,
            purposeMarketing: res.consent.purposeMarketing,
            purposeAiPersonalization: res.consent.purposeAiPersonalization,
            purposeHealthDataProcessing: res.consent.purposeHealthDataProcessing,
            consentVersion: res.consent.consentVersion,
            grantedAt: res.consent.grantedAt ?? undefined,
          });
        }
      })
      .catch(() => {})
      .finally(() => setConsentLoading(false));
  }, []);

  const handleConsentSubmit = async (state: DpdpaConsentState) => {
    try {
      const res = await userConsentsApi.update(state);
      if (res.consent) {
        setConsentState({
          purposeClinicalDelivery: res.consent.purposeClinicalDelivery,
          purposeMarketing: res.consent.purposeMarketing,
          purposeAiPersonalization: res.consent.purposeAiPersonalization,
          purposeHealthDataProcessing: res.consent.purposeHealthDataProcessing,
          consentVersion: res.consent.consentVersion,
          grantedAt: res.consent.grantedAt ?? undefined,
        });
      }
      toast.success("DPDPA consent preferences saved");
    } catch (err) {
      toast.error("Could not save consent preferences");
    }
  };

  useEffect(() => {
    if (!preferences) return;
    setDietaryStyle(preferences.dietaryStyle);
    setGoal(preferences.goal);
    setActivityLevel(preferences.activityLevel);
    setSpiceLevel(preferences.spiceLevel);
    setCuisines(preferences.cuisines);
    setAllergens(preferences.allergens);
    setMedicalConditions(preferences.medicalConditions ?? []);
    setDislikes(preferences.dislikedIngredients.join(", "));
    setCalorieTarget(
      preferences.calorieTarget ? String(preferences.calorieTarget) : "",
    );
    setProteinTargetGrams(
      preferences.proteinTargetGrams
        ? String(preferences.proteinTargetGrams)
        : "",
    );
    setCarbsTargetGrams(
      preferences.carbsTargetGrams
        ? String(preferences.carbsTargetGrams)
        : "",
    );
    setFatTargetGrams(
      preferences.fatTargetGrams ? String(preferences.fatTargetGrams) : "",
    );
  }, [preferences]);

  const toggle = (
    setter: (v: string[]) => void,
    list: string[],
    value: string,
  ) => {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const parseNum = (v: string, lo: number, hi: number) => {
    if (!v.trim()) return null;
    const n = Math.round(Number(v));
    if (!Number.isFinite(n)) return null;
    return Math.max(lo, Math.min(hi, n));
  };

  const handleSave = async () => {
    setSaving(true);
    const out = await update({
      dietaryStyle,
      goal,
      activityLevel,
      spiceLevel,
      cuisines,
      allergens,
      medicalConditions,
      dislikedIngredients: dislikes
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      calorieTarget: parseNum(calorieTarget, 800, 6000),
      proteinTargetGrams: parseNum(proteinTargetGrams, 20, 400),
      carbsTargetGrams: parseNum(carbsTargetGrams, 0, 800),
      fatTargetGrams: parseNum(fatTargetGrams, 0, 300),
      markQuizComplete: true,
    });
    setSaving(false);
    if (!out) {
      toast.error("Could not save preferences");
      return;
    }
    toast.success("Preferences saved");
    void refresh();
  };

  if (loading) {
    return (
      <div className="tnm2 nn min-h-screen bg-[var(--tnm-surface-ink)] text-white antialiased">
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div className="appbar">
            <Link className="iconbtn" to="/" aria-label="Home">
              <i className="ph-bold ph-arrow-left" />
            </Link>
            <div className="abt">Preferences</div>
          </div>
          <div className="content padx" style={{ paddingTop: 4 }}>
            <div className="skel" style={{ height: 28, width: 200 }} />
            <div className="skel mt10" style={{ height: 14, width: 260 }} />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card mt16">
                <div className="skel" style={{ height: 14, width: "34%" }} />
                <div className="fx wrap gap8 mt10">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <div
                      key={j}
                      className="skel"
                      style={{ height: 34, width: 92, borderRadius: 20 }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const recommendations = recommendPlansForPreferences(preferences, 3);

  return (
    <div className="tnm2 nn min-h-screen bg-[var(--tnm-surface-ink)] text-white antialiased">
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className="appbar">
          <Link className="iconbtn" to="/" aria-label="Home">
            <i className="ph-bold ph-arrow-left" />
          </Link>
          <div className="abt">Preferences</div>
          <Link className="iconbtn" to="/menu" title="Menu" aria-label="Menu">
            <i className="ph-bold ph-fork-knife" />
          </Link>
        </div>

        <div className="content" style={{ paddingBottom: 24 }}>
          {/* Hero */}
          <div className="padx" style={{ paddingTop: 4 }}>
            <div
              className="lab"
              style={{ color: "var(--safb)", display: "flex", alignItems: "center", gap: 6 }}
            >
              <i className="ph-bold ph-sliders-horizontal" />
              Your profile
            </div>
            <h1 className="disp mt6" style={{ color: "var(--text-primary)" }}>
              Your Preferences
            </h1>
            <p className="small mut mt6">
              Used by menu, dish detail, and recommendations
            </p>
          </div>

          {/* Unauthorized — prompt sign in */}
          {unauthorized && preferences?.quizCompletedAt && (
            <div className="padx mt16">
              <div
                className="rounded-2xl border border-[var(--tnm-action)]/30 bg-[var(--tnm-action)]/10 p-4"
              >
                <div className="fx ac jb gap12 wrap">
                  <div style={{ minWidth: 0 }}>
                    <div className="tt">Save your preferences for later</div>
                    <div className="fine mt4">
                      Create an account to keep your dietary profile and receive
                      personalized RD recommendations.
                    </div>
                  </div>
                  <Link className="btn btn-p" to="/login?next=/preferences">
                    Sign in
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* RD plan recommendations */}
          {preferences && recommendations.length > 0 && (
            <div className="padx mt16">
              <div
                className="rounded-2xl border border-[var(--tnm-action)]/30 bg-[var(--tnm-action)]/10 p-4"
              >
                <div className="fx ac jb gap8 wrap mb10">
                  <span className="sh fx ac gap8">
                    <i className="ph-fill ph-stethoscope safc" />
                    RD plans matched to your profile
                  </span>
                  <Link className="linkq" to="/plans">
                    Browse all <i className="ph-bold ph-caret-right" />
                  </Link>
                </div>
                <div className="fx col gap8">
                  {recommendations.map(({ plan, reasons }: any) => (
                    <Link
                      key={plan.slug}
                      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 pointer"
                      to={`/plans/${plan.slug}`}
                      style={{ display: "block" }}
                    >
                      <span
                        className="pill"
                        style={{ background: "var(--safd)", color: "var(--safb)" }}
                      >
                        {PLAN_GOAL_LABEL[plan.goal as PlanGoal]}
                      </span>
                      <div className="dtitle">{plan.name}</div>
                      <div
                        className="fine sagec"
                        style={{
                          overflow: "hidden",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical" as any,
                        }}
                      >
                        {reasons[0]}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* DPDPA consent — reuse existing capture component verbatim */}
          <div className="padx mt16">
            <DpdpaConsentCapture
              initialState={consentState}
              onSubmit={handleConsentSubmit}
              isLoading={consentLoading}
            />
          </div>

          {/* Main preferences form */}
          <div className="padx mt16">
            <div className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4">
              <Field title="Dietary style">
                <div className="fx wrap gap8">
                  {(Object.keys(DIETARY_STYLE_LABEL) as DietaryStyle[]).map((d) => (
                    <Chip
                      key={d}
                      active={dietaryStyle === d}
                      onClick={() => setDietaryStyle(d)}
                    >
                      {DIETARY_STYLE_LABEL[d]}
                    </Chip>
                  ))}
                </div>
              </Field>

              <Divider />

              <Field title="Wellness goal">
                <div className="fx wrap gap8">
                  {(Object.keys(GOAL_LABEL) as WellnessGoal[]).map((g) => (
                    <Chip key={g} active={goal === g} onClick={() => setGoal(g)}>
                      {GOAL_LABEL[g]}
                    </Chip>
                  ))}
                </div>
              </Field>

              <Field title="Activity level">
                <div className="fx wrap gap8">
                  {(Object.keys(ACTIVITY_LABEL) as ActivityLevel[]).map((a) => (
                    <Chip
                      key={a}
                      active={activityLevel === a}
                      onClick={() => setActivityLevel(a)}
                    >
                      {ACTIVITY_LABEL[a]}
                    </Chip>
                  ))}
                </div>
              </Field>

              <Divider />

              <Field title="Cuisines you enjoy">
                <div className="fx wrap gap8">
                  {CUISINE_OPTIONS.map((c) => (
                    <Chip
                      key={c}
                      active={cuisines.includes(c)}
                      onClick={() => toggle(setCuisines, cuisines, c)}
                      style={{ textTransform: "capitalize" }}
                    >
                      {c}
                    </Chip>
                  ))}
                </div>
              </Field>

              <Field title="Spice tolerance">
                <div className="fx wrap gap8">
                  {(Object.keys(SPICE_LABEL) as SpiceLevel[]).map((s) => (
                    <Chip
                      key={s}
                      active={spiceLevel === s}
                      onClick={() => setSpiceLevel(s)}
                    >
                      {SPICE_LABEL[s]}
                    </Chip>
                  ))}
                </div>
              </Field>

              <Divider />

              <Field title="Clinical contraindications & medical conditions">
                <div className="fx wrap gap8">
                  {MEDICAL_CONDITION_OPTIONS.map((c) => (
                    <Chip
                      key={c}
                      active={medicalConditions.includes(c)}
                      onClick={() =>
                        toggle(setMedicalConditions, medicalConditions, c)
                      }
                      warning
                    >
                      {MEDICAL_CONDITION_LABEL[c as ClinicalContraindication]}
                    </Chip>
                  ))}
                </div>
              </Field>

              <Divider />

              <Field title="Allergens — these dishes are blocked">
                <div className="fx wrap gap8">
                  {ALLERGEN_OPTIONS.map((a) => (
                    <Chip
                      key={a}
                      active={allergens.includes(a)}
                      onClick={() => toggle(setAllergens, allergens, a)}
                      warning
                      style={{ textTransform: "capitalize" }}
                    >
                      {a}
                    </Chip>
                  ))}
                </div>
              </Field>

              <Field title="Disliked ingredients (comma-separated)">
                <div className="inp">
                  <i className="ph-bold ph-prohibit" />
                  <input
                    value={dislikes}
                    onChange={(e) => setDislikes(e.target.value)}
                    placeholder="e.g. mushrooms, olives, cilantro"
                    aria-label="Disliked ingredients"
                  />
                </div>
              </Field>

              <Divider />

              <Field title="Daily macro targets (optional)">
                <div className="grid gap12" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  <NumField
                    label="Calories"
                    value={calorieTarget}
                    onChange={setCalorieTarget}
                    placeholder="2000"
                  />
                  <NumField
                    label="Protein (g)"
                    value={proteinTargetGrams}
                    onChange={setProteinTargetGrams}
                    placeholder="120"
                  />
                  <NumField
                    label="Carbs (g)"
                    value={carbsTargetGrams}
                    onChange={setCarbsTargetGrams}
                    placeholder="220"
                  />
                  <NumField
                    label="Fat (g)"
                    value={fatTargetGrams}
                    onChange={setFatTargetGrams}
                    placeholder="60"
                  />
                </div>
              </Field>
            </div>
          </div>

          {/* How we use this */}
          <div className="padx mt16">
            <div className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4">
              <div className="fx ac gap8 safc mb8">
                <i className="ph-fill ph-sparkle" />
                <span className="tt">How we use this</span>
              </div>
              <p className="fine">
                The menu hides dishes that contain your allergens, deprioritizes
                dishes with disliked ingredients, surfaces a "Why this for you"
                hint when something matches, and shows a Smart Swap suggestion when
                a dish conflicts with your profile.
              </p>
            </div>
          </div>
        </div>

        {/* Sticky save bar */}
        <div
          className="fx ac gap12"
          style={{
            position: "sticky",
            bottom: 0,
            background: "var(--tnm-surface-ink)",
            borderTop: "1px solid white/[0.08]",
            padding: "12px 16px",
            zIndex: 10,
          }}
        >
          <span className="fine f1">
            Changes apply to future menu suggestions and meal plans.
          </span>
          <button
            className={saving ? "btn btn-p dis" : "btn btn-p"}
            onClick={handleSave}
            disabled={saving}
          >
            <i className="ph-bold ph-floppy-disk" />
            {saving ? "Saving…" : "Save preferences"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb20" style={{ marginBottom: 16 }}>
      <div className="lab mb10">{title}</div>
      {children}
    </div>
  );
}

function Divider() {
  return (
    <div style={{ height: 1, background: "var(--ln)", margin: "16px 0" }} />
  );
}

function Chip({
  active,
  onClick,
  children,
  warning = false,
  style,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  warning?: boolean;
  style?: React.CSSProperties;
}) {
  if (warning) {
    return (
      <button
        type="button"
        className="chip"
        onClick={onClick}
        style={{
          ...(active
            ? {
                background: "color-mix(in srgb, var(--color-nn-error) 14%, transparent)",
                borderColor: "var(--color-nn-error)",
                color: "var(--color-nn-error)",
              }
            : {}),
          ...style,
        }}
      >
        {children}
      </button>
    );
  }
  return (
    <button
      type="button"
      className={active ? "chip on" : "chip"}
      onClick={onClick}
      style={style}
    >
      {children}
    </button>
  );
}

function NumField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <div className="lab mb6">{label}</div>
      <div className="inp">
        <input
          type="number"
          inputMode="numeric"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
        />
      </div>
    </div>
  );
}
