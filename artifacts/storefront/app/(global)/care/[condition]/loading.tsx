import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Care condition skeleton. Mirrors page.tsx: the real back-link (no data
 * needed, keeps the escape hatch live), title + description, the
 * AssessmentEntryCard-shaped row, then the bordered objectives/CTA card.
 */
export default function CareConditionLoading() {
  return (
    <div className="min-h-dvh pb-24">
      <p role="status" className="sr-only">
        Loading care plan…
      </p>
      <section className="mx-auto max-w-xl px-4 py-12">
        <Link href="/care" className="text-xs font-semibold text-primary hover:underline">
          &larr; Back to Care Directory
        </Link>
        <div aria-hidden>
          <Skeleton className="mt-4 h-8 w-2/3" />
          <Skeleton className="mt-2 h-4 w-full" />
          <Skeleton className="mt-1 h-4 w-4/5" />

          <div className="mt-6">
            <Skeleton className="h-[70px] w-full rounded-2xl" />
          </div>

          <div className="mt-6 rounded-2xl border border-line bg-surface p-6">
            <Skeleton className="h-5 w-40" />
            <div className="mt-3 flex flex-col gap-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-3 w-3/4" />
            </div>
            <Skeleton className="mt-6 h-12 w-full rounded-full" />
          </div>
        </div>
      </section>
    </div>
  );
}
