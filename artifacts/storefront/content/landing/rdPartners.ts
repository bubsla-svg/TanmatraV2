/**
 * `/rd-partners/apply` wizard vocabulary (Stitch brief 16).
 *
 * These are INPUT OPTION SETS, not product claims — the same category as
 * `TEAM_SIZE_BANDS` on the corporate form. The server accepts free strings for
 * specialisations / languages / interests (≤20 entries each); constraining the
 * UI to a fixed vocabulary keeps the partner directory searchable instead of
 * accumulating fifty spellings of "gut health".
 *
 * Nothing here asserts anything about Tanmatra's own capabilities. Copy that
 * does make claims lives with the page, not in this list.
 */

export interface RdWizardStepMeta {
  /** Short caps label for the stepper. */
  label: string;
  /** Heading inside the form card. */
  heading: string;
}

/** The four wizard steps, in order. Index is the step number. */
export const RD_WIZARD_STEPS: RdWizardStepMeta[] = [
  { label: "Path", heading: "How you'd like to join" },
  { label: "Profile", heading: "You and your credentials" },
  { label: "Practice", heading: "Practice details" },
  { label: "Review", heading: "What you want from the network" },
];

export const RD_PATH_OPTIONS = [
  {
    id: "partner",
    label: "Prescribing partner",
    desc: "Prescribe macro-calibrated meals to your own patients and track adherence.",
  },
  {
    id: "advisory",
    label: "Clinical advisory",
    desc: "Review protocols, menus and contraindication rules for the network.",
  },
  {
    id: "both",
    label: "Both",
    desc: "Prescribe for your patients and sit on the clinical advisory side.",
  },
] as const;

/** Human labels for the wire-level practice settings. */
export const RD_PRACTICE_SETTING_LABELS: Record<string, string> = {
  solo: "Private practice (solo)",
  clinic: "Group practice / clinic",
  hospital: "Hospital",
  corporate: "Corporate / occupational health",
  academia: "Academia",
  "online-only": "Telehealth only",
  other: "Other",
};

export const RD_NOTIFY_PREF_LABELS: Record<string, string> = {
  daily: "Daily digest",
  weekly: "Weekly digest",
  critical: "Critical only",
};

/** Standard RD practice areas. Kept clinical and conservative. */
export const RD_SPECIALIZATIONS = [
  "Metabolic health",
  "Type 2 diabetes",
  "PCOS",
  "Thyroid",
  "Gut health",
  "Renal",
  "Cardiac",
  "Weight management",
  "Sports nutrition",
  "Paediatric",
  "Geriatric",
  "Oncology support",
  "Pregnancy & lactation",
] as const;

export const RD_LANGUAGES = [
  "English",
  "Hindi",
  "Punjabi",
  "Bengali",
  "Marathi",
  "Gujarati",
  "Tamil",
  "Telugu",
  "Kannada",
  "Malayalam",
  "Urdu",
] as const;

/** What the applicant wants out of the partnership. */
export const RD_INTERESTS = [
  "Prescribing meals for patients",
  "Referral income",
  "Clinical advisory board",
  "Co-authoring protocols",
  "Research collaboration",
  "Continuing education",
  "Speaking & events",
] as const;

export const RD_WHATSAPP_COPY = {
  heading: "WhatsApp verification",
  blurb:
    "We use WhatsApp for priority partner communications and immediate client handoffs. Optional — you can finish your application without it.",
  skip: "Skip for now",
} as const;
