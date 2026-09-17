import { Skeleton } from "@/components/ui/skeleton";

/**
 * Wallet & vouchers skeleton (audit 2026-09-17). Mirrors page.tsx's max-w-md
 * column: eyebrow, title, intro, the balance card and the redeem field.
 */
export default function VouchersLoading() {
  return (
    <div className="min-h-dvh">
      <p role="status" className="sr-only">
        Loading your wallet…
      </p>
      <section className="mx-auto max-w-md px-4 pb-44 pt-10" aria-hidden>
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-8 w-56" />
        <Skeleton className="mt-3 h-4 w-full" />
        <div className="mt-6 rounded-2xl border border-line bg-surface p-5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-9 w-32" />
          <Skeleton className="mt-4 h-4 w-3/4" />
        </div>
        <div className="mt-6 flex gap-2">
          <Skeleton className="h-12 flex-1 rounded-2xl" />
          <Skeleton className="h-12 w-28 rounded-full" />
        </div>
      </section>
    </div>
  );
}
