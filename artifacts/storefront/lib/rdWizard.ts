/**
 * Pure state logic for the `/rd-partners/apply` wizard (Stitch brief 16).
 *
 * Kept out of the component for the reason the brief calls out: the wizard's
 * failure mode is state, not markup. Per-step validation, the draft→payload
 * mapping and the submit-error branching are all decisions with edge cases, so
 * they are tested here rather than buried in JSX.
 *
 * The draft holds every field as a STRING (or string[]) because that is what an
 * input yields; coercion to the wire types happens once, in `toApplicationInput`.
 */
import { ApiError } from "./apiClient";
import type {
  RdApplicationInput,
  RdClientVolumeBucket,
  RdNotifyPref,
  RdPath,
  RdPracticeSetting,
} from "./rdPartnerApi";

export interface RdDraft {
  path: RdPath;
  fullName: string;
  email: string;
  credentials: string;
  registrationBody: string;
  registrationNumber: string;
  yearsExperience: string;
  cityRegion: string;
  practiceSetting: RdPracticeSetting | "";
  clientVolumeBucket: RdClientVolumeBucket | "";
  specializations: string[];
  languages: string[];
  interests: string[];
  bio: string;
  notifyPref: RdNotifyPref;
  /** Dial code for the opt-in number, e.g. "+91". */
  phoneCountryCode: string;
  phone: string;
  /** True only once the server minted an OTP proof for this session. */
  whatsappVerified: boolean;
}

export const RD_BIO_MAX = 2000;

export function emptyRdDraft(): RdDraft {
  return {
    path: "partner",
    fullName: "",
    email: "",
    credentials: "",
    registrationBody: "",
    registrationNumber: "",
    yearsExperience: "",
    cityRegion: "",
    practiceSetting: "",
    clientVolumeBucket: "",
    specializations: [],
    languages: [],
    interests: [],
    bio: "",
    notifyPref: "weekly",
    phoneCountryCode: "+91",
    phone: "",
    whatsappVerified: false,
  };
}

const emailOk = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim());

/**
 * Field-level problems for ONE step, keyed by draft field. Empty object = the
 * step may be left. Mirrors the server's constraints so the applicant is not
 * taught the rules through a 400 (whose per-field `issues` the client cannot
 * read — ApiError carries only status/code/message).
 */
export function rdStepErrors(draft: RdDraft, step: number): Partial<Record<keyof RdDraft, string>> {
  const e: Partial<Record<keyof RdDraft, string>> = {};

  if (step === 1) {
    const name = draft.fullName.trim();
    if (name.length < 2) e.fullName = "Please enter your full name.";
    else if (name.length > 200) e.fullName = "Please keep this under 200 characters.";
    if (!emailOk(draft.email)) e.email = "Please enter a valid email address.";
    else if (draft.email.trim().length > 200) e.email = "Please keep this under 200 characters.";
    const cred = draft.credentials.trim();
    if (cred.length < 1) e.credentials = "Please list your credentials.";
    else if (cred.length > 200) e.credentials = "Please keep this under 200 characters.";
    if (draft.registrationBody.trim().length > 120) e.registrationBody = "Please keep this under 120 characters.";
    if (draft.registrationNumber.trim().length > 80) e.registrationNumber = "Please keep this under 80 characters.";
  }

  if (step === 2) {
    if (!draft.practiceSetting) e.practiceSetting = "Please choose a practice setting.";
    const years = Number(draft.yearsExperience);
    if (draft.yearsExperience.trim() === "" || !Number.isFinite(years)) {
      e.yearsExperience = "Please enter your years of experience.";
    } else if (!Number.isInteger(years) || years < 0 || years > 80) {
      e.yearsExperience = "Enter a whole number between 0 and 80.";
    }
    const city = draft.cityRegion.trim();
    if (city.length < 2) e.cityRegion = "Please enter your city or region.";
    else if (city.length > 200) e.cityRegion = "Please keep this under 200 characters.";
    if (draft.bio.length > RD_BIO_MAX) e.bio = `Please keep this under ${RD_BIO_MAX} characters.`;
    if (draft.specializations.length > 20) e.specializations = "Please choose at most 20.";
    if (draft.languages.length > 20) e.languages = "Please choose at most 20.";
  }

  if (step === 3 && draft.interests.length > 20) e.interests = "Please choose at most 20.";

  return e;
}

