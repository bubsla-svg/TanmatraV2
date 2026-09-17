import { Skeleton } from "@/components/ui/skeleton";

/**
 * Meal-planner skeleton (audit 2026-09-17). Mirrors page.tsx's max-w-lg
 * column: eyebrow, title, intro, then the planner's day cards.
 */
export default function MealPlannerLoading() {
  return (
    <div className="min-h-dvh">
      <p role="status" className="sr-only">
        Loading your meal planner…
      </p>
      <section className="mx-auto max-w-lg px-4 py-10" aria-hidden>
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-3 h-9 w-64" />
        <Skeleton className="mt-3 h-4 w-full" />
        <Skeleton className="mt-1.5 h-4 w-5/6" />
        <div className="mt-8 flex flex-col gap-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-3">
              <Skeleton className="h-16 w-16 shrink-0 rounded-xl" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
