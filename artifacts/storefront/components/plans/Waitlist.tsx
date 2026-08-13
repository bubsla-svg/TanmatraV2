"use client";
// Client: captures a contact and confirms inline — the zero-dead-end landing
// (02d §8) for a plan/track the kitchen can't serve yet.

import { useState } from "react";
import { TextInput } from "@astryxdesign/core/TextInput";
import { emitFunnel } from "@/lib/funnel";
import { Button } from "@/components/ui/button";

/* Stage-4 Astryx adoption: field chrome only. The sr-only label + native input
 * became TextInput with isLabelHidden (its label stays SR-accessible) and
 * status={{type:'error'}} for the invalid border + aria-invalid; the external
 * <p id="waitlist-error" role="alert"> error line stays hand-rolled (Astryx
 * status messages carry no documented role) and is linked via aria-describedby.
 * Deliberately dropped: the old input's inputMode="tel" — the field accepts
 * phone OR email free text, so the tel keypad was wrong for half its inputs
 * and TextInput's BaseProps omit inputMode anyway. submit(), the funnel emit,
 * the done branch and all copy are untouched. */

/** D-11: Steady's waitlist body, verbatim (owner-supplied) — replaces the raw
 *  internal blocker string ("veg GI-low pool = 0; needs millets pasta import
 *  + millet khichdi SKU") that was leaking engineering jargon to customers. */
const STEADY_WAITLIST_BODY =
  "Steady isn’t open yet — we’re still sourcing the right ingredients for its vegetarian menu. Leave a number and you’ll be first to know the moment it launches.";

/**
 * Waitlist capture. When a plan or track isn't bookable (empty RD-signed pool,
 * pending SKUs), the router lands here instead of a broken builder. It states
 * the reason honestly (§2.6) and takes one field.
 */
export function Waitlist({ planId, planName, reason }: { planId: string; planName: string; reason: string }) {
  const [contact, setContact] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!contact.trim()) {
      setError("Enter a phone number or email so we can reach you.");
      return;
    }
    setError(null);
    emitFunnel("cuj_waitlist_captured", { planId });
    setDone(true);
  }

  if (done) {
    return (
      <div className="rounded-xl border border-line bg-surface p-6">
        <p className="text-lg font-semibold text-ink">You&rsquo;re on the list</p>
        <p className="mt-2 text-sm text-ink-muted">
          We&rsquo;ll message you the moment {planName} opens for your preference.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-line bg-surface p-6">
      {/* Plan name is the page's FocusHeader h1 (app/(focus)/plan/[planId]/page.tsx) —
          this used to duplicate it as a second h1. */}
      <p className="text-lg font-semibold text-ink">{planName} isn&rsquo;t open yet</p>
      <p className="mt-2 text-sm text-ink-muted">
        {planId === "steady" ? (
          STEADY_WAITLIST_BODY
        ) : (
          <>Honestly: {reason}. Leave a number and you&rsquo;ll be first to know when it launches.</>
        )}
      </p>
      <div className="mt-4 flex gap-2">
        <div className="flex-1">
          <TextInput
            label="Phone or email"
            isLabelHidden
            value={contact}
            onChange={setContact}
            placeholder="Phone or email"
            width="100%"
            status={error ? { type: "error" } : undefined}
            aria-describedby={error ? "waitlist-error" : undefined}
          />
        </div>
        <Button
          type="submit"
          size="fluid"
          className="rounded-lg px-4 py-2 font-semibold"
        >
          Notify me
        </Button>
      </div>
      {error && (
        <p id="waitlist-error" role="alert" className="mt-2 text-xs font-medium text-[var(--danger)]">
          {error}
        </p>
      )}
    </form>
  );
}
