import { Skeleton } from "@/components/ui/skeleton";

/**
 * Checkout skeleton. Every branch of app/checkout/page.tsx (plan, à-la-carte,
 * legacy flow) renders the same max-w-md / pt-10 pb-44 shell and opens with a
 * text-2xl heading above a rounded-3xl card, so that is what this reserves: the
 * heading, then the card's label + 50px input + 44px pill CTA at PhoneAuth's
 * own gap-3 / p-6 rhythm. No amount is ever placeheld — the server owns those.
 */
export default function CheckoutLoading() {
  return (
    <div className="min-h-dvh">
      <p role="status" className="sr-only">
        Loading checkout…
      </p>
      <section className="mx-auto max-w-md px-4 pt-10 pb-44" aria-hidden>
        <div className="flex flex-col gap-5">
          <Skeleton className="h-8 w-48" />
          <div className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-6">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-[50px] w-full rounded-2xl" />
            <Skeleton className="h-11 w-40 rounded-full" />
          </div>
        </div>
      </section>
    </div>
  );
}
