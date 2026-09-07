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
 * The PHONE field stays a native <input> inside Astryx Field, and the reason
 * is `type`, not `inputMode`: TextInputType is text|password|email only, and
 * TextInput destructures `type` and applies it AFTER its ...rest spread, so
 * no prop can deliver type="tel" — which is what raises the phone keypad.
 * (inputMode is missing only from the PROP TYPE and would in fact ride in as
 * a rest prop; it is not worth doing without type="tel" beside it.)
 * The Astryx fields carry htmlName AND an autocomplete token. htmlName alone
 * only feeds the browser's name/type heuristic; WCAG 1.3.5 (Identify Input
 * Purpose) asks for the autocomplete attribute itself, so the two are not
 * interchangeable. TextInputProps has no autoComplete slot — BaseProps
 * extends React.HTMLAttributes, which never declares it (autoComplete lives
 * on InputHTMLAttributes) — but TextInput spreads its rest props onto the
 * <input> BEFORE its own attributes, so a JSX object spread delivers the
 * token to the DOM and nothing downstream can clobber it. Submission logic,
 * validation gate, 429 copy, lpEvents ordering and the role="alert" error
 * line are untouched. */
const emailOk = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.trim());

const phoneInputCls =
  "w-full min-h-[50px] rounded-2xl border border-line bg-surface px-4 py-3 text-base text-ink outline-none transition-colors placeholder:text-ink-faint focus-visible:border-primary";

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

  // Fix-first status line (AlacarteDetails.tsx's blockedReason idiom): a
  // typo'd email used to leave this button permanently disabled with zero
  // explanation, and per-field errors were unreachable by construction
  // (submit can't be attempted while invalid). Order matches field order.
  const blockedReason =
    name.trim().length < 2
      ? "Enter your name"
      : !emailOk(workEmail)
        ? "Enter a valid work email"
        : company.trim().length < 2
          ? "Enter your company name"
          : teamSizeBand === ""
            ? "Choose a team size"
            : null;
  const valid = blockedReason === null;

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
          {...{ autoComplete: "name" }}
          isRequired
        />
        <TextInput
          label="Work email"
          type="email"
          value={workEmail}
          onChange={setWorkEmail}
          placeholder="you@company.com"
          htmlName="email"
          {...{ autoComplete: "email" }}
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
          {...{ autoComplete: "organization" }}
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
      {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
      {blockedReason !== null && !busy && (
        <p role="status" className="text-xs font-medium text-ink-muted">{blockedReason}</p>
      )}
      <Button
        type="button" disabled={!valid || busy} onClick={() => void submit()}
        aria-busy={busy} aria-live="polite"
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
            className="font-medium text-primary underline underline-offset-2"
          >
            WhatsApp us
          </a>
        </p>
      )}
    </div>
  );
}
