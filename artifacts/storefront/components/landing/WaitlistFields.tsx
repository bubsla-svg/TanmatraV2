"use client"; // Interactive clinical waitlist input fields and selector
// Rendered form input controls for clinical waitlist enrollment
import {
  TIERS,
  waitlistInputCls as inputCls,
  type ClinicalWaitlistTier,
} from "./WaitlistTypes";

export interface WaitlistFieldsProps {
  kind: ClinicalWaitlistTier;
  onKindChange: (val: ClinicalWaitlistTier) => void;
  lockTier: boolean;
  name: string;
  onNameChange: (val: string) => void;
  email: string;
  onEmailChange: (val: string) => void;
  phone: string;
  onPhoneChange: (val: string) => void;
  notes: string;
  onNotesChange: (val: string) => void;
}

export function WaitlistFields({
  kind,
  onKindChange,
  lockTier,
  name,
  onNameChange,
  email,
  onEmailChange,
  phone,
  onPhoneChange,
  notes,
  onNotesChange,
}: WaitlistFieldsProps) {
  return (
    <div className="flex flex-col gap-3.5">
      {!lockTier && (
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink">
          Select Clinical Tier
          <select
            value={kind}
            onChange={(e) => onKindChange(e.target.value as ClinicalWaitlistTier)}
            className={inputCls}
          >
            {TIERS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label} — {t.description}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          aria-label="Full name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Your full name"
          className={inputCls}
          required
        />
        <input
          aria-label="Email address"
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder="Email address"
          className={inputCls}
          required
        />
      </div>

      <input
        aria-label="Phone number"
        type="tel"
        value={phone}
        onChange={(e) => onPhoneChange(e.target.value)}
        placeholder="Phone number (optional for priority WhatsApp)"
        className={inputCls}
      />

      <textarea
        aria-label="Clinical notes"
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        placeholder="Any metabolic conditions or dietary notes? (optional)"
        rows={2}
        className={inputCls}
      />
    </div>
  );
}
