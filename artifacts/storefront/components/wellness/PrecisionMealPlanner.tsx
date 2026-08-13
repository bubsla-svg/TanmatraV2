"use client";
import React, { Suspense, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  generatePrecisionPlan,
  getPrecisionPlanDraft,
  type PrecisionPlannerInput,
  type PrecisionPlanResult,
} from '@/lib/wellnessApi';
import { PrecisionPlannerFunnel } from './PrecisionPlannerFunnel';
import { PrecisionPlanResults } from './PrecisionPlanResults';

/** Wrapped in Suspense per Next's own requirement for useSearchParams in a
 *  statically-rendered parent — restoring a draft is the only reason this
 *  component needs the URL at all. */
export const PrecisionMealPlanner: React.FC = () => {
  return (
    <Suspense fallback={<PrecisionPlannerFunnel onGenerate={() => {}} loading />}>
      <PrecisionMealPlannerResolved />
    </Suspense>
  );
};

const PrecisionMealPlannerResolved: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const draftIdParam = searchParams.get('draft');

  const [plan, setPlan] = useState<PrecisionPlanResult | null>(null);
  // The draft id the plan was persisted under (see wellnessApi.generatePrecisionPlan) —
  // carried alongside the plan so the results screen can hand off to a real
  // checkout instead of a client-only value that vanishes on navigation, and
  // mirrored into the URL below so a reload doesn't lose it either.
  const [draftId, setDraftId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore-on-reload: a `?draft=` in the URL (set by handleGenerate below)
  // resolves the persisted plan instead of forcing the customer back through
  // the whole quiz. Guest ownership is cookie-gated server-side
  // (precisionPlanDraftAuth.ts) — a stale or someone-else's id just 404s.
  useEffect(() => {
    if (!draftIdParam || plan) return;
    let live = true;
    setLoading(true);
    getPrecisionPlanDraft(draftIdParam)
      .then((res) => {
        if (!live) return;
        setPlan(res.draft.result);
        setDraftId(res.draft.id);
      })
      .catch(() => {
        // Expired/foreign/unknown draft — fall back to the empty funnel
        // rather than an error; the customer can just generate a new one.
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally re-checks only when the URL id changes, not on every `plan` write
  }, [draftIdParam]);

  const handleGenerate = (input: PrecisionPlannerInput) => {
    setLoading(true);
    setError(null);
    generatePrecisionPlan(input)
      .then((res) => {
        if (res.plan) {
          setPlan(res.plan);
          setDraftId(res.draftId);
          router.replace(`${pathname}?draft=${encodeURIComponent(res.draftId)}`, { scroll: false });
        }
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to generate precision plan. Please try again.");
      })
      .finally(() => setLoading(false));
  };

  return (
    <div className="space-y-8">
      <PrecisionPlannerFunnel onGenerate={handleGenerate} loading={loading} />

      {error && (
        <div className="p-4 rounded-2xl bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-[var(--danger)] text-xs font-bold">
          {error}
        </div>
      )}

      {plan && draftId && <PrecisionPlanResults plan={plan} draftId={draftId} />}
    </div>
  );
};
