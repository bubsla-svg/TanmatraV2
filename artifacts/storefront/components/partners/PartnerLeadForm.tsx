"use client"; // Justification: controlled form state and network lead submission.
import { useState } from "react";
import { ApiError } from "@/lib/apiClient";
import { emitLpEvent } from "@/lib/lpEvents";
import {
  submitPartnerLead,
  partnerLeadProblems,
  isRegNoRequired,
  PARTNER_LEAD_KINDS,
  PARTNER_LEAD_KIND_LABELS,
  type PartnerLeadKind,
} from "@/lib/partnerLeadsApi";
import { Field, TextField, TextAreaField, SelectField } from "@/components/rd-partners/WizardControls";

/**
 * Partner lead form (Stitch brief 17) — posts to `/partners/leads`, NOT the
 * corporate endpoint. Two contract details drive the layout:
 *
 *  - `rdRegNo` is required, and format-checked, only for the rd/dietitian kinds.
 *    The brief calls this out: a flat always-optional column cannot express it,
 *    so the field is REVEALED when the kind demands it and given room for the
 *    format-error copy underneath.
 *  - The server needs email OR workEmail, so one address field satisfies it and
 *    the failure is reported where the server reports it.
 */
export function PartnerLeadForm({
  defaultKind = "gym",
  lockKind = false,
  source,
  submitLabel = "Apply for partnership",
  whatsApp,
}: {
  defaultKind?: PartnerLeadKind;
  /** Hide the kind chooser when the page already implies it. */
  lockKind?: boolean;
  source: string;
  submitLabel?: string;
  whatsApp?: string;
}) {
  const [kind, setKind] = useState<PartnerLeadKind>(defaultKind);
  const [name, setName] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [rdRegNo, setRdRegNo] = useState("");
  const [message, setMessage] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const problems = partnerLeadProblems({ kind, name, email: "", workEmail, rdRegNo, phone, company });
  const regNoNeeded = isRegNoRequired(kind);

  async function submit() {
    if (Object.keys(problems).length > 0) {
      setShowErrors(true);
      return;
    }
    setBusy(true);
    setError(null);
    emitLpEvent("lead_submit", { page: source, kind });
    try {
      await submitPartnerLead({
        kind,
        name: name.trim(),
        workEmail: workEmail.trim(),
        ...(company.trim() && { company: company.trim() }),
        ...(phone.trim() && { phone: phone.trim() }),
        ...(regNoNeeded && rdRegNo.trim() && { rdRegNo: rdRegNo.trim() }),
        ...(message.trim() && { message: message.trim() }),
        source,
      });
      emitLpEvent("lead_success", { page: source, kind });
      setDone(true);
    } catch (e) {
      const msg =
        e instanceof ApiError && e.status === 429
          ? "Too many applications from this network — please try again in an hour."
          : e instanceof ApiError
            ? e.message || "Please check the highlighted fields and try again."
            : "Couldn't send that just now — please try again.";
      setError(msg);
      emitLpEvent("lead_error", { page: source, error: msg });
    } finally {
      setBusy(false);
    }
  }

  // Only reached once the server persisted the lead.
  if (done) {
    return (
      <div className="rounded-3xl border border-line bg-surface p-8 text-center">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-sage-soft text-sage-text">
          ✓
        </span>
        <p className="mt-4 text-base font-semibold text-ink">Thanks — we&rsquo;ll be in touch.</p>
        <p className="mt-1 text-sm text-ink-muted">
          Our partner desk will reach out at {workEmail.trim()} shortly.
        </p>
      </div>
    );
  }

  const err = (field: keyof typeof problems) => (showErrors ? problems[field] : undefined);

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-6">
      {!lockKind && (
        <Field label="You're a" htmlFor="pl-kind">
          <SelectField
            id="pl-kind"
            value={kind}
            onChange={(v) => setKind(v as PartnerLeadKind)}
            placeholder="Select…"
            options={PARTNER_LEAD_KINDS.map((k) => ({ value: k, label: PARTNER_LEAD_KIND_LABELS[k] }))}
          />
        </Field>
      )}
      <Field label="Your name" error={err("name")} htmlFor="pl-name">
        <TextField id="pl-name" value={name} onChange={setName} placeholder="Your name" invalid={!!err("name")} />
      </Field>
      <Field label="Work email" error={err("email") ?? err("workEmail")} htmlFor="pl-email">
        <TextField
          id="pl-email"
          type="email"
          value={workEmail}
          onChange={setWorkEmail}
          placeholder="you@yourgym.com"
          invalid={!!(err("email") || err("workEmail"))}
        />
      </Field>
      <Field label="Gym / studio name (optional)" error={err("company")} htmlFor="pl-company">
        <TextField id="pl-company" value={company} onChange={setCompany} placeholder="Iron Yard, Sector 62" invalid={!!err("company")} />
      </Field>

      {/* Revealed only for the kinds the server format-checks. */}
      {regNoNeeded && (
        <Field
          label="Registration number"
          error={err("rdRegNo")}
          htmlFor="pl-regno"
          hint="Required for dietitians"
        >
          <TextField
            id="pl-regno"
            value={rdRegNo}
            onChange={setRdRegNo}
            placeholder="RD-1234 or IDA/5678"
            invalid={!!err("rdRegNo")}
          />
        </Field>
      )}

      <Field label="Phone (optional)" error={err("phone")} htmlFor="pl-phone">
        <TextField id="pl-phone" type="tel" value={phone} onChange={setPhone} placeholder="Phone" invalid={!!err("phone")} />
      </Field>
      <Field label="Anything we should know? (optional)" htmlFor="pl-msg">
        <TextAreaField
          id="pl-msg"
          value={message}
          onChange={setMessage}
          placeholder="Member count, location, what you're hoping for…"
          rows={3}
        />
      </Field>

      {error && (
        <p role="alert" className="text-xs font-medium text-[var(--danger)]">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => void submit()}
        className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-gold px-8 py-4 text-sm font-semibold text-[var(--gold-ink)] transition-transform active:scale-[0.98] disabled:opacity-40"
      >
        {busy ? "Sending…" : submitLabel}
      </button>
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
