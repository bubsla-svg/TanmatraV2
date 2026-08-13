"use client"; // Justification: client-side form field state and network lead submission.
import { useState } from "react";
import { Grid } from "@astryxdesign/core/Grid";
import { Selector } from "@astryxdesign/core/Selector";
import { TextInput } from "@astryxdesign/core/TextInput";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Field } from "@astryxdesign/core/Field";
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
/* Stage-4 Astryx adoption: field chrome only. The hand-rolled inputCls/labelCls
 * strings and label-nested inputs became TextInput/TextArea/Selector (each
 * renders its own label + Field shell — never wrap them in Field again), and
 * the `flex-col md:flex-row` pair rows became the contact-form skeleton's
 * Grid columns={{minWidth}} idiom, which collapses responsively for free.
 * The PHONE field stays a native <input> inside Astryx Field: TextInput's
 * type is text|password|email only and its BaseProps deliberately omit
 * inputMode/autoComplete, so a swap would cost the tel keyboard + autofill.
 * htmlName carries autofill semantics for the Astryx fields (browsers key
 * autofill off name/type). Submission logic, validation gate, 429 copy,
 * lpEvents ordering and the role="alert" error line are untouched. */
const emailOk = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.trim());

const phoneInputCls =
  "w-full rounded-xl border border-line bg-bg px-4 py-3 text-base text-ink outline-none transition-colors focus-visible:border-[var(--gold)] focus-visible:ring-1 focus-visible:ring-[var(--gold)]";

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
        <Selector
          label="You're a"
          value={kind}
          onChange={(v) => setKind(v as CorporateLeadKind)}
          options={KINDS.map((k) => ({ value: k.id, label: k.label }))}
        />
      )}
      <Grid gap={4} columns={{ minWidth: 260 }}>
        <TextInput
          label="Your name"
          value={name}
          onChange={setName}
          placeholder="Priya Sharma"
          htmlName="name"
          isRequired
        />
        <TextInput
          label="Work email"
          type="email"
          value={workEmail}
          onChange={setWorkEmail}
          placeholder="you@company.com"
          htmlName="email"
          isRequired
        />
      </Grid>
      <Grid gap={4} columns={{ minWidth: 260 }}>
        <TextInput
          label="Company"
          value={company}
          onChange={setCompany}
          placeholder="Company / organisation"
          htmlName="organization"
          isRequired
        />
        <Selector
          label="Team size"
          placeholder="Choose team size"
          value={teamSizeBand === "" ? undefined : teamSizeBand}
          onChange={(v) => setTeamSizeBand(v as TeamSizeBand)}
          options={TEAM_SIZE_BANDS.map((b) => ({ value: b, label: `${b} people` }))}
          isRequired
        />
      </Grid>
      <Grid gap={4} columns={{ minWidth: 260 }}>
        <TextInput
          label="Office park / sector"
          value={parkOrSector}
          onChange={setParkOrSector}
          placeholder="Candor TechSpace, Sector 62"
          isOptional
        />
        <Field label="Phone" inputID="cl-phone" isOptional>
          <input
            id="cl-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone"
            className={phoneInputCls}
          />
        </Field>
      </Grid>
      <TextArea
        label="Anything we should know?"
        value={message}
        onChange={setMessage}
        placeholder="Order windows, floors, dietary constraints…"
        rows={3}
        isOptional
      />
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
