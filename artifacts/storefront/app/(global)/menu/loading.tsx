import { Skeleton } from "@/components/ui/skeleton";

/**
 * Menu route skeleton. Mirrors app/(global)/menu/page.tsx box for box — same
 * max-w-screen-xl shell, same sticky control strip, same MenuGrid shape after
 * T4 (CRO handoff, 17 Sep 2026): ONE photo-led hero DishCard at the top of the
 * section, then compact DishRows. The hero reserves the card's 1.12-aspect
 * photo box and its text stack; each row reserves DishRow's fixed geometry —
 * a 72px thumbnail inside 4px of vertical padding (80px per row) with the
 * min-h-11 Add on the right — so the catalog lands without moving anything.
 */
function HeroCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
      <Skeleton className="aspect-[1.12] w-full rounded-none" />
      <div className="flex flex-col gap-2 p-5 pb-0">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-6 w-32 rounded-full" />
      </div>
      <div className="mt-4 flex items-center justify-between p-5 pt-0">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-11 w-16 rounded-lg" />
      </div>
    </div>
  );
}

function DishRowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-1">
      <Skeleton className="h-[72px] w-[72px] shrink-0 rounded-xl" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-5 w-40" />
      </div>
      <Skeleton className="h-11 w-16 shrink-0 rounded-lg" />
    </div>
  );
}

export default function MenuLoading() {
  return (
    <div className="min-h-dvh">
      <p role="status" className="sr-only">
        Loading the menu…
      </p>
      <section className="mx-auto max-w-screen-xl px-4 pb-8 pt-3" aria-hidden>
        <div className="flex flex-col gap-4">
          <div className="flex min-h-16 items-center gap-1.5 py-2">
            <Skeleton className="h-11 w-16 rounded-full" />
            <Skeleton className="h-11 w-16 rounded-full" />
            <Skeleton className="h-11 w-24 rounded-full" />
          </div>
          <Skeleton className="h-6 w-40" />
          <div className="grid grid-cols-1 divide-y divide-line sm:grid-cols-2 sm:gap-y-2 sm:divide-y-0 lg:grid-cols-3">
            <div className="pb-2 sm:col-span-full sm:max-w-md">
              <HeroCardSkeleton />
            </div>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <DishRowSkeleton key={i} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
