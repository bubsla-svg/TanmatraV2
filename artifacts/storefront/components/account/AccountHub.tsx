"use client";
// Client: session + live-order state are cookie-authed browser reads.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, ArrowRight } from "lucide-react";
import { getAuthUser, logoutSession, type AuthUser } from "@/lib/api";
import { getActiveOrders, type ActiveOrder } from "@/lib/ordersApi";
import { statusLabel, TRACKABLE_STATUSES } from "@/lib/orderStatus";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";

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

/**
 * Account hub (§2 / CUJ-06 "live order" card), Stitch brief route-08
 * "Account Hub: Clinical Profile". Session from GET /auth/user; the card shows
 * the first in-flight order from the user-scoped GET /orders/active (a
 * clinician's cross-patient feed is NOT "your order" — suppressed). Every read
 * is best-effort: a failed probe renders the signed-out offer or simply no
 * card, never a crash (UIF §6).
 *
 * The brief also draws a top app bar and a bottom tab bar; both are already
 * global chrome here (components/Header, components/BottomNav), so only the
 * page body is adopted.
 */
export function AccountHub() {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const [live, setLive] = useState<ActiveOrder | null>(null);

  const loadLiveOrder = useCallback(() => {
    void getActiveOrders()
      .then(({ callerIsClinician, orders }) => {
        if (callerIsClinician) return;
        setLive(orders.find((o) => TRACKABLE_STATUSES.has(o.status)) ?? null);
      })
      .catch(() => setLive(null));
  }, []);

  const load = useCallback(async () => {
    try {
      const { user: u } = await getAuthUser();
      setUser(u);
      if (u) loadLiveOrder();
    } catch {
      setUser(null);
    }
  }, [loadLiveOrder]);

  useEffect(() => {
    void load();
  }, [load]);

  async function signOut() {
    try {
      await logoutSession();
    } catch {
      // A lapsed session is already signed out — same end state.
    }
    setUser(null);
    setLive(null);
  }

  if (user === undefined) {
    return <p className="mt-4 text-sm text-ink-muted">Loading your account…</p>;
  }

  if (user === null) {
    return (
      <div className="mt-4 flex flex-col gap-4">
        <p className="text-sm text-ink-muted">Sign in to see your orders, plans and addresses.</p>
        <PhoneAuth
          onVerified={(u) => {
            setUser(u);
            loadLiveOrder();
          }}
        />
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-8">
      <div className="flex items-end justify-between">
        <p className="text-base font-medium text-ink">
          {user.firstName ?? user.phoneE164 ?? "Signed in"}
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="-m-1 p-1 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
        >
          Sign out
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
