"use client";
// Client: read-only credit-ledger statement, via TanStack Query. Session-gated
// (401 → inline PhoneAuth). Every row is the server's own ledger entry — no
// client arithmetic.
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/apiClient";
import { formatPaise } from "@/lib/format";
import { getCreditLedger, creditLabel } from "@/lib/billingApi";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";
import { Skeleton } from "@/components/ui/skeleton";

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const BILLING_KEY = ["account", "billing"] as const;

/**
 * Loading / error / empty are three distinct states (audit #17) — a failed
 * fetch used to render as plain muted text, visually indistinguishable from
 * "still loading", with no way to retry short of a full page reload.
 */
export function BillingPanel() {
  const {
    data: ledger,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: BILLING_KEY,
    queryFn: () => getCreditLedger(),
  });

  if (isPending) {
    return (
      <div className="flex flex-col gap-8" aria-hidden>
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (isError) {
    if (error instanceof ApiError && error.status === 401) {
      return (
        <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 text-center">
          <p className="text-sm text-ink-muted">Sign in to see your billing &amp; credits.</p>
          <PhoneAuth startExpanded onVerified={() => void refetch()} />
        </div>
      );
    }
    return (
      <div className="rounded-2xl border border-line bg-surface p-5 text-center">
        <p className="text-sm font-semibold text-danger">Couldn&rsquo;t load your billing</p>
        <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-ink-faint">
          Something went wrong on our end — this usually clears up on retry.
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-4 min-h-11 rounded-full border border-line-strong bg-surface px-4 text-sm font-bold text-ink"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface p-5 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[.16em] text-ink-muted">Wallet balance</p>
        <p className="font-data text-4xl font-bold leading-none text-primary">{formatPaise(ledger.balancePaise)}</p>
        <p className="mt-2 max-w-xs text-xs text-ink-muted">
          Applied automatically at checkout. Redeem a voucher on the{" "}
          <Link href="/vouchers" className="font-semibold text-primary underline-offset-4 hover:underline">wallet page</Link>.
        </p>
      </div>

      <div>
        <h2 className="mb-3 font-display text-xl font-semibold leading-tight text-primary">Credit activity</h2>
        {ledger.entries.length === 0 ? (
          <p className="rounded-2xl bg-secondary px-4 py-3 text-xs text-ink-muted">
            No credit activity yet. Credits arrive from referrals, vouchers and skipped deliveries —{" "}
            <Link href="/account/loyalty" className="font-semibold text-primary underline-offset-2 hover:underline">share your referral code</Link>.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {ledger.entries.map((e) => {
              const credit = e.deltaPaise >= 0;
              return (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-3 px-4 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{creditLabel(e)}</p>
                    <p className="font-data mt-0.5 text-xs text-ink-faint">{day(e.createdAt)}</p>
                  </div>
                  <span className={`font-data shrink-0 text-sm font-bold ${credit ? "text-sage-text" : "text-ink-muted"}`}>
                    {credit ? "+" : "−"}{formatPaise(Math.abs(e.deltaPaise))}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="text-center text-xs text-ink-faint">
        Looking for order receipts or plan billing? See your{" "}
        <Link href="/account/orders" className="font-semibold text-primary underline-offset-4 hover:underline">orders</Link> and{" "}
        <Link href="/account/subscriptions" className="font-semibold text-primary underline-offset-4 hover:underline">plans</Link>.
      </p>
    </div>
  );
}
