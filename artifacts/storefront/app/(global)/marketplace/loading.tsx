import { Skeleton } from "@/components/ui/skeleton";

/**
 * Marketplace skeleton (audit 2026-09-17: the route rendered blank on a slow
 * connection). Mirrors page.tsx: the sticky title block, then the two-column
 * product grid — each card a bordered box with a square photo, two text
 * lines and the price/Add row.
 */
function ProductSkeleton() {
  return (
    <div className="flex flex-col rounded-2xl border border-line bg-surface p-3">
      <Skeleton className="mb-3 aspect-square w-full rounded-xl" />
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="mt-1.5 h-4 w-1/2" />
      <div className="mt-3 flex items-center justify-between">
        <Skeleton className="h-5 w-14" />
        <Skeleton className="h-11 w-full max-w-24 rounded-lg" />
      </div>
    </div>
  );
}

export default function MarketplaceLoading() {
  return (
    <div className="min-h-dvh bg-bg pb-24">
      <p role="status" className="sr-only">
        Loading the marketplace…
      </p>
      <div aria-hidden>
        <div className="sticky top-0 z-20 border-b border-line bg-bg/95 px-gutter pb-4 pt-4 backdrop-blur-md">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <div className="px-gutter pt-6">
          <div className="grid grid-cols-2 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <ProductSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
