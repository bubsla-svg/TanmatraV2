/**
 * OTP SMS auto-fill seam.
 *
 * `extractOtpCode` is the pure, unit-testable part: pull the 6-digit code out
 * of an incoming SMS body. `startSmsRetriever` is the platform seam — a real
 * Android SMS Retriever / iOS one-time-code integration is a native module and
 * a follow-up (see docs/NATIVE-ONBOARDING-PORT-PLAN.md). Until it lands this is
 * a no-op listener: onboarding works with manual code entry, and auto-fill
 * simply doesn't trigger. It never fabricates a code.
 */

import { OTP_LENGTH } from "./phone";

/** Extract the first N-digit code from an SMS body, or null if none. */
export function extractOtpCode(
  smsText: string | null | undefined,
): string | null {
  if (!smsText) return null;
  const match = smsText.match(new RegExp(`\\b(\\d{${OTP_LENGTH}})\\b`));
  return match ? (match[1] ?? null) : null;
}

export interface SmsRetrieverOptions {
  onCode: (code: string) => void;
}

/**
 * Start listening for an incoming OTP SMS. Returns an unsubscribe function.
 * No-op today (see module doc) — returns a disposer that does nothing, so call
 * sites can wire it now and get auto-fill for free once the native module lands.
 */
export function startSmsRetriever(_options: SmsRetrieverOptions): () => void {
  return () => {};
}
