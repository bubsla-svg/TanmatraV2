"use client";
// Client: captures a contact and confirms inline — the zero-dead-end landing
// (02d §8) for a plan/track the kitchen can't serve yet.

import { useState } from "react";
import { emitFunnel } from "@/lib/funnel";

/**
 * Waitlist capture. When a plan or track isn't bookable (empty RD-signed pool,
 * pending SKUs), the router lands here instead of a broken builder. It states
 * the reason honestly (§2.6) and takes one field.
 */
export function Waitlist({ planId, planName, reason }: { planId: string; planName: string; reason: string }) {
  const [contact, setContact] = useState("");
  const [done, setDone] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!contact.trim()) return;
    emitFunnel("cuj_waitlist_captured", { planId });
    setDone(true);
  }

  if (done) {
    return (
      <div className="rounded-xl border border-line bg-surface p-6">
        <h2 className="text-lg font-semibold text-ink">You&rsquo;re on the list</h2>
        <p className="mt-2 text-sm text-ink-muted">
          We&rsquo;ll message you the moment {planName} opens for your preference.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-line bg-surface p-6">
      <h2 className="text-lg font-semibold text-ink">{planName} isn&rsquo;t open yet</h2>
      <p className="mt-2 text-sm text-ink-muted">
        Honestly: {reason}. Leave a number and you&rsquo;ll be first to know when it launches.
      </p>
      <div className="mt-4 flex gap-2">
        <input
          type="text"
          inputMode="tel"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="Phone or email"
          aria-label="Phone or email"
          className="flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-line-strong"
        />
        <button
          type="submit"
          className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-[var(--gold-ink)]"
        >
          Notify me
        </button>
      </div>
    </form>
  );
}
