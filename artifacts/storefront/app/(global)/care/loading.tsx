import { Skeleton } from "@/components/ui/skeleton";

/**
 * Care hub skeleton. Mirrors page.tsx's ruled stack (D-05B): CareHeader,
 * two HorizontalSnapRails (NeedStateRail/ConditionRail — same min-w-[280px]
 * card geometry), then four NavEntryCard-shaped rows (Assessment/Therapeutic/
 * Trial/ClinicalSupport all share that one component).
 */
function RailSkeleton({ title }: { title: string }) {
  return (
    <div className="w-full py-4">
      <div className="mb-4 px-1">
        <Skeleton className="h-6 w-28" />
      </div>
      <div className="flex gap-4 overflow-x-hidden pb-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[76px] w-[280px] shrink-0 rounded-xl" />
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
        <RailSkeleton title="By goal" />
        <RailSkeleton title="By condition" />
        <NavEntryCardSkeleton />
        <NavEntryCardSkeleton />
        <NavEntryCardSkeleton />
        <NavEntryCardSkeleton />
      </section>
    </div>
  );
}
