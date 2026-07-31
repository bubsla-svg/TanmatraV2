import { Skeleton } from "@/components/ui/skeleton";

/**
 * Menu route skeleton. Mirrors app/menu/page.tsx box for box — same
 * max-w-screen-xl shell, same diet-chip bar, same single-column MenuGrid — so
 * the catalog lands without moving anything. The row below reserves DishCard's
 * own fixed geometry: its 104px photo box, the 4px-gap text column that sums to
 * exactly 104px (20 title + 40 two-line excerpt + 16 stars + 16 macros), and
 * the min-h-11 Add button in the bordered footer.
 */
function DishRowSkeleton() {
  return (
    <div className="flex flex-col rounded-2xl border border-line bg-surface p-3">
      <div className="flex gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-[104px] w-[104px] shrink-0 rounded-2xl" />
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-11 w-16 rounded-lg" />
      </div>
    </div>
  );
}

export default function MenuLoading() {
  return (
    <div className="min-h-dvh">
      <p role="status" className="sr-only">
        Loading the menu…
      </p>
      <section className="mx-auto max-w-screen-xl px-4 py-8" aria-hidden>
        <div className="mb-6">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="mt-1 h-5 w-full max-w-md" />
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-[30px] w-16 rounded-full" />
              <Skeleton className="h-[30px] w-16 rounded-full" />
              <Skeleton className="h-[30px] w-24 rounded-full" />
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <DishRowSkeleton key={i} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
