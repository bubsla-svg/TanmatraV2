import { Skeleton } from "@/components/ui/skeleton";
import { CARE_BY_CONDITION_ENABLED } from "@/lib/flags";

/**
 * Care hub skeleton. Mirrors page.tsx's ruled stack (D-05B): CareHeader,
 * NeedStateRail + ConditionRail (both `layout="grid"` — two visible columns,
 * NOT the snap-rail's clipped 280px cards), then the NavEntryCard-shaped rows
 * (Assessment/Therapeutic/Trial/ClinicalSupport all share that one component).
 * The counts match the real content so the skeleton doesn't jump a row on
 * resolve — which is why it tracks CARE_BY_CONDITION_ENABLED too: with the
 * by-condition surface off the page resolves to 4 goals and two entry rows,
 * and a skeleton still reserving a 6-card condition rail would promise a
 * section that never arrives (and put "By condition" back on the page for a
 * screen reader).
 */
function RailSkeleton({ title, count }: { title: string; count: number }) {
  return (
    <div className="w-full py-4">
      <div className="mb-4 px-1">
        <Skeleton className="h-6 w-28" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: count }, (_, i) => (
          <Skeleton key={i} className="h-[76px] w-full rounded-xl" />
        ))}
      </div>
      <span className="sr-only">{title}</span>
    </div>
  );
}

function NavEntryCardSkeleton() {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-5">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-[18px] w-[18px] shrink-0 rounded-sm" />
    </div>
  );
}

export default function CareLoading() {
  return (
    <div className="min-h-dvh pb-24">
      <p role="status" className="sr-only">
        Loading care…
      </p>
      <section className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-12" aria-hidden>
        <Skeleton className="h-9 w-24" />
        <RailSkeleton title="By goal" count={4} />
        {CARE_BY_CONDITION_ENABLED && <RailSkeleton title="By condition" count={6} />}
        {CARE_BY_CONDITION_ENABLED && <NavEntryCardSkeleton />}
        <NavEntryCardSkeleton />
        <NavEntryCardSkeleton />
        {CARE_BY_CONDITION_ENABLED && <NavEntryCardSkeleton />}
      </section>
    </div>
  );
}
