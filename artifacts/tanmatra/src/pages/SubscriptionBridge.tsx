import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { subscriptionsApi } from "@/lib/subscriptionsApi";
import { formatCurrency } from "@/lib/utils";

export const meta = () => [
  { title: "Trial Recap & Upgrade | Tanmatra" },
  { name: "robots", content: "noindex, follow" },
];

export const handle = { chrome: false };

interface RecapData {
  stats: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  };
  holdExpiration: string;
}

// Plan pricing (paise). The saving badge below is DERIVED from these so it can
// never drift from the prices actually shown to the user. Weekly is the
// flexible tier and has no discount baseline of its own, so it shows no saving
// figure; fortnightly is genuinely cheaper per week than weekly, and that — and
// only that — is what the badge states.
const PLAN_WEEKLY_PAISE = 380000;
const PLAN_FORTNIGHTLY_PAISE = 741000;
const FORTNIGHTLY_SAVING_PCT = (
  (1 - PLAN_FORTNIGHTLY_PAISE / 2 / PLAN_WEEKLY_PAISE) * 100
).toFixed(1);

export default function SubscriptionBridge() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const subscriptionId = searchParams.get("subscription_id");
  
  const [loading, setLoading] = useState(true);
  const [recap, setRecap] = useState<RecapData | null>(null);
  const [timeLeft, setTimeLeft] = useState<{ expired: boolean; hours: number; minutes: number } | null>(null);
  const [showComparison, setShowComparison] = useState(false);

  useEffect(() => {
    if (!subscriptionId) {
      toast.error("Subscription ID is required");
      setLoading(false);
      return;
    }
    
    subscriptionsApi
      .trialRecap(Number(subscriptionId))
      .then((data) => {
        setRecap(data);
        setLoading(false);
      })
      .catch((err) => {
        toast.error("Failed to load trial results", {
          description: err instanceof Error ? err.message : "Please check your connection.",
        });
        setLoading(false);
      });
  }, [subscriptionId]);

  useEffect(() => {
    if (!recap?.holdExpiration) return;
    const target = new Date(recap.holdExpiration).getTime();

    const updateTimer = () => {
      const now = Date.now();
      if (now >= target) {
        setTimeLeft({ expired: true, hours: 0, minutes: 0 });
      } else {
        const diff = target - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setTimeLeft({ expired: false, hours, minutes });
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 30000); // update every 30 seconds
    return () => clearInterval(interval);
  }, [recap?.holdExpiration]);

  if (loading) {
    return (
      <div className="tnm2 nn" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div style={{ textAlign: "center" }}>
          <div className="mono fine">Loading your 3-day results...</div>
        </div>
      </div>
    );
  }

  if (!subscriptionId || !recap) {
    return (
      <div className="tnm2 nn" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 24 }}>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <i className="ph-bold ph-warning-circle dgrc" style={{ fontSize: 48 }} />
          <h1 className="h1 mt12">Trial details not found</h1>
          <p className="fine mt6 text-stone-500">We couldn't retrieve the details of this trial subscription.</p>
          <div className="mt24">
            <Link to="/" className="btn btn-p w100">Back to Dashboard</Link>
          </div>
        </div>
      </div>
    );
  }

  const start6WeekPlanUrl = `/subscribe?plan=healthy-everyday-plan&cadence=weekly&slots=lunch&daysMode=weekdays&duration=6`;

  return (
    <div className="tnm2 nn" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        {/* AppBar */}
        <div className="appbar">
          <Link className="iconbtn" to="/" aria-label="Home">
            <i className="ph-bold ph-arrow-left" />
          </Link>
          <div className="abt">Your 3-day results</div>
        </div>

        <div className="content padx" style={{ paddingTop: 16, paddingBottom: 40 }}>
          {/* Header Title */}
          <div className="tc mb20">
            <h1 className="disp" style={{ color: "var(--color-stone-0)" }}>Your 3-Day Recap</h1>
            <p className="fine mt4">Here is a summary of the meals delivered during your trial</p>
          </div>

          {/* Stats Recap Card */}
          <div className="card mb16">
            <div className="lab fx ac gap8 mb12" style={{ fontSize: 13 }}>
              <i className="ph-bold ph-chart-bar safc" /> Delivered Nutrition
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb12">
              <div className="p-3 bg-stone-50 rounded-lg text-center">
                <span className="text-2xl font-bold block" style={{ color: "var(--tx)" }}>
                  {recap.stats.calories.toLocaleString("en-IN")}
                </span>
                <span className="fine text-stone-500 block mt1">Total Calories</span>
              </div>
              <div className="p-3 bg-stone-50 rounded-lg text-center">
                <span className="text-2xl font-bold block" style={{ color: "var(--tx)" }}>
                  {recap.stats.protein}g
                </span>
                <span className="fine text-stone-500 block mt1">Protein</span>
              </div>
              <div className="p-3 bg-stone-50 rounded-lg text-center">
                <span className="text-2xl font-bold block" style={{ color: "var(--tx)" }}>
                  {recap.stats.carbs}g
                </span>
                <span className="fine text-stone-500 block mt1">Carbohydrates</span>
              </div>
              <div className="p-3 bg-stone-50 rounded-lg text-center">
                <span className="text-2xl font-bold block" style={{ color: "var(--tx)" }}>
                  {recap.stats.fat}g
                </span>
                <span className="fine text-stone-500 block mt1">Fat</span>
              </div>
            </div>

            <div className="p-3 bg-stone-50 rounded-lg text-center">
              <span className="text-xl font-bold block" style={{ color: "var(--tx)" }}>
                {recap.stats.fiber}g
              </span>
              <span className="fine text-stone-500 block mt1">Total Dietary Fiber</span>
            </div>

            {/* Verbatim Disclaimer */}
            <p className="fine tc mt12" style={{ fontSize: 10.5, fontStyle: "italic", color: "var(--mut)" }}>
              "These are your delivered meals and their measured totals — not a health outcome."
            </p>
          </div>

          {/* Capacity Hold Countdown Card */}
          {timeLeft && (
            <div className="card mb16">
              {timeLeft.expired ? (
                <div className="fx gap10" style={{ alignItems: "flex-start" }}>
                  <i className="ph-bold ph-warning-circle dgrc mt2" style={{ fontSize: 18, flex: "none" }} />
                  <div>
                    <span className="lab dgrc" style={{ fontWeight: 600 }}>Capacity hold expired</span>
                    <p className="fine mt2" style={{ fontSize: 11.5 }}>
                      Your kitchen capacity hold has expired. Converting now is subject to slot availability.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="fx gap10" style={{ alignItems: "flex-start" }}>
                  <i className="ph-bold ph-clock safc mt2" style={{ fontSize: 18, flex: "none" }} />
                  <div>
                    <span className="lab safc" style={{ fontWeight: 600 }}>Kitchen slot reserved</span>
                    <p className="fine mt2" style={{ fontSize: 11.5 }}>
                      Convert to a subscription within the next{" "}
                      <strong className="mono" style={{ color: "var(--tx)" }}>
                        {timeLeft.hours}h {timeLeft.minutes}m
                      </strong>{" "}
                      to lock in your slot.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Recommended Next Step Card */}
          <div className="card mb20 text-center" style={{ border: "1px solid var(--saf)" }}>
            <span className="pill sg mb8" style={{ background: "var(--safd)", color: "var(--safb)" }}>
              Recommended Next Step
            </span>
            <h3 className="h3 font-bold" style={{ color: "var(--tx)" }}>Keep the momentum going</h3>
            <p className="fine mt4">
              Keep your delivery cadence consistent with our <strong>5 meals/week plan</strong>. Autopay keeps it seamless.
            </p>
            <div className="mt16 p-3 bg-stone-50 rounded-lg text-left fx ac jb">
              <div>
                <span className="block font-semibold" style={{ fontSize: 13, color: "var(--tx)" }}>
                  5 Meals per Week Plan
                </span>
                <span className="fine text-stone-500">Weekly weekdays lunch drop</span>
              </div>
              <span className="price safc" style={{ fontSize: 14 }}>
                {formatCurrency(PLAN_WEEKLY_PAISE)}<span className="fntc" style={{ fontSize: 10 }}>/wk</span>
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="fx flex-col gap8">
            <Link to={start6WeekPlanUrl} className="btn btn-p w100 text-center py12">
              Start my 6-week plan
            </Link>
            
            <button 
              onClick={() => setShowComparison(true)}
              className="btn btn-g w100 text-center py12"
            >
              Compare payment schedules
            </button>
            
            <Link to="/" className="btn w100 text-center py12 text-stone-600 hover:text-stone-900" style={{ border: "1px solid var(--ln)" }}>
              Decide later
            </Link>
          </div>
        </div>
      </div>

      {/* Comparison Modal/Popup */}
      {showComparison && (
        <div className="modal-backdrop">
          <div className="bg-white w-full rounded-t-2xl p-6" style={{ maxWidth: 480, animation: "slideUp 0.2s ease-out" }}>
            <div className="fx ac jb mb16">
              <h3 className="h3 font-bold" style={{ color: "var(--tx)" }}>Payment Schedules</h3>
              <button onClick={() => setShowComparison(false)} className="iconbtn" aria-label="Close">
                <i className="ph-bold ph-x" />
              </button>
            </div>
            
            <div className="fx flex-col gap12 mb20">
              <div className="p-4 border rounded-xl" style={{ borderColor: "var(--saf)" }}>
                <div className="fx ac jb">
                  <span className="font-bold" style={{ color: "var(--tx)" }}>Weekly Billing</span>
                  <span className="pill sg">Flexible</span>
                </div>
                <p className="fine mt4">{formatCurrency(PLAN_WEEKLY_PAISE)} billed every week.</p>
                <p className="fine mt2 text-stone-500">Best for flexibility. Pause or edit anytime before Thursday cutoff.</p>
              </div>

              <div className="p-4 border rounded-xl" style={{ borderColor: "var(--ln)" }}>
                <div className="fx ac jb">
                  <span className="font-bold text-stone-700">Fortnightly Billing</span>
                  <span className="pill sg" style={{ background: "var(--safd)", color: "var(--safb)" }}>Save {FORTNIGHTLY_SAVING_PCT}% vs weekly</span>
                </div>
                <p className="fine mt4">{formatCurrency(PLAN_FORTNIGHTLY_PAISE)} billed every 2 weeks.</p>
                <p className="fine mt2 text-stone-500">Save more while retaining control. Skip individual weeks to earn credits.</p>
              </div>
            </div>

            <button 
              onClick={() => setShowComparison(false)}
              className="btn btn-p w100 text-center py12"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
