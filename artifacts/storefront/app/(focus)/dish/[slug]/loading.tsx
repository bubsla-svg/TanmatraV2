import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * PDP skeleton. Mirrors page.tsx box for box: the aspect-square/aspect-video
 * hero, the pill-badge row, title + description, the 3-column macro strip
 * (with its dividers, so the row height never shifts), two accordion rows at
 * AccordionItem's real min-h-[44px], and the sticky buy ledger. The back
 * button renders for real — same reasoning as OrdersLoading's AccountNav: it
 * needs no data, so a visitor never loses their way out while the dish loads.
 */
function MacroSkeleton() {
  return (
    <div className="flex-1">
      <Skeleton className="mb-1 h-3 w-14" />
      <Skeleton className="h-4 w-10" />
    </div>
  );
}

function AccordionRowSkeleton({ withSubtitle }: { withSubtitle?: boolean }) {
  return (
    <div className="flex min-h-[44px] items-center justify-between border-b border-line py-4 last:border-b-0">
      <div>
        <Skeleton className="h-4 w-32" />
        {withSubtitle && <Skeleton className="mt-1.5 h-3 w-40" />}
      </div>
      <Skeleton className="h-8 w-8 rounded-lg" />
    </div>
  );
}

export default function DishLoading() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg pb-24">
      <p role="status" className="sr-only">
        Loading dish…
      </p>
      <div className="relative aspect-square w-full overflow-hidden md:aspect-video">
        <Skeleton className="h-full w-full rounded-none" />
        <Link
          href="/menu"
          aria-label="Back to menu"
          className="absolute left-4 top-4 flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line bg-bg/80 text-lg text-ink backdrop-blur-md transition-transform active:scale-[0.98]"
        >
          <span aria-hidden>←</span>
        </Link>
      </div>

      <div className="flex flex-1 flex-col px-gutter pt-6" aria-hidden>
        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <Skeleton className="h-6 w-14 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="mb-2 h-8 w-3/4" />
          <Skeleton className="mb-1 h-4 w-full" />
          <Skeleton className="mb-4 h-4 w-2/3" />
          <div className="flex items-center gap-4 border-y border-line py-4">
            <MacroSkeleton />
            <div className="h-8 w-px bg-line" />
            <MacroSkeleton />
            <div className="h-8 w-px bg-line" />
            <MacroSkeleton />
          </div>
        </div>

        <div className="mb-8 flex-1">
          <AccordionRowSkeleton withSubtitle />
          <AccordionRowSkeleton />
          <Skeleton className="mt-4 h-4 w-48" />
        </div>

        <div className="sticky bottom-4 w-full rounded-3xl border border-line bg-bg/95 p-4 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-6 w-16" />
            </div>
            <Skeleton className="h-11 w-28 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
