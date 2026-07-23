"use client";
// Client: the plan flow's sign-in gate.
import Link from "next/link";
import { firebaseConfigured } from "@/lib/firebase";
import { PhoneAuth } from "../PhoneAuth";
import type { AuthUser } from "@/lib/api";

/**
 * Sign-in gate for the plan money path (SF-07). Firebase phone-auth when the
 * build shipped config; a fail-LOUD fallback (never a dead end) when the live
 * flag is on but the Firebase config is absent — points at the à-la-carte menu.
 */
export function PlanIdentityGate({
  planName,
  onVerified,
}: {
  planName: string;
  onVerified: (user: AuthUser) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-ink">Start your {planName} plan</h1>
      {firebaseConfigured() ? (
        <>
          <p className="text-sm text-ink-muted">Sign in to set up delivery — a code by SMS, no passwords.</p>
          <PhoneAuth onVerified={onVerified} />
        </>
      ) : (
        <>
          <p role="alert" className="text-sm font-medium text-[var(--danger)]">
            Plan sign-in is temporarily unavailable. You can order individual dishes from the menu meanwhile.
          </p>
          <Link href="/menu" className="self-start rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-[var(--gold-ink)]">
            Browse the menu
          </Link>
        </>
      )}
    </div>
  );
}
