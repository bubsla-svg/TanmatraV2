"use client";
// Admin lunch-planner island: capture the team diet profile → generate a
// constraint-aware weekly menu → schedule it (server fans out office_orders and
// enforces the per-employee budget). Session + admin gated. No money-path.
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/apiClient";
import { getCompany } from "@/lib/companyApi";
import {
  getDietProfile, saveDietProfile, getCurrentPlan, generatePlan, schedulePlan,
  type TeamDietProfile, type LunchPlanProposal, type DietSurveyInput,
} from "@/lib/b2bPlannerApi";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";
import { Button } from "@/components/ui/button";
import { DietProfileForm } from "./DietProfileForm";
import { LunchPlanPreview } from "./LunchPlanPreview";

const SCHEDULED_HOUR = 13;
const PER_EMPLOYEE_PAISE = 40000;

type PlannerData = { profile: TeamDietProfile | null; proposal: LunchPlanProposal | null };

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback;
}

export function LunchPlanner({ slug }: { slug: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["corporate", "lunch-planner", slug];

  const plannerQuery = useQuery({
    queryKey,
    queryFn: async (): Promise<PlannerData> => {
      const c = await getCompany(slug);
      if (c.membership?.role !== "admin") throw new ApiError(403, "admin only", "admin only");
      const [p, cur] = await Promise.all([getDietProfile(slug), getCurrentPlan(slug)]);
      return { profile: p.profile, proposal: cur.proposal };
    },
  });

  const setPlannerData = (patch: Partial<PlannerData>) =>
    queryClient.setQueryData<PlannerData>(queryKey, (old) => (old ? { ...old, ...patch } : old));

  const saveMutation = useMutation({
    mutationFn: (input: DietSurveyInput) => saveDietProfile(slug, input),
    onSuccess: (r) => setPlannerData({ profile: r.profile }),
  });
  const generateMutation = useMutation({
    mutationFn: () => generatePlan(slug),
    onSuccess: (r) => setPlannerData({ proposal: r.proposal }),
  });
  const scheduleMutation = useMutation({
    mutationFn: (input: { id: number; scheduledHour: number; perEmployeeBudgetPaise: number }) =>
      schedulePlan(input.id, { scheduledHour: input.scheduledHour, perEmployeeBudgetPaise: input.perEmployeeBudgetPaise }),
    onSuccess: (r) => setPlannerData({ proposal: r.proposal }),
  });

  function schedule() {
    const proposal = plannerQuery.data?.proposal;
    if (!proposal) return;
    scheduleMutation.mutate({ id: proposal.id, scheduledHour: SCHEDULED_HOUR, perEmployeeBudgetPaise: PER_EMPLOYEE_PAISE });
  }

  const needsAuth = plannerQuery.error instanceof ApiError && plannerQuery.error.status === 401;
  const forbidden = plannerQuery.error instanceof ApiError && plannerQuery.error.status === 403;
  const notFound = plannerQuery.error instanceof ApiError && plannerQuery.error.status === 404;

  if (needsAuth) return (<div className="flex flex-col gap-4"><p className="text-sm text-ink-muted">Sign in to manage your team&rsquo;s lunches.</p><PhoneAuth startExpanded onVerified={() => void plannerQuery.refetch()} /></div>);
  if (plannerQuery.isPending) return <p className="text-sm text-ink-muted">Loading…</p>;
  if (forbidden) return <p className="text-sm text-ink-muted">The lunch planner is available to company admins only.</p>;
  if (notFound) return <p className="text-sm text-ink-muted">This company workspace isn&rsquo;t available to you.</p>;
  if (plannerQuery.isError) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-6">
        <p className="text-sm text-ink-muted">Couldn&rsquo;t load the lunch planner. Please try again.</p>
        <button type="button" onClick={() => void plannerQuery.refetch()} className="shrink-0 text-sm font-semibold text-primary hover:underline">Try again</button>
      </div>
    );
  }

  const { profile, proposal } = plannerQuery.data;
  const generateErrorFinal = generateMutation.isError
    ? (generateMutation.error instanceof ApiError && generateMutation.error.code === "profile_required"
        ? "Save the team profile first."
        : errorMessage(generateMutation.error, "Couldn't generate a plan."))
    : null;
  const scheduleError = scheduleMutation.isError ? errorMessage(scheduleMutation.error, "Couldn't schedule the plan.") : null;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href={`/corporate/${slug}`} className="text-sm font-medium text-primary hover:underline">&larr; Company workspace</Link>
        <h1 className="mt-2 font-display text-xl font-semibold tracking-tight text-primary">Lunch planner</h1>
        <p className="mt-1 text-sm text-ink-muted">Set your team&rsquo;s diet profile, generate a week of lunches, then schedule them for the office.</p>
      </div>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight text-primary">1 &middot; Team diet profile</h2>
          <p className="mt-0.5 text-sm text-ink-muted">Drives which dishes the planner may pick.</p>
        </div>
        <DietProfileForm
          initial={profile}
          busy={saveMutation.isPending}
          saved={saveMutation.isSuccess}
          error={saveMutation.isError ? errorMessage(saveMutation.error, "Couldn't save the team profile.") : null}
          onSubmit={(input) => saveMutation.mutate(input)}
        />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight text-primary">2 &middot; Weekly plan</h2>
            <p className="mt-0.5 text-sm text-ink-muted">Generated against the saved profile.</p>
          </div>
          <Button type="button" onClick={() => generateMutation.mutate()} disabled={!profile || saveMutation.isPending || generateMutation.isPending || scheduleMutation.isPending} aria-busy={generateMutation.isPending} aria-live="polite" shape="pill" size="fluid" className="shrink-0 px-4 py-2 font-semibold disabled:opacity-40">
            {generateMutation.isPending ? "Generating…" : proposal ? "Regenerate" : "Generate plan"}
          </Button>
        </div>
        {generateErrorFinal && <p role="alert" className="text-xs font-medium text-[var(--danger)]">{generateErrorFinal}</p>}
        {scheduleError && <p role="alert" className="text-xs font-medium text-[var(--danger)]">{scheduleError}</p>}
        <LunchPlanPreview proposal={proposal} onSchedule={schedule} scheduling={scheduleMutation.isPending} perEmployeePaise={PER_EMPLOYEE_PAISE} scheduledHour={SCHEDULED_HOUR} />
      </section>
    </div>
  );
}
