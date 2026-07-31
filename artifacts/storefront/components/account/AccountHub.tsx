"use client";
// Client: session + live-order state are cookie-authed browser reads, owned
// by TanStack Query (components/QueryProvider.tsx).
import Link from "next/link";
import { ChevronRight, ArrowRight } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAuthUser, logoutSession, ApiError, type AuthUser } from "@/lib/api";
import { getActiveOrders, type ActiveOrder } from "@/lib/ordersApi";
import { statusLabel, TRACKABLE_STATUSES } from "@/lib/orderStatus";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";
import { Skeleton } from "@/components/ui/skeleton";

const SECTIONS = [
  { href: "/account/subscriptions", label: "Plans", sub: "Your active metabolic protocols" },
  { href: "/account/orders", label: "Orders", sub: "History and clinical summaries" },
  { href: "/account/appointments", label: "Consults", sub: "Dietitian video and chat sessions" },
  { href: "/account/addresses", label: "Addresses", sub: "Delivery locations" },
  { href: "/account/billing", label: "Billing", sub: "Credit ledger and wallet balance" },
  { href: "/account/preferences", label: "Preferences", sub: "Dietary and clinical filters" },
  { href: "/account/symptoms", label: "Symptoms", sub: "Post-meal reaction log" },
  { href: "/account/history", label: "History", sub: "Macro intake vs. your targets" },
  { href: "/account/loyalty", label: "Rewards", sub: "Loyalty points and clinical credits" },
] as const;

const LEGAL = [
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/terms", label: "Terms" },
  { href: "/faq", label: "Support" },
] as const;

const ME_KEY = ["account", "me"] as const;
const ACTIVE_ORDER_KEY = ["account", "me", "activeOrder"] as const;

/** Shared by both "not signed in" paths below — a genuine 401 and a 200 with
 *  `user: null` mean the same thing to this UI. */
function SignInOffer({ onVerified }: { onVerified: (user: AuthUser) => void }) {
  return (
    <div className="mt-4 flex flex-col gap-4">
      <p className="text-sm text-ink-muted">Sign in to see your orders, plans and addresses.</p>
      <PhoneAuth onVerified={onVerified} />
    </div>
  );
}

/**
 * Account hub (§2 / CUJ-06 "live order" card), Stitch brief route-08
 * "Account Hub: Clinical Profile". Session from GET /auth/user; the card shows
 * the first in-flight order from the user-scoped GET /orders/active (a
 * clinician's cross-patient feed is NOT "your order" — suppressed).
 *
 * The session read distinguishes a genuine 401 from any other failure
 * (network/5xx): only a 401 (or a 200 with `user: null`) renders the
 * sign-in offer. Any other error gets its own state with a retry — an
 * outage used to collapse into the same "you're signed out" UI, wrongly
 * demanding a fresh OTP from someone who never logged out (audit #14).
 *
 * The brief also draws a top app bar and a bottom tab bar; both are already
 * global chrome here (components/Header, components/BottomNav), so only the
 * page body is adopted.
 */
export function AccountHub() {
  const queryClient = useQueryClient();

  const {
    data: user,
    isPending: userPending,
    isError: userIsError,
    error: userError,
    refetch: refetchUser,
  } = useQuery({
    queryKey: ME_KEY,
    queryFn: async () => (await getAuthUser()).user,
  });

  const { data: live } = useQuery({
    queryKey: ACTIVE_ORDER_KEY,
    queryFn: async (): Promise<ActiveOrder | null> => {
      const { callerIsClinician, orders } = await getActiveOrders();
      if (callerIsClinician) return null;
      return orders.find((o) => TRACKABLE_STATUSES.has(o.status)) ?? null;
    },
    enabled: !!user,
    // Best-effort card, matching the original fetch's own .catch(() => null):
    // a failed probe simply means no live-order card, never a page error.
    retry: false,
    throwOnError: false,
  });

  const signOut = useMutation({
    mutationFn: async () => {
      try {
        await logoutSession();
      } catch {
        // A lapsed session is already signed out — same end state.
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(ME_KEY, null);
      queryClient.removeQueries({ queryKey: ACTIVE_ORDER_KEY });
    },
  });

  if (userPending) {
    return (
      <div className="mt-4 flex flex-col gap-3" aria-hidden>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    );
  }

  if (userIsError) {
    if (userError instanceof ApiError && userError.status === 401) {
      return <SignInOffer onVerified={(u) => queryClient.setQueryData(ME_KEY, u)} />;
    }
    return (
      <div className="mt-4 rounded-xl border border-line bg-surface p-6 text-center">
        <p className="text-sm font-semibold text-[var(--danger)]">Couldn&rsquo;t load your account</p>
        <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-ink-faint">
          Something went wrong on our end — this usually clears up on retry.
        </p>
        <button
          type="button"
          onClick={() => void refetchUser()}
          className="mt-4 rounded-lg border border-line px-5 py-2 text-xs font-semibold text-gold-text transition-opacity hover:opacity-80"
        >
          Try again
        </button>
      </div>
    );
  }

  if (user === null) {
    return <SignInOffer onVerified={(u) => queryClient.setQueryData(ME_KEY, u)} />;
  }

  return (
    <div className="mt-4 flex flex-col gap-8">
      <div className="flex items-end justify-between">
        <p className="text-base font-medium text-ink">
          {user.firstName ?? user.phoneE164 ?? "Signed in"}
        </p>
        <button
          type="button"
          onClick={() => signOut.mutate()}
          disabled={signOut.isPending}
          className="-m-1 p-1 text-sm font-medium text-ink-muted transition-colors hover:text-ink disabled:opacity-50"
        >
          {signOut.isPending ? "Signing out…" : "Sign out"}
        </button>
      </div>

      {live && (
        <Link
          href={`/track/${encodeURIComponent(live.externalOrderId)}`}
          className="group relative block overflow-hidden rounded-xl border border-line bg-surface p-6 transition-transform active:scale-[0.98]"
        >
          {/* Atmospheric signal wash — decorative, sage reads as status not action. */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full bg-sage/5 blur-3xl"
          />
          <div className="mb-4 flex items-start justify-between">
            <span className="tabular text-[10px] uppercase tracking-widest text-sage-text">
              Live order
            </span>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sage opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-sage" />
            </span>
          </div>
          <p className="text-lg font-medium text-ink">{statusLabel(live.status)}</p>
          <p className="tabular mt-1 text-xs text-ink-faint">#{live.externalOrderId}</p>
          <span className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-gold-text">
            Track live
            <ArrowRight aria-hidden className="h-4 w-4" />
          </span>
        </Link>
      )}

      <nav aria-label="Account sections" className="flex flex-col gap-3">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group flex items-center justify-between rounded-xl border border-line bg-surface p-5 transition-all hover:bg-surface-raised active:scale-[0.98]"
          >
            <span>
              <span className="block text-base font-bold text-ink">{s.label}</span>
              <span className="mt-1 block text-sm text-ink-muted">{s.sub}</span>
            </span>
            <ChevronRight
              aria-hidden
              className="h-5 w-5 shrink-0 text-ink-faint transition-transform group-hover:translate-x-1"
            />
          </Link>
        ))}
      </nav>

      <div className="flex justify-center gap-6 pt-2 pb-4 text-xs font-semibold uppercase tracking-widest text-ink-muted">
        {LEGAL.map((l) => (
          <Link key={l.href} href={l.href} className="transition-colors hover:text-gold-text">
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
