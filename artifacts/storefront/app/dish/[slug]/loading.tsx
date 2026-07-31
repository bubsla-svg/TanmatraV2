import { Skeleton } from "@/components/ui/skeleton";

/**
 * PDP skeleton. Mirrors app/dish/[slug]/page.tsx in order and geometry: back
 * link, DishGallery's 16/9 hero plus its 58px thumbnail strip, the title/price
 * row (price 28px + the 44px AddToCart on the right), the 4-up macro grid, and
 * DishSpec's chip row + 2-up nutrition cards. Card boxes are the real ones
 * (same border, radius and padding), so only the text inside is a placeholder.
 */
export default function DishLoading() {
  return (
    <div className="min-h-dvh">
      <p role="status" className="sr-only">
        Loading dish…
      </p>
      <article className="mx-auto max-w-3xl px-4 py-8" aria-hidden>
        <Skeleton className="h-5 w-20" />

        <div className="mt-4">
          <Skeleton className="aspect-[16/9] w-full rounded-3xl" />
          <div className="mt-3 flex gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[58px] w-[82px] shrink-0 rounded-2xl" />
            ))}
          </div>
        </div>

        <div className="mt-5 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="mt-2 h-5 w-full" />
            <Skeleton className="mt-1.5 h-5 w-5/6" />
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-11 w-16 rounded-lg" />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border border-line bg-surface p-3">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="mt-1 h-5 w-14" />
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-5">
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-[26px] w-20 rounded-full" />
            <Skeleton className="h-[26px] w-16 rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[0, 1].map((i) => (
              <div key={i} className="rounded-3xl border border-line bg-surface p-4">
                <Skeleton className="h-4 w-14" />
                <Skeleton className="mt-1 h-5 w-16" />
              </div>
            ))}
          </div>
        </div>
      </article>
    </div>
  );
}
