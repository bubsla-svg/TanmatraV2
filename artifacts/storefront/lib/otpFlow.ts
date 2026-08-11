/**
 * OTP flow rules — pure, DOM-free, and unit-tested, so the phone-auth state
 * machine cannot dead-end.
 *
 * The bug class this exists to kill: a primary action ("Send code", "Verify")
 * that runs, fails a precondition, and returns silently — leaving the user on
 * a screen that never advanced and never explained why. PhoneAuth had two of
 * those (`if (!el) return;` and `if (!verification.current) return;`), and its
 * "Resend" control did not resend at all: it walked the stage back to the
 * phone input, so the code the user was waiting for never came.
 *
 * Pure and "@/"-free on purpose: lib/ runs under `node --test` with no path
 * aliases (lint:filecap enforces it), so these rules are tested without a
 * browser, a Firebase config, or a rendered component.
 */

/** Seconds a user must wait between SMS sends. Firebase rate-limits the same
 *  number aggressively; a resend that fires instantly burns the quota and the
 *  user gets nothing. */
export const RESEND_COOLDOWN_SEC = 30;

/** Indian mobile numbers are 10 digits; we prepend +91 at the call site. */
export const PHONE_DIGITS = 10;

/** Firebase SMS codes are always 6 digits. */
export const CODE_DIGITS = 6;

export type OtpStage = "collapsed" | "phone" | "code";

export function digitsOf(value: string): string {
  return value.replace(/\D/g, "");
}

export function isPhoneValid(phone: string): boolean {
  return digitsOf(phone).length >= PHONE_DIGITS;
}

export function isCodeValid(code: string): boolean {
  return digitsOf(code).length === CODE_DIGITS;
}

/**
 * Seconds still to wait before a resend is allowed. `lastSentAt === null`
 * means nothing has been sent yet, so there is nothing to wait for.
 * Clamped at 0 and tolerant of clock skew (a future `lastSentAt` never
 * produces a cooldown longer than the full window).
 */
export function resendSecondsLeft(lastSentAt: number | null, now: number): number {
  if (lastSentAt === null) return 0;
  const elapsed = Math.floor((now - lastSentAt) / 1000);
  if (elapsed < 0) return RESEND_COOLDOWN_SEC;
  return Math.max(0, RESEND_COOLDOWN_SEC - elapsed);
}

export function canResend(lastSentAt: number | null, now: number): boolean {
  return resendSecondsLeft(lastSentAt, now) === 0;
}

/**
 * The message shown when a primary action cannot proceed. Returning a STRING
 * rather than `void` is the whole point: every caller is forced to render
 * something, so "click did nothing" stops being representable.
 */
export const OTP_MESSAGES = {
  captchaUnavailable:
    "Couldn't start the security check. Reload the page and try again.",
  sessionExpired:
    "That code request expired. Tap Resend to get a fresh code.",
  invalidPhone: "Enter a 10-digit mobile number.",
  invalidCode: `Enter the ${CODE_DIGITS}-digit code from the SMS.`,
  // A 5xx from verify-otp is our outage, not the customer's mistake — the
  // raw server body ("internal error") reached the screen verbatim in the
  // 2026-08-11 incident and reads as a dead end with no next step.
  serverError:
    "Something went wrong on our side — your code was correct, so please tap Verify again in a moment.",
} as const;
