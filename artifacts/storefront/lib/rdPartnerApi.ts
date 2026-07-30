/**
 * Dietitian-partner application funnel (Batch 3 / Route Brief 16). Public — no
 * auth, no money. The server owns all validation, the per-IP submission limit
 * (5 / 24 h) and the WhatsApp opt-in proof, so this client is a thin typed
 * transport: it does not re-validate, it does not decide whether an opt-in is
 * honoured, and it never invents a field the schema does not accept.
 *
 * Replaces the local-state dead end in components/rd-partners/PartnerWizard.tsx,
 * which rendered a success panel without ever transmitting the application.
 *
 * NOTE ON ERROR BRANCHING: the api-server answers these routes with a bare
 * `{ error }` and no `code`, so `ApiError.code` is always the "error" fallback.
 * Callers must branch on `status` — never on `code` — for these five paths.
 */
import { apiPost, type FetchImpl } from "./apiClient";

/** Which side of the network the applicant is joining. */
export type RdPath = "partner" | "advisory" | "both";

export type RdPracticeSetting =
  | "solo"
  | "clinic"
  | "hospital"
  | "corporate"
  | "academia"
  | "online-only"
  | "other";

export type RdClientVolumeBucket = "lt10" | "10_50" | "50_200" | "gt200";

export type RdNotifyPref = "daily" | "weekly" | "critical";

export const RD_PRACTICE_SETTINGS: readonly RdPracticeSetting[] = [
  "solo",
  "clinic",
  "hospital",
  "corporate",
  "academia",
  "online-only",
  "other",
];

export const RD_CLIENT_VOLUME_BUCKETS: readonly RdClientVolumeBucket[] = [
  "lt10",
  "10_50",
  "50_200",
  "gt200",
];

export const RD_NOTIFY_PREFS: readonly RdNotifyPref[] = [
  "daily",
  "weekly",
  "critical",
];

/** Human labels for the volume buckets — the wire values are not presentable. */
export const RD_CLIENT_VOLUME_LABELS: Record<RdClientVolumeBucket, string> = {
  lt10: "Under 10",
  "10_50": "10–50",
  "50_200": "50–200",
  gt200: "200+",
};

export interface RdPhone {
  /** Dial code, with or without a leading "+" — the server normalises it. */
  countryCode: string;
  phone: string;
}

/**
 * The full application payload. Field lengths mirror the server schema so the
 * form can enforce the same maxima client-side as hints rather than discovering
 * them through a 400.
 */
export interface RdApplicationInput {
  path: RdPath;
  /** 2–200 chars. */
  fullName: string;
  /** ≤200 chars. Unique — a repeat submission answers 409. */
  email: string;
  /** 1–200 chars, e.g. "RD, MSc Clinical Nutrition". */
  credentials: string;
  /** ≤120 chars, e.g. "IDA". */
  registrationBody?: string | null;
  /** ≤80 chars. */
  registrationNumber?: string | null;
  /** Integer 0–80. */
  yearsExperience: number;
  /** ≤20 entries, each ≤80 chars. */
  specializations?: string[];
  /** 2–200 chars. */
  cityRegion: string;
  /** ≤20 entries, each ≤40 chars. */
  languages?: string[];
  practiceSetting: RdPracticeSetting;
  clientVolumeBucket?: RdClientVolumeBucket | null;
  /** ≤20 entries, each ≤80 chars. */
  interests?: string[];
  /** ≤2000 chars. */
  bio?: string | null;
  whatsapp?: RdPhone;
  /** Honoured only if this session verified `whatsapp` via OTP first. */
  whatsappOptIn?: boolean;
  notifyPref?: RdNotifyPref;
  /** 8–64 chars, stable for the whole wizard. See `newRdSessionId`. */
  sessionId: string;
}

/** The persisted row, echoed back on success. Widened — the wizard only reads
 *  `id`, and pinning every column here would drift against the Drizzle table. */
export interface RdApplicationRow {
  id: number;
  path: RdPath;
  fullName: string;
  email: string;
  [key: string]: unknown;
}

export interface RdApplicationResult {
  application: RdApplicationRow;
  /** Ops-notification outcome. Informational — a false here does not mean the
   *  application failed to persist, so the UI must still confirm success. */
  notify?: unknown;
}

export interface RdSendOtpResult {
  ok: true;
  /** Present only when the WhatsApp transport is mocked (dev/staging). */
  devCode?: string;
}

export interface RdVerifyOtpResult {
  ok: true;
  /** Normalised E.164 the proof was minted against. */
  e164: string;
}

/**
 * Mint a wizard session id (8–64 chars). Generated ONCE per wizard and held
 * stable across every step: it is the key the server uses to stitch funnel
 * events and — critically — to look up the OTP proof at submit time. A per-step
 * regenerated id silently loses the WhatsApp opt-in.
 */
export function newRdSessionId(): string {
  const g: { crypto?: { randomUUID?: () => string } } =
    globalThis as unknown as { crypto?: { randomUUID?: () => string } };
  const uuid = g.crypto?.randomUUID?.();
  if (uuid) return uuid;
  // Deterministic-length fallback for runtimes without randomUUID.
  let out = "";
  while (out.length < 32) out += Math.random().toString(36).slice(2);
  return out.slice(0, 32);
}

/** Step 1 of the opt-in: ask the server to WhatsApp a code. 429 carries
 *  `retryAfterMs` (10/h per IP, 3/h per number); 502 means the transport
 *  failed and the applicant should proceed without the opt-in. */
export function sendRdWhatsappOtp(
  phone: RdPhone,
  fetchImpl?: FetchImpl,
): Promise<RdSendOtpResult> {
  return apiPost("/rd-partners/whatsapp/send-otp", phone, fetchImpl);
}

/** Step 2: exchange the code for server-side proof bound to `sessionId`.
 *  Without this, `whatsappOptIn: true` is silently downgraded at submit. */
export function verifyRdWhatsappOtp(
  input: RdPhone & { code: string; sessionId: string },
  fetchImpl?: FetchImpl,
): Promise<RdVerifyOtpResult> {
  return apiPost("/rd-partners/whatsapp/verify-otp", input, fetchImpl);
}

/**
 * Submit the application. Resolves once the row is persisted; ops notification
 * and the welcome packet are fired server-side and are not the caller's concern.
 *
 * Status branching for the UI: 400 invalid payload (body carries an `issues`
 * array the form can map to fields), 409 duplicate email, 429 submission limit
 * reached (5 per IP per 24 h).
 */
export function submitRdApplication(
  input: RdApplicationInput,
  fetchImpl?: FetchImpl,
): Promise<RdApplicationResult> {
  return apiPost("/rd-partners/applications", input, fetchImpl);
}

/** Funnel breadcrumb. Best-effort: a failure here must never block the wizard,
 *  so callers should swallow rejections rather than surface them. */
export function trackRdWizardEvent(
  input: {
    sessionId: string;
    eventName: string;
    step?: number;
    applicationId?: number;
    extra?: Record<string, unknown>;
  },
  fetchImpl?: FetchImpl,
): Promise<{ ok: true }> {
  return apiPost("/rd-partners/events", input, fetchImpl);
}
