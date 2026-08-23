/**
 * PII masking for log output.
 *
 * WHY THIS IS ITS OWN MODULE, and not a couple of helpers in `sms.ts`:
 * `sms.ts` imports `./logger` on its first line. `logger.ts` needs these
 * functions for its redaction censor, so importing them from `sms.ts` would
 * close an import cycle (logger → sms → logger). This module imports nothing,
 * so both sides can depend on it.
 *
 * Every function here is pure and idempotent: masking an already-masked value
 * returns it unchanged. That property is what lets the logger's censor run
 * over a field that a call site already masked without degrading it to "***".
 */

/** A value that has already been through one of the masks below. */
function alreadyMasked(value: string): boolean {
  return value.includes("*");
}

/**
 * Mask an E.164 number for log output. Keeps the country code and the last 2
 * digits visible — enough for ops staff to disambiguate two concurrent OTP
 * attempts on the same line — and hides the rest.
 */
export function maskE164(e164: string): string {
  if (alreadyMasked(e164)) return e164;
  const m = /^(\+\d{1,4})(\d+)$/.exec(e164);
  if (!m) return "***";
  const cc = m[1] ?? "";
  const rest = m[2] ?? "";
  if (rest.length <= 2) return `${cc}**`;
  const tail = rest.slice(-2);
  return `${cc}${"*".repeat(rest.length - 2)}${tail}`;
}

/**
 * Mask an email for log output. Keeps the first character of the local part
 * and the whole domain: enough to tell "the customer's gmail" from "the ops
 * alias" while the address itself stays out of the log.
 */
export function maskEmail(email: string): string {
  if (alreadyMasked(email)) return email;
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const head = local[0] ?? "";
  return `${head}${"*".repeat(Math.max(local.length - 1, 1))}@${domain}`;
}

/**
 * The logger's redaction censor (see `logger.ts`). Masks rather than replacing
 * with "[Redacted]" so a raw value that slips through still leaves a
 * correlatable trace, and a value the call site already masked survives
 * untouched. Non-strings are replaced outright — a phone field holding an
 * object is not something to try to partially preserve.
 */
export function censorPii(value: unknown, path: readonly string[]): unknown {
  if (typeof value !== "string") return "[Redacted]";
  const key = (path[path.length - 1] ?? "").toLowerCase();
  if (key.includes("email")) return maskEmail(value);
  if (key === "e164" || key.includes("phone")) return maskE164(value);
  // Credentials (the authorization / cookie / set-cookie paths this censor is
  // also applied to) get no partial preservation — masking a bearer token is
  // not a thing worth doing carefully.
  return "[Redacted]";
}
