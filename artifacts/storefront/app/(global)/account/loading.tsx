import { Skeleton } from "@/components/ui/skeleton";

/**
 * Account hub skeleton. AccountHub (a client island) already renders this
 * exact shape for its own `userPending` state once it mounts — matching it
 * here means the handoff from route-level loading to the island's own
 * loading state is seamless, not a visible re-layout.
 */
export default function AccountLoading() {
  return (
    <section className="mx-auto max-w-md px-4 py-10">
      <p role="status" className="sr-only">
        Loading account…
      </p>
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Account</h1>
      <div className="mt-4 flex flex-col gap-3" aria-hidden>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    </section>
  );
}
