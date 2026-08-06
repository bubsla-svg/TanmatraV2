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
        <Skeleton className="h-44 w-full rounded-3xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (isError) {
    if (error instanceof ApiError && error.status === 401) {
      return (
        <div className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-6 text-center">
          <p className="text-sm text-ink-muted">Sign in to see your billing &amp; credits.</p>
          <PhoneAuth startExpanded onVerified={() => void refetch()} />
        </div>
      );
    }
    return (
      <div className="rounded-2xl border border-line bg-surface px-6 py-10 text-center">
        <p className="text-sm font-semibold text-[var(--danger)]">Couldn&rsquo;t load your billing</p>
        <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-ink-faint">
          Something went wrong on our end — this usually clears up on retry.
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-4 rounded-lg border border-line px-5 py-2 text-xs font-semibold text-gold-text transition-opacity hover:opacity-80"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col items-center gap-2 rounded-3xl border border-line bg-surface p-8 text-center shadow-[var(--shadow-card)]">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Wallet balance</p>
        <p className="tabular text-5xl font-bold leading-none text-gold-text">{formatPaise(ledger.balancePaise)}</p>
        <p className="mt-2 max-w-xs text-xs text-ink-muted">
          Applied automatically at checkout. Redeem a voucher on the{" "}
          <Link href="/vouchers" className="font-medium text-gold-text hover:underline">wallet page</Link>.
        </p>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-ink">Credit activity</h2>
        {ledger.entries.length === 0 ? (
          <p className="text-sm text-ink-muted">No credit activity yet.</p>
        ) : (
          <ul className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
            {ledger.entries.map((e, i) => {
              const credit = e.deltaPaise >= 0;
              return (
                <li
                  key={e.id}
                  className={`flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-surface-raised ${i > 0 ? "border-t border-line" : ""}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{creditLabel(e)}</p>
                    <p className="tabular mt-0.5 text-xs text-ink-faint">{day(e.createdAt)}</p>
                  </div>
                  <span className={`tabular shrink-0 text-sm font-semibold ${credit ? "text-sage-text" : "text-ink-muted"}`}>
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
        <Link href="/account/orders" className="font-medium text-gold-text hover:underline">orders</Link> and{" "}
        <Link href="/account/subscriptions" className="font-medium text-gold-text hover:underline">plans</Link>.
      </p>
    </div>
  );
}
