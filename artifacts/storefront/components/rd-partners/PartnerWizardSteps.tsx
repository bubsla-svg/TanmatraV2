"use client";
// The four step bodies of the RD partner wizard (Stitch brief 16).
// Presentational: every value and every setter comes from PartnerWizard, which
// owns the single draft. These components hold no state of their own, so
// stepping back and forth cannot lose a field, the funnel id or the opt-in.

import {
  RD_CLIENT_VOLUME_BUCKETS,
  RD_CLIENT_VOLUME_LABELS,
  RD_NOTIFY_PREFS,
  RD_PRACTICE_SETTINGS,
  type RdNotifyPref,
  type RdPath,
} from "@/lib/rdPartnerApi";
import { RD_BIO_MAX, type RdDraft } from "@/lib/rdWizard";
import {
  RD_INTERESTS,
  RD_LANGUAGES,
  RD_NOTIFY_PREF_LABELS,
  RD_PATH_OPTIONS,
  RD_PRACTICE_SETTING_LABELS,
  RD_SPECIALIZATIONS,
} from "@/content/landing/rdPartners";
import { Field, TextField, TextAreaField, SelectField, ChipCloud, Segmented } from "./WizardControls";
import { WhatsAppOptIn } from "./WhatsAppOptIn";

type Errors = Partial<Record<keyof RdDraft, string>>;
type Patch = (patch: Partial<RdDraft>) => void;

interface StepProps {
  draft: RdDraft;
  errors: Errors;
  patch: Patch;
  sessionId: string;
}

/** Add or remove one value from a capped multi-select. */
function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function PathStep({ draft, patch }: StepProps) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="sr-only">How you would like to join</legend>
      {RD_PATH_OPTIONS.map((o) => {
        const on = draft.path === o.id;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            onClick={() => patch({ path: o.id as RdPath })}
            className={`rounded-2xl border p-5 text-left transition-colors ${
              on ? "border-[var(--gold)] bg-[color-mix(in_srgb,var(--gold)_6%,transparent)]" : "border-line hover:border-line-strong"
            }`}
          >
            <span className={`text-base font-semibold ${on ? "text-gold-text" : "text-ink"}`}>{o.label}</span>
            <span className="mt-1 block text-sm leading-relaxed text-ink-muted">{o.desc}</span>
          </button>
        );
      })}
    </fieldset>
  );
}

function ProfileStep({ draft, errors, patch }: StepProps) {
  return (
    <>
      <Field label="Full name & title" error={errors.fullName} htmlFor="rd-name">
        <TextField
          id="rd-name"
          autoComplete="name"
          value={draft.fullName}
          onChange={(v) => patch({ fullName: v })}
          placeholder="Dt. Anjali Nair"
          invalid={!!errors.fullName}
        />
      </Field>
      <Field label="Professional email" error={errors.email} htmlFor="rd-email">
        <TextField
          id="rd-email"
          type="email"
          value={draft.email}
          onChange={(v) => patch({ email: v })}
          placeholder="you@clinic.com"
          invalid={!!errors.email}
        />
      </Field>
      <Field label="Credentials" error={errors.credentials} htmlFor="rd-cred">
        <TextField
          id="rd-cred"
          value={draft.credentials}
          onChange={(v) => patch({ credentials: v })}
          placeholder="RD, MSc Clinical Nutrition"
          invalid={!!errors.credentials}
        />
      </Field>
      <div className="grid gap-6 md:grid-cols-2">
        <Field label="Registration body (optional)" error={errors.registrationBody} htmlFor="rd-body">
          <TextField
            id="rd-body"
            value={draft.registrationBody}
            onChange={(v) => patch({ registrationBody: v })}
            placeholder="IDA"
            invalid={!!errors.registrationBody}
          />
        </Field>
        <Field label="Registration no. (optional)" error={errors.registrationNumber} htmlFor="rd-regno">
          <TextField
            id="rd-regno"
            value={draft.registrationNumber}
            onChange={(v) => patch({ registrationNumber: v })}
            placeholder="RD/DEL/2018/042"
            invalid={!!errors.registrationNumber}
          />
        </Field>
      </div>
    </>
  );
}

