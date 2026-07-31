"use client"; // Justification: client-side form field state and network lead submission.
import { useState } from "react";
import { ApiError } from "@/lib/apiClient";
import { emitLpEvent } from "@/lib/lpEvents";
import {
  submitCorporateLead,
  TEAM_SIZE_BANDS,
  type CorporateLeadKind,
  type TeamSizeBand,
} from "@/lib/corporateApi";
import { Button } from "@/components/ui/button";

const KINDS: { id: CorporateLeadKind; label: string }[] = [
  { id: "corporate", label: "Corporate / office" },
  { id: "gym", label: "Gym" },
  { id: "fitness_club", label: "Fitness club" },
];
const inputCls =
  "w-full rounded-xl border border-line bg-bg px-4 py-3 text-base text-ink outline-none transition-colors focus:border-[var(--gold)] focus:ring-1 focus:ring-[var(--gold)]";
const labelCls = "flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint";
const emailOk = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.trim());

export interface CorporateLeadFormProps {
  /** Pre-select the segment (a landing page implies its own kind). */
  defaultKind?: CorporateLeadKind;
  /** Hide the segment selector when the page already implies the kind. */
  lockKind?: boolean;
  /** Attribution written onto the lead (defaults to the /corporate source). */
  source?: string;
  /** Override the submit button label to match the page's CTA. */
  submitLabel?: string;
  /** Digits-only WhatsApp number for a wa.me fallback link under the form. */
  whatsApp?: string;
}

/**
 * Single-step corporate lead form (Stitch brief 14) — POSTs to /corporate-leads.
 * Deliberately NOT a wizard: every field is on one card so an HR lead can see
 * the whole ask before committing. Fields map 1:1 to the endpoint; `lockKind`
 * hides the segment chooser on a page that already implies its kind.
 */
export function CorporateLeadForm({
  defaultKind = "corporate",
  lockKind = false,
  source = "web:/corporate",
  submitLabel = "Request a plan",
  whatsApp,
}: CorporateLeadFormProps = {}) {
  const [kind, setKind] = useState<CorporateLeadKind>(defaultKind);
  const [name, setName] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [company, setCompany] = useState("");
  const [teamSizeBand, setTeamSizeBand] = useState<TeamSizeBand | "">("");
  const [parkOrSector, setParkOrSector] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const valid =
    name.trim().length >= 2 && emailOk(workEmail) && company.trim().length >= 2 && teamSizeBand !== "";

  async function submit() {
    if (!valid) return;
    setBusy(true);
    setError(null);
    emitLpEvent("lead_submit", { page: source, kind, seats_band: teamSizeBand });
    try {
      await submitCorporateLead({
        kind,
        name: name.trim(),
        workEmail: workEmail.trim(),
        company: company.trim(),
        teamSizeBand: teamSizeBand as TeamSizeBand,
        parkOrSector: parkOrSector.trim() || undefined,
        phone: phone.trim() || undefined,
        message: message.trim() || undefined,
        source,
      });
      emitLpEvent("lead_success", { page: source, kind, seats_band: teamSizeBand });
      setDone(true);
    } catch (e) {
      const errMsg = e instanceof ApiError && e.status === 429
        ? "Too many submissions from this network — please try again shortly."
        : e instanceof ApiError
          ? e.message
          : "Couldn't send that just now — please try again.";
      setError(errMsg);
      emitLpEvent("lead_error", { page: source, error: errMsg });
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-8 text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-sage-soft text-lg text-sage-text">
          ✓
        </span>
        <p className="mt-4 text-base font-semibold text-ink">Thanks — we&rsquo;ll be in touch.</p>
        <p className="mt-1 text-sm text-ink-muted">Our team will reach out at {workEmail.trim()} shortly.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6 md:p-8">
      {!lockKind && (
        <label className={labelCls}>
          You&rsquo;re a
          <select value={kind} onChange={(e) => setKind(e.target.value as CorporateLeadKind)} className={inputCls}>
            {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
        </label>
      )}
      <div className="flex flex-col gap-4 md:flex-row">
        <label className={`${labelCls} md:flex-1`}>
          Your name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Priya Sharma" className={inputCls} />
        </label>
        <label className={`${labelCls} md:flex-1`}>
          Work email
          <input type="email" value={workEmail} onChange={(e) => setWorkEmail(e.target.value)} placeholder="you@company.com" className={inputCls} />
        </label>
      </div>
      <div className="flex flex-col gap-4 md:flex-row">
        <label className={`${labelCls} md:flex-1`}>
          Company
          <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company / organisation" className={inputCls} />
        </label>
        <label className={`${labelCls} md:flex-1`}>
          Team size
          <select value={teamSizeBand} onChange={(e) => setTeamSizeBand(e.target.value as TeamSizeBand)} className={inputCls}>
            <option value="" disabled>Select team size</option>
            {TEAM_SIZE_BANDS.map((b) => <option key={b} value={b}>{b} people</option>)}
          </select>
        </label>
      </div>
      <div className="flex flex-col gap-4 md:flex-row">
        <label className={`${labelCls} md:flex-1`}>
          Office park / sector <span className="normal-case tracking-normal text-ink-faint">(optional)</span>
          <input value={parkOrSector} onChange={(e) => setParkOrSector(e.target.value)} placeholder="Candor TechSpace, Sector 62" className={inputCls} />
        </label>
        <label className={`${labelCls} md:flex-1`}>
          Phone <span className="normal-case tracking-normal text-ink-faint">(optional)</span>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className={inputCls} />
        </label>
      </div>
      <label className={labelCls}>
        Anything we should know? <span className="normal-case tracking-normal text-ink-faint">(optional)</span>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Order windows, floors, dietary constraints…" rows={3} className={inputCls} />
      </label>
      {error && <p role="alert" className="text-sm font-medium text-[var(--danger)]">{error}</p>}
      <Button
        type="button" disabled={!valid || busy} onClick={() => void submit()}
        shape="pill" size="fluid"
        className="mt-2 inline-flex w-full items-center justify-center px-8 py-4 font-semibold disabled:opacity-40"
      >
        {busy ? "Sending…" : submitLabel}
      </Button>
      {whatsApp && (
        <p className="text-center text-xs text-ink-muted">
          or{" "}
          <a
            href={`https://wa.me/${whatsApp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-gold-text underline underline-offset-2"
          >
            WhatsApp us
          </a>
        </p>
      )}
    </div>
  );
}
