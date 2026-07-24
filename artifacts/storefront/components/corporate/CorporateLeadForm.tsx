"use client";
// Client: public corporate/gym/club lead-capture form. The server owns
// validation + the per-IP rate limit; this gathers input and reflects the
// server's 201 / 400 / 429. No auth, no money surface.
import { useState } from "react";
import { ApiError } from "@/lib/apiClient";
import {
  submitCorporateLead,
  TEAM_SIZE_BANDS,
  type CorporateLeadKind,
  type TeamSizeBand,
} from "@/lib/corporateApi";

const KINDS: { id: CorporateLeadKind; label: string }[] = [
  { id: "corporate", label: "Corporate / office" },
  { id: "gym", label: "Gym" },
  { id: "fitness_club", label: "Fitness club" },
];
const inputCls =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink outline-none focus:border-line-strong";
const emailOk = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.trim());

export function CorporateLeadForm() {
  const [kind, setKind] = useState<CorporateLeadKind>("corporate");
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
        source: "web:/corporate",
      });
      setDone(true);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 429
          ? "Too many submissions from this network — please try again shortly."
          : e instanceof ApiError
            ? e.message
            : "Couldn't send that just now — please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-line bg-surface p-6 text-center">
        <p className="text-sm font-semibold text-ink">Thanks — we&rsquo;ll be in touch.</p>
        <p className="mt-1 text-sm text-ink-muted">Our team will reach out at {workEmail.trim()} shortly.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium text-ink">
        You&rsquo;re a
        <select value={kind} onChange={(e) => setKind(e.target.value as CorporateLeadKind)} className={inputCls}>
          {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
        </select>
      </label>
      <input aria-label="Your name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className={inputCls} />
      <input aria-label="Work email" type="email" value={workEmail} onChange={(e) => setWorkEmail(e.target.value)} placeholder="Work email" className={inputCls} />
      <input aria-label="Company or organisation" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company / organisation" className={inputCls} />
      <label className="flex flex-col gap-1 text-sm font-medium text-ink">
        Team size
        <select value={teamSizeBand} onChange={(e) => setTeamSizeBand(e.target.value as TeamSizeBand)} className={inputCls}>
          <option value="" disabled>Select team size</option>
          {TEAM_SIZE_BANDS.map((b) => <option key={b} value={b}>{b} people</option>)}
        </select>
      </label>
      <input aria-label="Office park or sector (optional)" value={parkOrSector} onChange={(e) => setParkOrSector(e.target.value)} placeholder="Office park / sector (optional)" className={inputCls} />
      <input aria-label="Phone (optional)" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" className={inputCls} />
      <textarea aria-label="Message (optional)" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Anything we should know? (optional)" rows={3} className={inputCls} />
      {error && <p role="alert" className="text-xs font-medium text-[var(--danger)]">{error}</p>}
      <button
        type="button" disabled={!valid || busy} onClick={() => void submit()}
        className="self-start rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-[var(--gold-ink)] disabled:opacity-40"
      >
        {busy ? "Sending…" : "Request a plan"}
      </button>
    </div>
  );
}