function PracticeStep({ draft, errors, patch, sessionId }: StepProps) {
  return (
    <>
      <Field label="Practice setting" error={errors.practiceSetting} htmlFor="rd-setting">
        <SelectField
          id="rd-setting"
          value={draft.practiceSetting}
          onChange={(v) => patch({ practiceSetting: v as RdDraft["practiceSetting"] })}
          placeholder="Select setting…"
          invalid={!!errors.practiceSetting}
          options={RD_PRACTICE_SETTINGS.map((s) => ({
            value: s,
            label: RD_PRACTICE_SETTING_LABELS[s] ?? s,
          }))}
        />
      </Field>

      <Field label="Current client volume (optional)">
        <Segmented
          legend="Current client volume"
          value={draft.clientVolumeBucket}
          onChange={(v) => patch({ clientVolumeBucket: v as RdDraft["clientVolumeBucket"] })}
          options={RD_CLIENT_VOLUME_BUCKETS.map((b) => ({
            value: b,
            label: RD_CLIENT_VOLUME_LABELS[b],
          }))}
        />
      </Field>

      <Field label="Core specialisations" error={errors.specializations}>
        <ChipCloud
          legend="Core specialisations"
          options={RD_SPECIALIZATIONS}
          selected={draft.specializations}
          onToggle={(v) => patch({ specializations: toggle(draft.specializations, v) })}
        />
      </Field>

      <Field label="Languages spoken" error={errors.languages}>
        <ChipCloud
          legend="Languages spoken"
          options={RD_LANGUAGES}
          selected={draft.languages}
          onToggle={(v) => patch({ languages: toggle(draft.languages, v) })}
        />
      </Field>

      <div className="grid gap-6 md:grid-cols-2">
        <Field label="Years of experience" error={errors.yearsExperience} htmlFor="rd-years">
          <TextField
            id="rd-years"
            type="number"
            inputMode="numeric"
            value={draft.yearsExperience}
            onChange={(v) => patch({ yearsExperience: v })}
            placeholder="12"
            invalid={!!errors.yearsExperience}
          />
        </Field>
        <Field label="City / region" error={errors.cityRegion} htmlFor="rd-city">
          <TextField
            id="rd-city"
            value={draft.cityRegion}
            onChange={(v) => patch({ cityRegion: v })}
            placeholder="Noida, UP"
            invalid={!!errors.cityRegion}
          />
        </Field>
      </div>

      <Field
        label="Short bio (optional)"
        error={errors.bio}
        htmlFor="rd-bio"
        hint={`${draft.bio.length} / ${RD_BIO_MAX}`}
      >
        <TextAreaField
          id="rd-bio"
          value={draft.bio}
          onChange={(v) => patch({ bio: v })}
          placeholder="Tell us briefly about your clinical philosophy…"
          invalid={!!errors.bio}
        />
      </Field>

      <hr className="border-line" />

      <WhatsAppOptIn
        sessionId={sessionId}
        countryCode={draft.phoneCountryCode}
        phone={draft.phone}
        verified={draft.whatsappVerified}
        onPhoneChange={(v) => patch({ phone: v })}
        onCountryCodeChange={(v) => patch({ phoneCountryCode: v })}
        onVerified={(v) => patch({ whatsappVerified: v })}
      />
    </>
  );
}

function ReviewStep({ draft, errors, patch }: StepProps) {
  const summary: { label: string; value: string }[] = [
    { label: "Path", value: RD_PATH_OPTIONS.find((o) => o.id === draft.path)?.label ?? draft.path },
    { label: "Name", value: draft.fullName.trim() },
    { label: "Email", value: draft.email.trim() },
    { label: "Credentials", value: draft.credentials.trim() },
    { label: "Experience", value: `${draft.yearsExperience} years` },
    { label: "City / region", value: draft.cityRegion.trim() },
    {
      label: "WhatsApp opt-in",
      value: draft.whatsappVerified && draft.phone.trim() ? "Verified" : "Not verified",
    },
  ];

  return (
    <>
      <Field label="What you want from the network" error={errors.interests}>
        <ChipCloud
          legend="What you want from the network"
          options={RD_INTERESTS}
          selected={draft.interests}
          onToggle={(v) => patch({ interests: toggle(draft.interests, v) })}
        />
      </Field>

      <Field label="Notification preference">
        <Segmented
          legend="Notification preference"
          value={draft.notifyPref}
          onChange={(v) => patch({ notifyPref: v as RdNotifyPref })}
          options={RD_NOTIFY_PREFS.map((p) => ({ value: p, label: RD_NOTIFY_PREF_LABELS[p] ?? p }))}
        />
      </Field>

      <dl className="flex flex-col gap-3 rounded-2xl border border-line bg-bg p-5">
        {summary.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4">
            <dt className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint">{row.label}</dt>
            <dd className="truncate text-sm text-ink">{row.value || "—"}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

/** Renders the body for `step`. Unknown indexes render nothing rather than throw. */
export function WizardStepBody({ step, ...props }: StepProps & { step: number }) {
  if (step === 0) return <PathStep {...props} />;
  if (step === 1) return <ProfileStep {...props} />;
  if (step === 2) return <PracticeStep {...props} />;
  if (step === 3) return <ReviewStep {...props} />;
  return null;
}
