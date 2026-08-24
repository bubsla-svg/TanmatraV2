"use client";
// Client: the plan flow's sign-in gate.
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { firebaseConfigured } from "@/lib/firebase";
import { formatPaise } from "@/lib/format";
import { PhoneAuth } from "../PhoneAuth";
import type { AuthUser } from "@/lib/api";
import { offersPauseOrCancel } from "@/lib/planDecisionFacts";

const CADENCE_LABEL: Record<string, string> = {
  weekly: "billed weekly",
  fortnightly: "billed fortnightly",
  monthly: "billed monthly",
  quarterly: "billed quarterly",
  // The trial's PlanCycle — a single charge, no renewal. Never "billed …":
  // the fine print below promises no auto-convert.
  one_off: "one-time",
};

/**
 * Sign-in gate for the plan money path (SF-07). Firebase phone-auth when the
 * build shipped config; a fail-LOUD fallback (never a dead end) when the live
 * flag is on but the Firebase config is absent — points at the à-la-carte menu.
 *
 * N5.11: the gate restates the offer before asking for a phone number. The
 * recap is the host page's spine quote (computePlanQuote, server-side) — the
 * same list figures /plans shows anonymous visitors — rendered verbatim. The
 * billed amount stays the post-auth server quote; the note below says so.
 */
export function PlanIdentityGate({
  planName,
  recap,
  onVerified,
}: {
  planName: string;
  recap?: { mealsPerCycle: number; cycleTotalPaise: number; cadence: string };
  onVerified: (user: AuthUser) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Start your {planName} plan</h1>
      {recap && (
        <div className="rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-ink">
              {recap.mealsPerCycle} lunches{" "}
              <span className="text-ink-muted">· {CADENCE_LABEL[recap.cadence] ?? recap.cadence}</span>
            </span>
            <span className="tabular text-base font-semibold text-ink">
              {formatPaise(recap.cycleTotalPaise)}
            </span>
          </div>
          {/* F-7: "Pause or cancel anytime" used to render unconditionally —
              two lines under a cadence label that correctly said "one-time".
              A ₹399 one-off has no future delivery to pause and no mandate to
              cancel, so the sentence did not reassure the buyer, it told them
              they had bought a subscription. Same defect as F-2 one screen
              later, and the same fix: ask the cadence. */}
          <p className="mt-1.5 text-xs text-ink-muted">
            Final total confirmed after sign-in — any credit applies automatically.
            {offersPauseOrCancel(recap.cadence) ? " Pause or cancel anytime." : ""}
          </p>
        </div>
      )}
      {firebaseConfigured() ? (
        <>
          <p className="text-sm text-ink-muted">Sign in to set up delivery — a code by SMS, no passwords.</p>
          <PhoneAuth startExpanded onVerified={onVerified} />
        </>
      ) : (
        <div className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5">
          <p role="alert" className="text-sm font-medium text-[var(--danger)]">
            Plan sign-in is temporarily unavailable. You can order individual dishes from the menu meanwhile.
          </p>
          <Button asChild shape="pill" size="fluid" className="self-start px-5 py-3 font-semibold">
            <Link href="/menu">Browse the menu</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
