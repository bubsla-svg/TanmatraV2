import { AccountNav } from "@/components/account/AccountNav";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Orders skeleton. Same max-w-md shell as app/account/orders/page.tsx, and the
 * real AccountNav — it needs no data, so the tabs stay usable while the history
 * loads and the row below it never moves. Each row reserves OrderRow's box:
 * status + amount line, the date line, then the 28px track/reorder action row.
 */
function OrderRowSkeleton() {
  return (
    <li className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-5 w-16" />
      </div>
      <Skeleton className="mt-2 h-4 w-48" />
      <div className="mt-4 flex items-center gap-4">
        <Skeleton className="h-7 w-14" />
        <Skeleton className="h-7 w-20" />
      </div>
    </li>
  );
}

export default function OrdersLoading() {
  return (
    <section className="mx-auto max-w-md px-4 py-10">
      <p role="status" className="sr-only">
        Loading your orders…
      </p>
      <AccountNav active="orders" />
      <div aria-hidden>
        <Skeleton className="h-9 w-32" />
        <Skeleton className="mt-1 mb-8 h-5 w-full max-w-xs" />
        <ul className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <OrderRowSkeleton key={i} />
          ))}
        </ul>
      </div>
    </section>
  );
}
