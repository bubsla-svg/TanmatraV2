"use client"; // Interactive clinical waitlist capture form state and lead pipeline submission
// Lead capture module for gated clinical tiers (Steady Meal Plan & GLP-1 Companion)
import { useState } from "react";
import { ApiError } from "@/lib/apiClient";
import { submitCorporateLead } from "@/lib/corporateApi";
import { emitLpEvent } from "@/lib/lpEvents";
import {
  emailOk,
  getIndicativePrice,
  type ClinicalWaitlistTier,
  type WaitlistFormProps,
} from "./WaitlistTypes";
import { WaitlistFields } from "./WaitlistFields";

export { type ClinicalWaitlistTier, type WaitlistFormProps } from "./WaitlistTypes";

export function WaitlistForm({
  defaultTier = "steady",
  lockTier = false,
  source = "web:/clinical-waitlist",
  submitLabel = "Join Clinical Waitlist",
}: WaitlistFormProps = {}) {
  const [kind, setKind] = useState<ClinicalWaitlistTier>(defaultTier);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const valid = name.trim().length >= 2 && emailOk(email);

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await submitCorporateLead({
        kind: "corporate",
        name: name.trim(),
        workEmail: email.trim(),
        company: kind === "steady" ? "Steady Clinical Waitlist" : "GLP-1 Companion Waitlist",
        teamSizeBand: "1-20",
        phone: phone.trim() || undefined,
        message: `[Tier: ${kind.toUpperCase()}] ${notes.trim()}`,
        source,
      });
      emitLpEvent("waitlist_join", { tier: kind, source });
      setDone(true);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 429
          ? "Too many requests from this network — please try again later."
          : e instanceof ApiError
            ? e.message
            : "Unable to process waitlist request just now — please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-line bg-surface p-6 text-center shadow-[var(--shadow-card)]">
        <p className="text-base font-semibold text-ink">You are on the priority waitlist.</p>
        <p className="mt-1 text-xs text-ink-muted">
          Our clinical team will evaluate availability and contact you at {email.trim()} soon.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-card)]"
    >
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-gold-text">
          Gated Clinical Tiers
        </span>
        <h3 className="text-lg font-semibold text-ink">Request Protocol Enrollment</h3>
        <p className="text-xs font-medium text-ink-muted">
          Indicative Pricing:{" "}
          <span className="font-semibold text-ink">{getIndicativePrice(kind)}</span>
        </p>
      </div>

      <WaitlistFields
        kind={kind}
        onKindChange={setKind}
        lockTier={lockTier}
        name={name}
        onNameChange={setName}
        email={email}
        onEmailChange={setEmail}
        phone={phone}
        onPhoneChange={setPhone}
        notes={notes}
        onNotesChange={setNotes}
      />

      {error && (
        <p role="alert" className="text-xs font-medium text-[var(--danger)]">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!valid || busy}
        className="rounded-xl bg-gold py-3.5 text-sm font-semibold text-[var(--gold-ink)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? "Submitting Registration…" : submitLabel}
      </button>
    </form>
  );
}
