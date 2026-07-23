/**
 * Pure phone-number helpers for the onboarding flow. No React Native imports,
 * so this is unit-testable under `node --test`.
 *
 * The server's send-otp contract (api-zod `PhoneSendOtpBody`) takes a separate
 * `countryCode` + `phone`, and normalises them the same way `normalisePhone`
 * does server-side. We mirror that split here: the UI collects a national
 * number, we default the country to India (+91), and we keep the E.164 form for
 * display/analytics only.
 */

export const DEFAULT_COUNTRY_CODE = "+91";

export interface ParsedPhone {
  /** Dialing code, e.g. "+91". */
  countryCode: string;
  /** National digits only, e.g. "9876543210". */
  phone: string;
  /** Combined E.164, e.g. "+919876543210". */
  e164: string;
}

/**
 * Parse a user-entered national number for the given country code. Returns null
 * if it isn't a plausible mobile number. Mirrors the server's `normalisePhone`
 * bounds (national part 6–15 digits) and, for +91, enforces a 10-digit mobile
 * starting 6–9 so the UI can validate before hitting the network.
 */
export function parsePhone(
  rawNational: string,
  countryCodeRaw: string = DEFAULT_COUNTRY_CODE,
): ParsedPhone | null {
  const cc = countryCodeRaw.replace(/[^0-9+]/g, "").replace(/^\+?/, "+");
  const phone = rawNational.replace(/[^0-9]/g, "");
  if (!/^\+\d{1,4}$/.test(cc)) return null;
  if (phone.length < 6 || phone.length > 15) return null;
  // India is the launch market: a mobile number is exactly 10 digits and
  // starts 6–9. Guard it specifically so the UI catches typos early.
  if (cc === DEFAULT_COUNTRY_CODE && !/^[6-9]\d{9}$/.test(phone)) return null;
  return { countryCode: cc, phone, e164: `${cc}${phone}` };
}

/** OTP codes are 6 digits (matches the SMS templates + mock code "123456"). */
export const OTP_LENGTH = 6;

export function isCompleteOtp(code: string): boolean {
  return new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code.trim());
}

/**
 * Mask a parsed phone for display: keep the country code and the last 2 digits.
 * Takes the parsed parts (not a raw E.164) because the country-code boundary in
 * a combined E.164 string is ambiguous.
 */
export function maskPhone(
  p: Pick<ParsedPhone, "countryCode" | "phone">,
): string {
  const rest = p.phone;
  if (rest.length <= 2) return `${p.countryCode} ${rest}`;
  return `${p.countryCode} ${"•".repeat(rest.length - 2)}${rest.slice(-2)}`;
}
