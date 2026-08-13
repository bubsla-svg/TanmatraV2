import { Skeleton } from "@/components/ui/skeleton";

/**
 * Plans skeleton. Mirrors page.tsx's stack: GoalRouter's rounded-3xl answer
 * buttons, TrialCard's outlined block, then PlanCardStitch's title/subtitle +
 * tag-pill + price-row shape for the "other plans" list.
 */
function RouterButtonSkeleton() {
  return <Skeleton className="h-[68px] w-full rounded-3xl" />;
}

function PlanCardSkeleton() {
  return (
    <div className="flex flex-col gap-6 rounded-3xl border border-line bg-surface p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-4/5" />
        </div>
        <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
      </div>
      <div className="flex items-baseline justify-between">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-4 w-14" />
      </div>
    </div>
  );
}

export default function PlansLoading() {
  return (
    <div className="min-h-dvh">
      <p role="status" className="sr-only">
        Loading plans…
      </p>
      <section className="mx-auto flex max-w-md flex-col gap-10 px-4 py-10" aria-hidden>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-48" />
          <div className="flex flex-col gap-3">
            <RouterButtonSkeleton />
            <RouterButtonSkeleton />
            <RouterButtonSkeleton />
          </div>
        </div>

        <Skeleton className="h-[152px] w-full rounded-3xl" />

        <div className="flex flex-col gap-4">
          <Skeleton className="h-4 w-40" />
          <div className="flex flex-col gap-5">
            <PlanCardSkeleton />
            <PlanCardSkeleton />
          </div>
        </div>
      </section>
    </div>
  );
}
