/**
 * WebOTP (T6): on Android Chrome the SMS code can be read straight into the
 * input — one less transcription at the most abandonment-prone step — when
 * the SMS carries the `@domain #code` trailer. The API is Chromium-only and
 * behind `navigator.credentials`, so this is strictly best-effort: every
 * other browser, a user who dismisses the prompt, an abort, or a malformed
 * SMS all resolve to `null` and the manual input stays the path.
 *
 * `@/`-free and navigator-injected so lib/ tests run under node --test.
 */
export interface OtpNavigatorLike {
  credentials?: { get(options: unknown): Promise<unknown> };
}

export function webOtpSupported(nav: OtpNavigatorLike | undefined, win: object | undefined): boolean {
  return Boolean(nav?.credentials && win && "OTPCredential" in win);
}

/** Resolves the SMS code (digits only) or null. Never rejects. */
export async function requestSmsOtp(
  nav: OtpNavigatorLike | undefined,
  win: object | undefined,
  signal: AbortSignal,
): Promise<string | null> {
  if (!webOtpSupported(nav, win)) return null;
  try {
    const cred = (await nav!.credentials!.get({ otp: { transport: ["sms"] }, signal })) as
      | { code?: unknown }
      | null
      | undefined;
    const code = typeof cred?.code === "string" ? cred.code.replace(/\D/g, "") : "";
    return code.length > 0 ? code : null;
  } catch {
    return null;
  }
}
