import { FocusHeader } from "@/components/FocusHeader";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Trial skeleton. FocusHeader renders for real — no data, and the flow had a
 * documented history of shipping without a back affordance at all (its own
 * header comment) before this component existed, so loading is not the time
 * to drop it. Mirrors page.tsx below it: hero copy, TrialStart's track
 * toggle + trio + CTA, then the two secondary reassurance cards.
 */
export default function TrialLoading() {
  return (
    <div className="min-h-dvh">
      <p role="status" className="sr-only">
        Loading the taste test…
      </p>
      <section className="mx-auto flex max-w-md flex-col gap-8 px-4 pb-48 pt-6">
        <FocusHeader backLabel="Back to plans" />
        <div aria-hidden className="flex flex-col items-center gap-2">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-64" />
        </div>

        <div aria-hidden className="flex flex-col gap-5">
          <div className="flex justify-center gap-2">
            <Skeleton className="h-9 w-20 rounded-full" />
            <Skeleton className="h-9 w-24 rounded-full" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="aspect-square flex-1 rounded-2xl" />
            <Skeleton className="aspect-square flex-1 rounded-2xl" />
            <Skeleton className="aspect-square flex-1 rounded-2xl" />
          </div>
          <Skeleton className="h-12 w-full rounded-full" />
        </div>

        <div aria-hidden className="rounded-3xl border border-line bg-surface p-5">
          <Skeleton className="h-4 w-52" />
          <Skeleton className="mt-2 h-4 w-full" />
          <Skeleton className="mt-1 h-4 w-2/3" />
        </div>

        <div aria-hidden className="rounded-3xl border border-line bg-surface p-5">
          <Skeleton className="h-4 w-48" />
          <div className="mt-4 flex flex-col gap-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </div>
      </section>
    </div>
  );
}
