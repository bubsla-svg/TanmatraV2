"use client";
// Client: session + live-order state are cookie-authed browser reads.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getAuthUser, logoutSession, type AuthUser } from "@/lib/api";
import { getActiveOrders, type ActiveOrder } from "@/lib/ordersApi";
import { statusLabel, TRACKABLE_STATUSES } from "@/lib/orderStatus";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";

const SECTIONS = [
  { href: "/account/subscriptions", label: "Plans", sub: "Pause, skip deliveries, manage add-ons" },
  { href: "/account/orders", label: "Orders", sub: "History and reorder" },
  { href: "/account/addresses", label: "Addresses", sub: "Where we deliver" },
  { href: "/account/preferences", label: "Preferences", sub: "Diet, allergens, goals" },
] as const;

/**
 * Account hub (§2 / CUJ-06 "live order" card). Session from GET /auth/user;
 * the card shows the first in-flight order from the user-scoped
 * GET /orders/active (a clinician's cross-patient feed is NOT "your order" —
 * suppressed). Every read is best-effort: a failed probe renders the signed-out
 * offer or simply no card, never a crash (UIF §6).
 */
export function AccountHub() {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const [live, setLive] = useState<ActiveOrder | null>(null);

  const load = useCallback(async () => {
    try {
      const { user: u } = await getAuthUser();
      setUser(u);
      if (u) {
        void getActiveOrders()
          .then(({ callerIsClinician, orders }) => {
            if (callerIsClinician) return;
            setLive(orders.find((o) => TRACKABLE_STATUSES.has(o.status)) ?? null);
          })
          .catch(() => setLive(null));
      }
    } catch {
      setUser(null);
    }
  }, []);

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
        <PhoneAuth onVerified={() => void load()} />
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-muted">{user.firstName ?? user.phoneE164 ?? "Signed in"}</p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="-m-1 p-1 text-sm font-medium text-ink-muted hover:text-ink hover:underline"
        >
          Sign out
        </button>
      </div>

      {live && (
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-sage-text">Live order</p>
          <p className="mt-1 text-sm font-semibold text-ink">{statusLabel(live.status)}</p>
          <p className="tabular mt-0.5 text-xs text-ink-faint">#{live.externalOrderId}</p>
          <Link
            href={`/track/${encodeURIComponent(live.externalOrderId)}`}
            className="mt-2 inline-block text-sm font-medium text-gold-text hover:underline"
          >
            Track live &rarr;
          </Link>
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {SECTIONS.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="flex items-center justify-between rounded-xl border border-line bg-surface p-4 hover:border-line-strong"
            >
              <span>
                <span className="block text-sm font-semibold text-ink">{s.label}</span>
                <span className="block text-xs text-ink-muted">{s.sub}</span>
              </span>
              <span aria-hidden className="text-ink-faint">&rarr;</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
