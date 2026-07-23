import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";
import { getFirebaseAuth } from "./firebase";

/**
 * Firebase phone-auth wiring for SF-03. Firebase sends the SMS and mints the
 * idToken; the api-server verifies that token at POST /auth/phone/verify-otp and
 * establishes the `sid` session. Browser-only (reCAPTCHA + SMS confirmation) —
 * imported solely by the "use client" PhoneAuth component.
 */

/** A pending SMS verification. confirm(code) resolves the Firebase idToken the
 *  api-server exchanges for a session; clear() tears down the reCAPTCHA widget
 *  so a re-send can render a fresh challenge (grecaptcha throws if two verifiers
 *  render into the same element). */
export interface PhoneVerification {
  confirm(code: string): Promise<string>;
  clear(): void;
}

/** Compose an E.164 number (`+<cc><digits>`) from a country code + local input. */
export function toE164(countryCode: string, phone: string): string {
  const cc = countryCode.replace(/\D/g, "");
  const digits = phone.replace(/\D/g, "");
  return `+${cc}${digits}`;
}

/**
 * Send the SMS OTP through Firebase. Builds an invisible reCAPTCHA in
 * `container`, requests the code for `phoneE164`, and returns a handle whose
 * confirm(code) yields the idToken. Firebase errors propagate (mapped to
 * customer copy by friendlyFirebaseError at the call site); the verifier is
 * cleared on failure so a retry starts from a clean challenge.
 */
export async function sendPhoneOtp(
  phoneE164: string,
  container: HTMLElement,
): Promise<PhoneVerification> {
  const auth = getFirebaseAuth();
  const verifier = new RecaptchaVerifier(auth, container, { size: "invisible" });
  try {
    const confirmation: ConfirmationResult = await signInWithPhoneNumber(
      auth,
      phoneE164,
      verifier,
    );
    return {
      confirm: async (code: string): Promise<string> => {
        const credential = await confirmation.confirm(code);
        return credential.user.getIdToken();
      },
      clear: () => verifier.clear(),
    };
  } catch (err) {
    verifier.clear();
    throw err;
  }
}