/** True when every field the step owns is acceptable. */
export function canLeaveRdStep(draft: RdDraft, step: number): boolean {
  return Object.keys(rdStepErrors(draft, step)).length === 0;
}

/** True when every step validates — the submit button's gate. */
export function isRdDraftComplete(draft: RdDraft): boolean {
  return [0, 1, 2, 3].every((s) => canLeaveRdStep(draft, s));
}

const trimmedOrUndefined = (v: string): string | undefined => {
  const t = v.trim();
  return t.length > 0 ? t : undefined;
};

/**
 * Draft → wire payload. Optional empties are dropped rather than sent as "",
 * which the schema would reject on the length-bounded fields.
 *
 * `whatsappOptIn` is asserted ONLY when this session actually verified the
 * number. Sending it optimistically is harmless server-side (it downgrades the
 * flag) but it would make the review step lie to the applicant.
 */
export function toRdApplicationInput(draft: RdDraft, sessionId: string): RdApplicationInput {
  const phone = draft.phone.trim();
  const optIn = draft.whatsappVerified && phone.length > 0;
  return {
    path: draft.path,
    fullName: draft.fullName.trim(),
    email: draft.email.trim(),
    credentials: draft.credentials.trim(),
    ...(trimmedOrUndefined(draft.registrationBody) && { registrationBody: draft.registrationBody.trim() }),
    ...(trimmedOrUndefined(draft.registrationNumber) && { registrationNumber: draft.registrationNumber.trim() }),
    yearsExperience: Number(draft.yearsExperience),
    cityRegion: draft.cityRegion.trim(),
    practiceSetting: (draft.practiceSetting || "other") as RdPracticeSetting,
    ...(draft.clientVolumeBucket && { clientVolumeBucket: draft.clientVolumeBucket }),
    ...(draft.specializations.length > 0 && { specializations: draft.specializations }),
    ...(draft.languages.length > 0 && { languages: draft.languages }),
    ...(draft.interests.length > 0 && { interests: draft.interests }),
    ...(trimmedOrUndefined(draft.bio) && { bio: draft.bio.trim() }),
    ...(phone.length > 0 && {
      whatsapp: { countryCode: draft.phoneCountryCode.trim(), phone },
    }),
    ...(optIn && { whatsappOptIn: true }),
    notifyPref: draft.notifyPref,
    sessionId,
  };
}

export interface RdSubmitProblem {
  title: string;
  detail: string;
  /** True when retrying the same payload cannot succeed. */
  terminal: boolean;
}

/**
 * Submit failure → banner copy. Branches on STATUS, never on `code`: these
 * routes answer with a bare `{ error }`, so `ApiError.code` is always the
 * fallback string (see rdPartnerApi's note). An unknown failure stays
 * retryable — the applicant must never be left with a dead button.
 */
export function rdSubmitProblem(error: unknown): RdSubmitProblem {
  if (error instanceof ApiError) {
    if (error.status === 409) {
      return {
        title: "An application with this email already exists.",
        detail: "We already have you on file — reply to our onboarding email and we'll pick it up from there.",
        terminal: true,
      };
    }
    if (error.status === 429) {
      return {
        title: "Too many applications from this network.",
        detail: "The limit is 5 per day. Please try again tomorrow, or email us if it's urgent.",
        terminal: true,
      };
    }
    if (error.status === 400) {
      return {
        title: "Some of these details were rejected.",
        detail: error.message || "Please check the highlighted fields and try again.",
        terminal: false,
      };
    }
    return {
      title: "We couldn't submit your application.",
      detail: error.message || "Please try again in a moment.",
      terminal: false,
    };
  }
  return {
    title: "We couldn't submit your application.",
    detail: "Please check your connection and try again.",
    terminal: false,
  };
}
