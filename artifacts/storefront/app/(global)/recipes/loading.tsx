import { Skeleton } from "@/components/ui/skeleton";

/**
 * Recipes skeleton (audit 2026-09-17). Mirrors page.tsx: the sticky title
 * block, then a single column of recipe cards — a 16:9 photo, a title, a
 * mono meta line and a two-line summary.
 */
function RecipeSkeleton() {
  return (
    <div className="flex flex-col rounded-2xl border border-line bg-surface p-3">
      <Skeleton className="mb-3 aspect-video w-full rounded-xl" />
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="mt-2 h-3 w-28" />
      <Skeleton className="mt-3 h-4 w-full" />
      <Skeleton className="mt-1.5 h-4 w-4/5" />
    </div>
  );
}

export default function RecipesLoading() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg pb-24">
      <p role="status" className="sr-only">
        Loading recipes…
      </p>
      <div aria-hidden>
        <div className="sticky top-0 z-20 border-b border-line bg-bg/95 px-gutter pb-4 pt-4 backdrop-blur-md">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="mt-2 h-4 w-52" />
        </div>
        <div className="px-gutter pt-6">
          <div className="flex flex-col gap-4">
            {[0, 1, 2].map((i) => (
              <RecipeSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
