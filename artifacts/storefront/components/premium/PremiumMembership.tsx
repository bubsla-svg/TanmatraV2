"use client";
// Membership state + the free lifecycle actions. Session-gated (401 →
// PhoneAuth). Joining is NOT run here any more: it is a real money path, and it
// used to open Razorpay in place with no captured-but-unverified state at all —
// a verify blip left the customer charged, un-activated, and looking at a Join
// button that had re-enabled itself over a real charge. Join now links to
// /checkout?mode=premium, where every purchase in the app settles.
// Cancel/resume stay here: they move no money (the period is already paid).
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/apiClient";
import { formatPaise } from "@/lib/format";
import { checkoutHref } from "@/lib/checkoutIntent";
import { getPremium, cancelPremium, resumePremium } from "@/lib/premiumApi";
import { Button } from "@/components/ui/button";
import { RD_SERVICES_ENABLED } from "@/lib/flags";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const isAuthError = (e: unknown) => e instanceof ApiError && e.status === 401;

export function PremiumMembership() {
  const queryClient = useQueryClient();
  const premiumQuery = useQuery({ queryKey: ["account", "premium"], queryFn: () => getPremium() });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["account", "premium"] });
  const onAuthError = (e: unknown) => { if (isAuthError(e)) void premiumQuery.refetch(); };

  const cancelMutation = useMutation({
    mutationFn: () => cancelPremium(),
    onSuccess: invalidate,
    onError: (e) => onAuthError(e),
  });
  const resumeMutation = useMutation({
    mutationFn: () => resumePremium(),
    onSuccess: invalidate,
    onError: (e) => onAuthError(e),
  });

  const busy = cancelMutation.isPending || resumeMutation.isPending;
  const actionError = cancelMutation.error ?? resumeMutation.error;

  if (isAuthError(premiumQuery.error)) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">Sign in to join Tanmatra Premium.</p>
        <PhoneAuth startExpanded onVerified={() => void premiumQuery.refetch()} />
      </div>
    );
  }

  if (premiumQuery.isPending) return <PremiumMembershipSkeleton />;

  if (premiumQuery.isError) {
    return (
      <div className="rounded-2xl border border-line bg-surface px-6 py-10 text-center">
        <p className="text-sm font-semibold text-danger">Couldn&rsquo;t load Premium</p>
        <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-ink-faint">Something went wrong on our end — this usually clears up on retry.</p>
        <button type="button" onClick={() => void premiumQuery.refetch()} className="mt-4 rounded-lg border border-line px-5 py-2 text-xs font-semibold text-primary transition-opacity hover:opacity-80">Try again</button>
      </div>
    );
  }

  const me = premiumQuery.data;
  const m = me.membership;
  const active = me.isPremium && m;
  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <p className="font-data text-3xl font-bold text-primary">{formatPaise(me.pricePaise)}<span className="text-sm font-medium text-ink-muted"> / month</span></p>
      {actionError && (
        <p role="alert" className="mt-2 text-xs font-medium text-danger">
          {actionError instanceof ApiError ? actionError.message : "Something went wrong. Please try again."}
        </p>
      )}

      {active ? (
        <div className="mt-4 flex flex-col gap-3">
          <p className="rounded-lg bg-sage-soft px-3 py-2 text-sm font-medium text-sage-text">
            Active membership — {m.status === "cancelled" ? "ends" : "renews"} on {day(m.currentPeriodEnd)}.
          </p>
          {RD_SERVICES_ENABLED && (
            <>
              <div className="flex items-center justify-between border-y border-line py-3">
                <span className="text-sm text-ink-muted">Consults used this period</span>
                <span className="font-data text-sm font-semibold text-ink">{m.rdConsultsUsedThisPeriod} / {m.rdConsultsPerPeriod}</span>
              </div>
              <Button asChild shape="pill" size="fluid" className="px-5 py-3 text-center font-semibold">
                <Link href="/rd">Book your free consult</Link>
              </Button>
            </>
          )}
          <div className="flex justify-center pt-1">
            {m.status === "cancelled"
              ? <button type="button" onClick={() => resumeMutation.mutate()} disabled={busy} aria-busy={busy} aria-live="polite" className="text-sm font-medium text-primary hover:underline disabled:opacity-60">{busy ? "Working…" : "Resume auto-renewal"}</button>
              : <button type="button" onClick={() => cancelMutation.mutate()} disabled={busy} aria-busy={busy} aria-live="polite" className="text-sm font-medium text-ink-muted hover:text-ink disabled:opacity-60">{busy ? "Working…" : "Cancel renewal"}</button>}
          </div>
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-3">
          <Button asChild shape="pill" size="fluid" className="px-6 py-3.5 text-center font-semibold">
            <Link href={checkoutHref({ mode: "premium" })}>Join Tanmatra Premium</Link>
          </Button>
          <p className="text-center text-xs text-ink-faint">Cancel anytime.</p>
        </div>
      )}
    </div>
  );
}

function PremiumMembershipSkeleton() {
  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <p className="sr-only">Loading Premium…</p>
      <div aria-hidden className="flex flex-col gap-3">
        <div className="h-9 w-40 animate-pulse rounded-lg bg-secondary" />
        <div className="mt-2 h-12 animate-pulse rounded-lg bg-secondary" />
        <div className="h-12 animate-pulse rounded-lg bg-secondary" />
      </div>
    </div>
  );
}
