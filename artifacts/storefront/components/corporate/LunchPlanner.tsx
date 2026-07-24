"use client";
// Admin lunch-planner island: capture the team diet profile → generate a
// constraint-aware weekly menu → schedule it (server fans out office_orders and
// enforces the per-employee budget). Session + admin gated. No money-path.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError } from "@/lib/apiClient";
import { getCompany } from "@/lib/companyApi";
import {
  getDietProfile, saveDietProfile, getCurrentPlan, generatePlan, schedulePlan,
  type TeamDietProfile, type LunchPlanProposal, type DietSurveyInput,
} from "@/lib/b2bPlannerApi";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";
import { DietProfileForm } from "./DietProfileForm";
import { LunchPlanPreview } from "./LunchPlanPreview";

const SCHEDULED_HOUR = 13;
const PER_EMPLOYEE_PAISE = 40000;
type Busy = null | "save" | "generate" | "schedule";

export function LunchPlanner({ slug }: { slug: string }) {
  const [profile, setProfile] = useState<TeamDietProfile | null>(null);
  const [proposal, setProposal] = useState<LunchPlanProposal | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "forbidden">("loading");
  const [needsAuth, setNeedsAuth] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const c = await getCompany(slug);
      if (c.membership?.role !== "admin") { setState("forbidden"); setNeedsAuth(false); return; }
      const [p, cur] = await Promise.all([getDietProfile(slug), getCurrentPlan(slug)]);
      setProfile(p.profile); setProposal(cur.proposal); setState("ready"); setNeedsAuth(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setNeedsAuth(true);
      else if (e instanceof ApiError && e.status === 403) setState("forbidden");
      else setState("missing");
    }
  }, [slug]);
  useEffect(() => { void load(); }, [load]);

  async function save(input: DietSurveyInput) {
    setBusy("save"); setError(null); setSaved(false);
    try { const r = await saveDietProfile(slug, input); setProfile(r.profile); setSaved(true); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Couldn't save the team profile."); }
    finally { setBusy(null); }
  }
  async function generate() {
    setBusy("generate"); setError(null);
    try { const r = await generatePlan(slug); setProposal(r.proposal); }
    catch (e) { setError(e instanceof ApiError && e.code === "profile_required" ? "Save the team profile first." : (e instanceof ApiError ? e.message : "Couldn't generate a plan.")); }
    finally { setBusy(null); }
  }
  async function schedule() {
    if (!proposal) return;
    setBusy("schedule"); setError(null);
    try { const r = await schedulePlan(proposal.id, { scheduledHour: SCHEDULED_HOUR, perEmployeeBudgetPaise: PER_EMPLOYEE_PAISE }); setProposal(r.proposal); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Couldn't schedule the plan."); }
    finally { setBusy(null); }
  }

  if (needsAuth) return (<div className="flex flex-col gap-4"><p className="text-sm text-ink-muted">Sign in to manage your team&rsquo;s lunches.</p><PhoneAuth onVerified={() => void load()} /></div>);
  if (state === "loading") return <p className="text-sm text-ink-muted">Loading…</p>;
  if (state === "forbidden") return <p className="text-sm text-ink-muted">The lunch planner is available to company admins only.</p>;
  if (state === "missing") return <p className="text-sm text-ink-muted">This company workspace isn&rsquo;t available to you.</p>;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href={`/corporate/${slug}`} className="text-sm font-medium text-gold-text hover:underline">&larr; Company workspace</Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-ink">Lunch planner</h1>
        <p className="mt-1 text-sm text-ink-muted">Set your team&rsquo;s diet profile, generate a week of lunches, then schedule them for the office.</p>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-ink">1 &middot; Team diet profile</h2>
        <p className="text-xs text-ink-faint">Drives which dishes the planner may pick.</p>
        <div className="mt-3"><DietProfileForm initial={profile} busy={busy === "save"} saved={saved} error={busy === "save" ? error : null} onSubmit={save} /></div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="text-sm font-semibold text-ink">2 &middot; Weekly plan</h2><p className="text-xs text-ink-faint">Generated against the saved profile.</p></div>
          <button type="button" onClick={generate} disabled={!profile || busy !== null} className="shrink-0 rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-[var(--gold-ink)] disabled:opacity-40">
            {busy === "generate" ? "Generating…" : proposal ? "Regenerate" : "Generate plan"}
          </button>
        </div>
        {error && busy !== "save" && <p role="alert" className="mt-2 text-xs font-medium text-[var(--danger)]">{error}</p>}
        <div className="mt-3"><LunchPlanPreview proposal={proposal} onSchedule={schedule} scheduling={busy === "schedule"} perEmployeePaise={PER_EMPLOYEE_PAISE} scheduledHour={SCHEDULED_HOUR} /></div>
      </section>
    </div>
  );
}
