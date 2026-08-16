"use client"; // Justification: pincode entry, an API verdict, and localStorage read-back.

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { NotifyMeForm } from "@/components/onboarding/NotifyMeForm";
import {
  checkServiceability,
  loadServiceabilityState,
  saveServiceabilityState,
  type ServiceabilityState,
} from "@/lib/serviceabilityApi";

/**
 * Serviceability before salesmanship (Laws 1 and 7).
 *
 * The plan/trial checkout used to ask, in this order: phone + OTP
 * (PlanIdentityGate), then allergies and medical conditions (MemberIntake),
 * and only THEN the PIN code. The single fact that decides whether any of it
 * is possible came last, so someone just outside the served sectors handed
 * over a phone number, their allergies and their medical conditions before
 * finding out we do not deliver to them — the quote's `unserviceable_pincode`
 * arriving after the OTP round trip. This gate moves that question in front of
 * every personal field.
 *
 * It deliberately does NOT reuse ServiceabilityBar: that component documents
 * "EXACTLY ONE INSTANCE MAY BE MOUNTED PER PAGE" because its verdict is
 * per-instance state seeded once at mount, so a second copy silently disagrees
 * with the first. This shares the same `serviceabilityApi` — and therefore the
 * same persisted verdict — without mounting a second bar.
 *
 * Law 4 (never ask twice) falls out of that sharing: a customer who already
 * answered in the header bar is not asked again here, because the stored
 * verdict is read at mount and a serviceable one passes straight through.
 */
export function PlanServiceabilityGate({
  onServiceable,
}: {
  /** Called with the confirmed PIN so downstream address entry is prefilled
   *  rather than asking for the same six digits a second time. */
  onServiceable: (pincode: string) => void;
}) {
  const [hydrated, setHydrated] = useState(false);
  const [pincode, setPincode] = useState("");
  const [state, setState] = useState<ServiceabilityState>({ verdict: "unknown", pincode: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read the shared verdict once. A customer who already answered upstream
  // (header bar, landing, /menu) is passed through without being re-asked.
  useEffect(() => {
    const stored = loadServiceabilityState();
    setState(stored);
    if (stored.pincode) setPincode(stored.pincode);
    setHydrated(true);
    if (stored.verdict === "serviceable" && stored.pincode) onServiceable(stored.pincode);
    // onServiceable is intentionally omitted: this must run exactly once, on
    // mount. Including it would re-fire the handoff on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pinValid = pincode.replace(/\D/g, "").length === 6;

  async function check() {
    if (!pinValid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const next = await checkServiceability(pincode.replace(/\D/g, ""));
      saveServiceabilityState(next);
      setState(next);
      if (next.verdict === "serviceable") onServiceable(next.pincode);
    } catch {
      // Law 9: name the next action, never just the failure.
      setError("We couldn't check that PIN code just now. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  // Until localStorage has been read, render nothing rather than a flash of
  // the form to someone who already answered.
  if (!hydrated) return null;
  if (state.verdict === "serviceable") return null;

  return (
    <section
      className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5"
      aria-label="Delivery availability"
    >
      <div className="flex flex-col gap-1.5">
        <h2 className="text-sm font-semibold text-ink">First — do we deliver to you?</h2>
        <p className="text-sm leading-relaxed text-ink-muted">
          We&rsquo;ll check your PIN code before asking for anything else.
        </p>
      </div>

      <div className="flex gap-2">
        <input
          aria-label="PIN code"
          inputMode="numeric"
          autoComplete="postal-code"
          value={pincode}
          onChange={(e) => setPincode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void check();
          }}
          placeholder="201301"
          aria-invalid={pincode.length > 0 && !pinValid}
          className="min-w-0 flex-1 rounded-2xl border border-line bg-transparent px-4 py-3 text-base text-ink outline-none placeholder:text-ink-faint focus-visible:border-line-strong"
        />
        <Button
          shape="pill"
          onClick={() => void check()}
          disabled={!pinValid || busy}
          className="shrink-0 px-5 py-3 font-semibold"
        >
          {busy ? "Checking…" : "Check"}
        </Button>
      </div>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      {state.verdict === "unserviceable" && (
        // Not a dead end (Laws 9, 10): an unserved PIN ends in notify-me, and
        // the customer can correct a typo without reloading.
        <div className="flex flex-col gap-3 border-t border-line pt-4">
          <p className="text-sm leading-relaxed text-ink-muted">
            We don&rsquo;t deliver to {state.pincode} yet — we currently serve Noida sectors
            only. Leave your number and we&rsquo;ll tell you the day we reach you.
          </p>
          <NotifyMeForm
            pincode={state.pincode}
            onReset={() => {
              setState({ verdict: "unknown", pincode: "" });
              setPincode("");
            }}
          />
        </div>
      )}
    </section>
  );
}
