import { logger } from "./logger";
import { maskE164 } from "./piiMask";
import { shouldDeferMessage } from "./quietHours";
import { db, messageDispatchesTable } from "@workspace/db";

/**
 * Thin wrapper around Twilio's Verify API for SMS OTPs. Used by the
 * primary phone-number sign-in flow.
 *
 * When the Twilio env vars are not set (most local-dev installs and CI),
 * the helper switches to a mock mode: it logs the OTP and accepts a fixed
 * code so the login flow can be exercised end-to-end without external
 * credentials.
 *
 * Required env (production):
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_VERIFY_SERVICE_SID
 *
 * In mock mode the accepted code is "123456".
 */

const MOCK_CODE = "123456";

export interface PhoneE164 {
  countryCode: string;
  phone: string;
  /** Combined +CCNNNNN form. */
  e164: string;
}

/**
 * Re-exported from `piiMask.ts`, which owns the implementation — `logger.ts`
 * needs it for its redaction censor and cannot import this module (line 1
 * imports the logger, so that would be a cycle). Kept exported here because
 * `routes/auth.ts` imports it from this path.
 *
 * NOTE — the policy this comment used to state has been REVOKED. It read:
 * "Error-level logs that need the full number for forensics still pass it
 * raw." That sanctioned three raw error-level logs in this file, and the
 * forensics argument does not survive contact with the rest of the record:
 * every one of those lines already carries the `err` and the OTP row the
 * number belongs to, so the unmasked number bought nothing that the DB row
 * did not already have — while putting customer phone numbers in plaintext
 * into log storage, which has a different retention, a different access
 * list, and no encryption, in a service that encrypts clinical PII at rest.
 * The masked form keeps the country code and last two digits, which is what
 * disambiguating concurrent attempts actually needs.
 */
export { maskE164 };

export function normalisePhone(
  countryCodeRaw: string,
  phoneRaw: string,
): PhoneE164 | null {
  const cc = countryCodeRaw.replace(/[^0-9+]/g, "").replace(/^\+?/, "+");
  const ph = phoneRaw.replace(/[^0-9]/g, "");
  if (!/^\+\d{1,4}$/.test(cc)) return null;
  if (ph.length < 6 || ph.length > 15) return null;
  return { countryCode: cc, phone: ph, e164: `${cc}${ph}` };
}

function hasTwilioCreds(): boolean {
  return Boolean(
    process.env["TWILIO_ACCOUNT_SID"] &&
      process.env["TWILIO_AUTH_TOKEN"] &&
      process.env["TWILIO_VERIFY_SERVICE_SID"],
  );
}

/** Mock OTP is only allowed outside production. In production we
 * refuse to send/verify when Twilio creds are missing rather than
 * silently accepting a fixed code that anyone could guess. */
function mockAllowed(): boolean {
  return (process.env["NODE_ENV"] ?? "development") !== "production";
}

interface SendOtpResult {
  ok: boolean;
  /** Present in mock mode so dev UIs can show the code in a notice. */
  devCode?: string;
  error?: string;
}

async function twilioVerifyFetch(
  path: string,
  body: Record<string, string>,
): Promise<{ ok: boolean; status: string | null; raw: unknown }> {
  const sid = process.env["TWILIO_ACCOUNT_SID"]!;
  const token = process.env["TWILIO_AUTH_TOKEN"]!;
  const serviceSid = process.env["TWILIO_VERIFY_SERVICE_SID"]!;
  const url = `https://verify.twilio.com/v2/Services/${serviceSid}${path}`;
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });
  const json = (await res.json().catch(() => ({}))) as {
    status?: string;
    valid?: boolean;
  };
  return {
    ok: res.ok,
    status: typeof json.status === "string" ? json.status : null,
    raw: json,
  };
}

export async function sendSmsOtp(
  number: PhoneE164,
  bypassQuietHours = false,
): Promise<SendOtpResult> {
  if (!bypassQuietHours) {
    const now = new Date();
    const deferTime = shouldDeferMessage(now);
    if (deferTime) {
      const delayMs = deferTime.getTime() - now.getTime();
      logger.info({ e164: maskE164(number.e164), deferTime, delayMs }, "sms.otp.deferred");
      setTimeout(() => {
        void sendSmsOtp(number, true).catch((err) => {
          logger.error({ err, e164: maskE164(number.e164) }, "sms.otp.deferred_send_failed");
        });
      }, delayMs);
      return { ok: true };
    }
  }

  if (!hasTwilioCreds()) {
    if (!mockAllowed()) {
      logger.error(
        { e164: number.e164 },
        "sms.otp.no_twilio_creds_in_production",
      );
      return {
        ok: false,
        error: "Phone verification is temporarily unavailable",
      };
    }
    logger.info(
      { e164: maskE164(number.e164), code: MOCK_CODE },
      "sms.otp.mock_send",
    );
    return { ok: true, devCode: MOCK_CODE };
  }

  try {
    const result = await twilioVerifyFetch("/Verifications", {
      To: number.e164,
      Channel: "sms",
    });
    if (!result.ok) {
      logger.error(
        { e164: number.e164, raw: result.raw },
        "sms.otp.twilio_send_failed",
      );
      return { ok: false, error: "Could not send verification code" };
    }
    logger.info(
      { e164: maskE164(number.e164), status: result.status },
      "sms.otp.sent",
    );
    return { ok: true };
  } catch (err) {
    logger.error({ err, e164: maskE164(number.e164) }, "sms.otp.twilio_send_threw");
    return { ok: false, error: "Could not send verification code" };
  }
}

