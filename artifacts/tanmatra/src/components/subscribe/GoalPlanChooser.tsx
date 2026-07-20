import { useMemo } from "react";
import { Link } from "react-router";
import { planCardPricePaise,
  RD_PLANS,
  PLAN_GOAL_LABEL,
  getRdAuthor,
  formatRupees,
  type RdPlan,
} from "@/lib/rdPlans";
import { GOAL_LABEL, type UserPreferences } from "@/lib/preferencesApi";

const TRIAL_SLUG = "three-day-trial-pack";

interface GoalPlanChooserProps {
  preferences: UserPreferences | null;
  onSelect: (slug: string) => void;
}

/**
 * Bare-entry state for /subscribe: instead of an empty configurator with no
 * plan items, offer a goal-first chooser over the real RD plans. Selecting a
 * plan sets `?plan=<slug>` (via the parent's setSearchParams) so the flow
 * continues through the existing, unchanged plan render path.
 */
export default function GoalPlanChooser({
  preferences,
  onSelect,
}: GoalPlanChooserProps) {
  const userGoal = preferences?.goal ?? null;

  const matchesUserGoal = (plan: RdPlan) =>
    userGoal !== null && plan.matchesGoals.includes(userGoal);

  // Matched plans float to the top; otherwise keep the curated data order.
  // Array.prototype.sort is stable, so non-matching plans keep their order.
  const ordered = useMemo(
    () =>
      [...RD_PLANS].sort(
        (a, b) => Number(matchesUserGoal(b)) - Number(matchesUserGoal(a)),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userGoal],
  );

  return (
    <div>
      {/* Hero */}
      <div className="tc mb16">
        <span className="lab" style={{ color: "var(--safb)" }}>
          Tanmatra Plans
        </span>
        <h1 className="disp mt6" style={{ color: "var(--color-stone-0)" }}>
          What&rsquo;s your goal?
        </h1>
        <p className="fine mt6">
          Every plan below is a real weekly rotation authored by an in-house
          registered dietitian. Pick a goal to load its week — you&rsquo;ll
          set cadence, delivery window and address on the next step.
        </p>
      </div>

      {/* Trial vs recurring, up front — same terms the configurator applies. */}
      <div className="card mb16" style={{ padding: "12px 14px" }}>
        <div className="fx gap8" style={{ alignItems: "flex-start" }}>
          <i className="ph-bold ph-flask safc" style={{ marginTop: 2, flex: "none" }} />
          <p className="fine" style={{ fontSize: 11 }}>
            <span style={{ color: "var(--tx)", fontWeight: 600 }}>3-Day Trial Pack</span>
            {" "}— one-off, 25% off, does not auto-renew.
          </p>
        </div>
        <div className="fx gap8 mt6" style={{ alignItems: "flex-start" }}>
          <i className="ph-bold ph-arrows-clockwise safc" style={{ marginTop: 2, flex: "none" }} />
          <p className="fine" style={{ fontSize: 11 }}>
            <span style={{ color: "var(--tx)", fontWeight: 600 }}>All other plans</span>
            {" "}— recurring weekly, fortnightly or monthly deliveries. Pause,
            skip a delivery (meals roll over as credits) or cancel anytime.
          </p>
        </div>
      </div>

      {ordered.map((plan) => {
        const rd = getRdAuthor(plan);
        const matched = matchesUserGoal(plan);
        const isTrialPack = plan.slug === TRIAL_SLUG;
        return (
          <div
            key={plan.slug}
            className="card mb12"
            style={matched ? { borderColor: "var(--saf)" } : undefined}
          >
            <div className="fx ac jb gap8">
              <span
                className="pill"
                style={{ background: "var(--safd)", color: "var(--safb)" }}
              >
                {PLAN_GOAL_LABEL[plan.goal]}
              </span>
              <span className="price safc nowrap" style={{ fontSize: 14 }}>
                {formatRupees(planCardPricePaise(plan))}
                <span className="fntc" style={{ fontSize: 11 }}>
                  {isTrialPack ? " one-off" : " /wk"}
                </span>
              </span>
            </div>
            {/* Reserved badge row — fixed height so the card doesn't jump
                when preferences load in and the match badge appears. */}
            <div className="fx ac" style={{ minHeight: 24, marginTop: 4 }}>
              {matched && userGoal && (
                <span className="pill sg">
                  <i className="ph-fill ph-sparkle" />
                  Matches your goal · {GOAL_LABEL[userGoal]}
                </span>
              )}
            </div>
            <div className="tt" style={{ color: "var(--color-stone-0)" }}>
              {plan.name}
            </div>
            <p className="fine clamp1 mt4">{plan.description}</p>
            {rd && <div className="lab mt6">By {rd.name}, RD</div>}
            <Link
              to={`/subscribe?plan=${plan.slug}`}
              className="btn btn-g w100 mt10 inline-flex items-center justify-center"
            >
              View this plan
              <i className="ph-bold ph-arrow-right" />
            </Link>
          </div>
        );
      })}

      <p className="fine tc mt6 mb16" style={{ fontSize: 11 }}>
        Want the full week, macros and RD notes first?{" "}
        <Link to="/plans" className="safc" style={{ textDecoration: "underline" }}>
          Browse all RD plans
        </Link>
        .
      </p>
    </div>
  );
}
