/**
 * Partner lead capture (Stitch brief 17) — `POST /partners/leads`.
 *
 * NOT the same endpoint as the corporate form. The schema differs in three ways
 * that matter to the UI, all mirrored here from
 * `artifacts/api-server/src/routes/partnerLeads.ts`:
 *
 *  1. `kind` is the partner set (gym | rd | trainer | dietitian | fitness_club),
 *     not the corporate set.
 *  2. `email` OR `workEmail` — at least one is required, either satisfies it.
 *  3. `rdRegNo` is optional in general but REQUIRED, and format-checked, when
 *     kind is `rd` or `dietitian`.
 *
 * The server owns validation and the per-IP limit (5/hour); this module mirrors
 * the constraints only so the applicant is not taught them through a 400.
 */
import { apiPost, type FetchImpl } from "./apiClient";

export type PartnerLeadKind = "gym" | "rd" | "trainer" | "dietitian" | "fitness_club";

export const PARTNER_LEAD_KINDS: readonly PartnerLeadKind[] = [
  "gym",
  "rd",
  "trainer",
  "dietitian",
  "fitness_club",
];

export const PARTNER_LEAD_KIND_LABELS: Record<PartnerLeadKind, string> = {
  gym: "Gym",
  fitness_club: "Fitness club",
  trainer: "Personal trainer",
  rd: "Registered dietitian",
  dietitian: "Dietitian / nutritionist",
};

/** Kinds for which a registration number is mandatory. */
export const REG_NO_REQUIRED_KINDS: readonly PartnerLeadKind[] = ["rd", "dietitian"];

/**
 * The server's registration-number format. First character alphanumeric, then
 * 2–30 more from the same set plus space, slash, dot and hyphen — so 3–31
 * characters total. The route ALSO rejects anything shorter than 4, which the
 * pattern alone would allow; `regNoProblem` applies both.
 */
export const REG_NO_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\s/.-]{2,30}$/;
export const REG_NO_MIN_LENGTH = 4;

export interface PartnerLeadInput {
  kind: PartnerLeadKind;
  /** 2–80 chars. */
  name: string;
  /** Valid email, ≤254. At least one of email / workEmail must be present. */
  email?: string;
  workEmail?: string;
  /** ≤120 chars. */
  company?: string;
  /** ≤32 chars. */
  teamSizeBand?: string;
  /** ≤120 chars. */
  parkOrSector?: string;
  /** ≤20 chars. */
  phone?: string;
  /** ≤80 chars. Required when kind is rd/dietitian — see REG_NO_PATTERN. */
  rdRegNo?: string;
  /** ≤64 chars. */
  practiceSetting?: string;
  /** ≤1000 chars. */
  message?: string;
  /** ≤160 chars. */
  source?: string;
}

export function isRegNoRequired(kind: PartnerLeadKind): boolean {
  return REG_NO_REQUIRED_KINDS.includes(kind);
}

/**
 * Why this registration number is unacceptable for this kind, or null when it
 * is fine. Returns null for kinds that do not need one, even if blank.
 */
export function regNoProblem(kind: PartnerLeadKind, value: string): string | null {
  const v = value.trim();
  if (!isRegNoRequired(kind)) return null;
  if (v.length === 0) return "A registration number is required for dietitians.";
  if (v.length < REG_NO_MIN_LENGTH || !REG_NO_PATTERN.test(v)) {
    return "Use 4–31 characters: letters, numbers, spaces, / . or - (e.g. RD-1234 or IDA/5678).";
  }
  return null;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Field problems for the partner lead form, keyed by field. Empty = submittable.
 * `email` carries the either-or requirement: the server reports that failure on
 * the `email` path, so the form does too.
 */
export function partnerLeadProblems(
  input: Pick<PartnerLeadInput, "kind" | "name"> & {
    email: string;
    workEmail: string;
    rdRegNo: string;
    phone?: string;
    company?: string;
  },
): Partial<Record<"name" | "email" | "workEmail" | "rdRegNo" | "phone" | "company", string>> {
  const problems: Partial<Record<"name" | "email" | "workEmail" | "rdRegNo" | "phone" | "company", string>> = {};

  const name = input.name.trim();
  if (name.length < 2) problems.name = "Please enter your name.";
  else if (name.length > 80) problems.name = "Please keep this under 80 characters.";

  const email = input.email.trim();
  const workEmail = input.workEmail.trim();
  if (email.length === 0 && workEmail.length === 0) {
    problems.email = "Please give us an email address.";
  } else {
    if (email.length > 0 && !EMAIL_RE.test(email)) problems.email = "Please enter a valid email address.";
    if (workEmail.length > 0 && !EMAIL_RE.test(workEmail)) {
      problems.workEmail = "Please enter a valid email address.";
    }
  }

  const reg = regNoProblem(input.kind, input.rdRegNo);
  if (reg) problems.rdRegNo = reg;

  if ((input.phone ?? "").trim().length > 20) problems.phone = "Please keep this under 20 characters.";
  if ((input.company ?? "").trim().length > 120) problems.company = "Please keep this under 120 characters.";

  return problems;
}

export interface PartnerLeadResult {
  ok?: boolean;
  id?: number;
  [key: string]: unknown;
}

/** Submit a partner lead. 400 invalid payload, 429 limit reached (5/hour per IP). */
export function submitPartnerLead(
  input: PartnerLeadInput,
  fetchImpl?: FetchImpl,
): Promise<PartnerLeadResult> {
  return apiPost("/partners/leads", input, fetchImpl);
}
