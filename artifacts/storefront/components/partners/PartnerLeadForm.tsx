"use client"; // Justification: controlled form state and network lead submission.
import { useState } from "react";
import { Selector } from "@astryxdesign/core/Selector";
import { TextInput } from "@astryxdesign/core/TextInput";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Field } from "@astryxdesign/core/Field";
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
import { Button } from "@/components/ui/button";

/* Stage-4 Astryx adoption: field chrome only. The WizardControls
 * Field/TextField/TextAreaField/SelectField stack became TextInput/TextArea/
 * Selector (each renders its own label + shell — never wrap them in Field).
 * Per-field errors now flow through status={{type:'error', message}} — that
 * keeps aria-invalid + the visible message; the per-field role="alert" of the
 * old Field is accepted as lost (no spec targets it). The PHONE field stays a
 * native <input> inside Astryx Field: TextInput's type is text|password|email
 * only and its BaseProps deliberately omit inputMode/autoComplete, so a swap
 * would cost the tel keyboard + autofill — its error line stays hand-rolled
 * (role="alert", as before). htmlName carries autofill semantics for the
 * Astryx fields. The partnerLeadProblems/showErrors gate (submit reveals
 * errors, button NOT disabled), submit(), 429 copy, lpEvents ordering, done
 * branch, form-level role="alert" and the wa.me link are untouched. */
const phoneInputCls =
  "w-full min-h-[50px] rounded-2xl border border-line bg-surface px-4 py-3 text-base text-ink outline-none transition-colors placeholder:text-ink-faint focus-visible:border-primary";

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
      <div className="rounded-2xl border border-line bg-surface p-8 text-center">
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
  const errStatus = (msg: string | undefined) =>
    msg ? ({ type: "error", message: msg } as const) : undefined;
  const emailErr = err("email") ?? err("workEmail");
  const phoneErr = err("phone");

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6">
      {!lockKind && (
        <Selector
          label="You're a"
          value={kind}
          onChange={(v) => setKind(v as PartnerLeadKind)}
          placeholder="Select…"
          options={PARTNER_LEAD_KINDS.map((k) => ({ value: k, label: PARTNER_LEAD_KIND_LABELS[k] }))}
        />
      )}
      <TextInput
        label="Your name"
        value={name}
        onChange={setName}
        placeholder="Your name"
        htmlName="name"
        status={errStatus(err("name"))}
      />
      <TextInput
        label="Work email"
        type="email"
        value={workEmail}
        onChange={setWorkEmail}
        placeholder="you@yourgym.com"
        htmlName="email"
        status={errStatus(emailErr)}
      />
      <TextInput
        label="Gym / studio name"
        value={company}
        onChange={setCompany}
        placeholder="Iron Yard, Sector 62"
        isOptional
        status={errStatus(err("company"))}
      />

      {/* Revealed only for the kinds the server format-checks. */}
      {regNoNeeded && (
        <TextInput
          label="Registration number"
          value={rdRegNo}
          onChange={setRdRegNo}
          placeholder="RD-1234 or IDA/5678"
          description="Required for dietitians"
          status={errStatus(err("rdRegNo"))}
        />
      )}

      <Field label="Phone" inputID="pl-phone" isOptional>
        <input
          id="pl-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone"
          aria-invalid={phoneErr ? true : undefined}
          className={phoneInputCls}
        />
      </Field>
      {phoneErr && (
        <p role="alert" className="text-2xs font-medium text-danger">
          {phoneErr}
        </p>
      )}

      <TextArea
        label="Anything we should know?"
        value={message}
        onChange={setMessage}
        placeholder="Member count, location, what you're hoping for…"
        rows={3}
        isOptional
      />

      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
      <Button
        type="button"
        disabled={busy}
        onClick={() => void submit()}
        aria-busy={busy}
        aria-live="polite"
        shape="pill"
        size="fluid"
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
            className="font-medium text-primary underline underline-offset-2"
          >
            WhatsApp us
          </a>
        </p>
      )}
    </div>
  );
}
