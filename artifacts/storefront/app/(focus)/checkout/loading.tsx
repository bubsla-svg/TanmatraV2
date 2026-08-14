import { FocusHeader } from "@/components/FocusHeader";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Checkout skeleton. All three branches page.tsx can render (à-la-carte,
 * live-plan builder, legacy CheckoutFlow) share the same outer shell — a
 * FocusHeader (rendered for real: no data, and it's the one thing every
 * checkout leg is contractually required to carry) over a max-w-md, pb-44
 * column with a fixed pay bar at the bottom. This covers the shell all three
 * share; each flow's own real content replaces the body once it resolves.
 */
export default function CheckoutLoading() {
  return (
    <div className="min-h-dvh">
      <p role="status" className="sr-only">
        Loading checkout…
      </p>
      <section className="mx-auto max-w-md px-4 pt-6 pb-44">
        {/* No trustSignal: this skeleton shields the PLAN identity stage too
            (N5.10 — "Secure UPI checkout" over an OTP field misdescribes the
            moment), and a skeleton can't know which branch it's covering.
            The à-la-carte page restores its own trust line on resolve. */}
        <FocusHeader title="Checkout" backLabel="Back" />
        <div aria-hidden className="mt-6 flex flex-col gap-4">
          <div className="rounded-2xl border border-line bg-surface p-4">
            <Skeleton className="h-4 w-32" />
            <div className="mt-3 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-12" />
              </div>
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-12" />
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-3 h-11 w-full rounded-lg" />
          </div>
        </div>
      </section>

      <div
        aria-hidden
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-[var(--glass)] p-4 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
      >
        <div className="mx-auto flex max-w-md items-center justify-between gap-3">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-12 w-40 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