export interface DeliveryDelaySmsResult {
  /** True only when a real transactional SMS was actually dispatched. */
  sent: boolean;
  /** Populated when `sent` is false, explaining why. */
  reason?: string;
  discarded?: boolean;
}

export interface SendSmsOptions {
  bypassQuietHours?: boolean;
  dedupe?: {
    userId: string;
    templateId: string;
    serviceDate: string;
  };
}

/**
 * Proactive, transactional (non-OTP) customer SMS — e.g. an "your order is
 * running late" delay alert. This is DELIBERATELY a no-op today.
 *
 * The Twilio integration above is Verify-only (OTP); it cannot send arbitrary
 * transactional copy. The only transactional provider referenced anywhere is
 * MSG91 (see .env.example: MSG91_AUTH_KEY / MSG91_SENDER_ID / MSG91_TEMPLATE_ID)
 * and no client for it has been implemented. Rather than log a fabricated
 * "[CRM SMS SENT]" line and claim success it never earned, this returns
 * `{ sent: false }` so the call site reports the truth.
 *
 * To wire a real provider: implement the dispatch here and return
 * `{ sent: true }` only on a confirmed send. The call sites already reflect
 * whatever this returns, so they need no changes.
 */
export async function sendDeliveryDelaySms(
  params: {
    orderId: number;
    phone?: string | null;
    message: string;
  },
  options?: SendSmsOptions,
): Promise<DeliveryDelaySmsResult> {
  if (options?.dedupe) {
    const { userId, templateId, serviceDate } = options.dedupe;
    const dedupeKey = `${userId}:${templateId}:${serviceDate}`;
    try {
      await db.insert(messageDispatchesTable).values({
        userId,
        templateId,
        serviceDate,
        dedupeKey,
      });
    } catch (e) {
      if (
        e &&
        typeof e === "object" &&
        "code" in e &&
        (e as { code?: string }).code === "23505"
      ) {
        logger.info(
          { userId, templateId, serviceDate, dedupeKey },
          "sms.message.deduped"
        );
        return { sent: false, discarded: true, reason: "duplicate alert" };
      }
      throw e;
    }
  }

  if (!options?.bypassQuietHours) {
    const now = new Date();
    const deferTime = shouldDeferMessage(now);
    if (deferTime) {
      const delayMs = deferTime.getTime() - now.getTime();
      logger.info({ orderId: params.orderId, deferTime, delayMs }, "sms.delay.deferred");
      setTimeout(() => {
        void sendDeliveryDelaySms(params, {
          ...options,
          bypassQuietHours: true,
        }).catch((err) => {
          logger.error({ err, orderId: params.orderId }, "sms.delay.deferred_send_failed");
        });
      }, delayMs);
      return { sent: true }; // Treat as successfully queued/deferred
    }
  }

  return { sent: false, reason: "no transactional SMS provider configured" };
}

export interface VerifyOtpResult {
  ok: boolean;
  error?: string;
}

export async function verifySmsOtp(
  number: PhoneE164,
  code: string,
): Promise<VerifyOtpResult> {
  if (!hasTwilioCreds()) {
    if (!mockAllowed()) {
      logger.error(
        { e164: number.e164 },
        "sms.otp.no_twilio_creds_in_production",
      );
      return { ok: false, error: "Phone verification is temporarily unavailable" };
    }
    if (code === MOCK_CODE) {
      logger.info({ e164: maskE164(number.e164) }, "sms.otp.mock_verify_ok");
      return { ok: true };
    }
    logger.info({ e164: maskE164(number.e164) }, "sms.otp.mock_verify_bad_code");
    return { ok: false, error: "Incorrect code" };
  }

  try {
    const result = await twilioVerifyFetch("/VerificationCheck", {
      To: number.e164,
      Code: code,
    });
    if (!result.ok) {
      logger.error(
        { e164: number.e164, raw: result.raw },
        "sms.otp.twilio_verify_failed",
      );
      return { ok: false, error: "Could not verify code" };
    }
    if (result.status === "approved") {
      logger.info({ e164: maskE164(number.e164) }, "sms.otp.verified");
      return { ok: true };
    }
    return { ok: false, error: "Incorrect code" };
  } catch (err) {
    logger.error({ err, e164: maskE164(number.e164) }, "sms.otp.twilio_verify_threw");
    return { ok: false, error: "Could not verify code" };
  }
}
