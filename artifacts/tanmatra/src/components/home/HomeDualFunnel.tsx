import { Link } from "react-router";
import { ArrowRight, Check, UsersThree, ForkKnife } from "@phosphor-icons/react";
import { computeTrialPricePaise, TRIAL_DAYS, TRIAL_MEALS } from "@workspace/subscription-rules";
import { track } from "@/lib/analytics";
import { useSectionViewed } from "./useSectionViewed";

/**
 * S9 — Dual-funnel split (playbook §1.1/§1.3): one screen, two doors.
 * B2C = the lowest-commitment 3-Day Trial (no auto-renewal — already true,
 * said loudly); B2B = a single card with one promise and one CTA into the
 * corporate wellness LP. Never more than one screen of B2B on the consumer
 * homepage.
 *
 * Price comes from @workspace/subscription-rules — the exact module the
 * server's /subscriptions/quote and billing paths use (money-path lockstep,
 * playbook R4). computeTrialPricePaise is GST-inclusive.
 */

export default function HomeDualFunnel() {
  const sectionRef = useSectionViewed<HTMLElement>("dual_funnel");

  const trialPriceRupees = Math.round(
    computeTrialPricePaise(TRIAL_MEALS) / 100,
  ).toLocaleString("en-IN");

  return (
    <section ref={sectionRef} className="padx mt-12" aria-label="Start with Tanmatra">
      <div className="secrow px-0 flex flex-col items-start gap-1.5">
        <span className="text-[10px] uppercase font-mono tracking-widest text-white/45">
          Two ways to start
        </span>
        <h3 className="text-xl font-semibold tracking-tight text-white/90">
          For your desk, or the whole floor
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* ── FOR YOU — 3-Day Trial ─────────────────────────────────────── */}
        <div className="p-4 rounded-2xl border border-amber-400/40 bg-amber-400/[0.03] shadow-[0_8px_32px_rgba(251,191,36,0.1)] flex flex-col justify-between gap-4">
          <div>
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
              <ForkKnife className="w-3.5 h-3.5" weight="bold" aria-hidden />
              For you
            </span>
            <h4 className="mt-2 text-sm font-semibold tracking-tight text-white/95">
              3-Day Trial
            </h4>
            <p className="tnm-data mt-1.5 text-lg font-extrabold text-amber-400 leading-none">
              ₹{trialPriceRupees}
            </p>
            <p className="text-[10px] text-white/45 mt-1">
              {TRIAL_MEALS} lunches · {TRIAL_DAYS} days · one-time · incl. GST
            </p>
            <p className="mt-2 flex items-start gap-1.5 text-[11px] text-white/70 leading-snug">
              <Check
                className="w-3 h-3 text-amber-400 shrink-0 mt-0.5"
                weight="bold"
                aria-hidden
              />
              No auto-renewal
            </p>
          </div>
          <Link
            to="/subscribe?trial=1"
            onClick={() =>
              track("home_cta_click", {
                cta_id: "dual_funnel_start_trial",
                source: "dual_funnel",
              })
            }
            className="min-h-[44px] rounded-xl bg-amber-400 text-black text-xs font-bold flex items-center justify-center hover:brightness-110 active:scale-[0.98] transition-all motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            Start Trial
          </Link>
        </div>

        {/* ── FOR YOUR TEAM — corporate pilot ───────────────────────────── */}
        <div className="p-4 rounded-2xl border border-white/[0.06] bg-neutral-900/80 backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.3)] flex flex-col justify-between gap-4">
          <div>
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/50">
              <UsersThree className="w-3.5 h-3.5" weight="bold" aria-hidden />
              For your team
            </span>
            <p className="mt-2 text-sm font-semibold tracking-tight text-white/95 leading-snug">
              Subsidized RD-designed lunches for Noida teams
            </p>
          </div>
          <Link
            to="/corporate-wellness"
            onClick={() =>
              track("home_cta_click", {
                cta_id: "dual_funnel_get_pilot",
                source: "dual_funnel",
              })
            }
            className="min-h-[44px] rounded-xl bg-white/10 hover:bg-white/15 border border-white/[0.06] text-white text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            Get a pilot
            <ArrowRight className="w-3.5 h-3.5" weight="bold" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
