"use client";
// Client: captures a contact and confirms inline — the zero-dead-end landing
// (02d §8) for a plan/track the kitchen can't serve yet.

import { useState } from "react";
import { emitFunnel } from "@/lib/funnel";
import { Button } from "@/components/ui/button";

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
        Honestly: {reason}. Leave a number and you&rsquo;ll be first to know when it launches.
      </p>
      <div className="mt-4 flex gap-2">
        <label htmlFor="waitlist-contact" className="sr-only">
          Phone or email
        </label>
        <input
          id="waitlist-contact"
          type="text"
          inputMode="tel"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="Phone or email"
          aria-invalid={error != null}
          aria-describedby={error ? "waitlist-error" : undefined}
          className="flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink focus:border-line-strong"
        />
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
