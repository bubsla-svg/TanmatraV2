/**
 * F-1 regression: a customer phone number or email must never reach log
 * output in plaintext.
 *
 * Two layers are under test and both matter:
 *
 *   1. `piiMask` itself — the masks are pure, and IDEMPOTENT, which is the
 *      property that lets the logger's censor run over a value a call site
 *      already masked without degrading it to "***".
 *   2. The logger's redaction backstop — a raw value logged by a call site
 *      that forgot to mask still comes out masked.
 *
 * Layer 2 is deliberately exercised through a real pino instance built the
 * same way `logger.ts` builds the app's, rather than by asserting on the
 * config object. The censor's contract (what pino passes as `path`, whether
 * it fires for top-level keys) is pino's behaviour, not ours — asserting the
 * config would test our belief about pino instead of pino.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { Writable } from "node:stream";
import pino from "pino";
import { maskE164, maskEmail, censorPii } from "./piiMask";

const RAW_E164 = "+919876543210";
const RAW_EMAIL = "customer@gmail.com";

/** A pino instance configured exactly as `logger.ts` configures the app's,
 *  writing to memory so the emitted record can be inspected. */
function captureLogger(): { log: pino.Logger; records: () => string } {
  let out = "";
  const sink = new Writable({
    write(chunk, _enc, cb) {
      out += String(chunk);
      cb();
    },
  });
  const log = pino(
    {
      level: "info",
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "res.headers['set-cookie']",
          "e164",
          "*.e164",
          "phone",
          "*.phone",
          "phoneE164",
          "*.phoneE164",
          "email",
          "*.email",
        ],
        censor: censorPii,
      },
    },
    sink,
  );
  return { log, records: () => out };
}

// ── Layer 1: the masks ──────────────────────────────────────────────────────

test("maskE164 hides the middle of the number", () => {
  // NOTE the actual output: "+9198******10", not "+91********10". The
  // `\d{1,4}` country-code group is GREEDY, so for a +91 number it swallows
  // two digits of the subscriber number as well — the function shows 4 of the
  // 10 subscriber digits, not the "country code and last 2" its docblock
  // claims. That behaviour is PRE-EXISTING and is asserted here as-is rather
  // than quietly changed: narrowing it alters every masked line already in
  // log storage and is a decision about what ops needs, not part of closing
  // F-1. Recorded as its own finding.
  assert.equal(maskE164(RAW_E164), "+9198******10");
  assert.ok(!maskE164(RAW_E164).includes("76543"));
});

test("maskE164 is idempotent — masking a masked number does not degrade it", () => {
  const once = maskE164(RAW_E164);
  assert.equal(maskE164(once), once);
});

test("maskE164 returns *** for anything that is not an E.164 number", () => {
  // orderNotification logs the RAW user-supplied phone on the normalisation
  // failure branch, so the mask must fail closed on junk rather than pass it.
  assert.equal(maskE164("98765 43210"), "***");
  assert.equal(maskE164(""), "***");
  assert.equal(maskE164("not a phone"), "***");
});

test("maskEmail keeps the first character and the domain", () => {
  assert.equal(maskEmail(RAW_EMAIL), "c*******@gmail.com");
  assert.ok(!maskEmail(RAW_EMAIL).includes("customer"));
});

test("maskEmail is idempotent, and fails closed on a non-address", () => {
  const once = maskEmail(RAW_EMAIL);
  assert.equal(maskEmail(once), once);
  assert.equal(maskEmail("no-at-sign"), "***");
  assert.equal(maskEmail("@nolocal.com"), "***");
  assert.equal(maskEmail("nodomain@"), "***");
});

test("censorPii fully redacts credentials rather than masking them", () => {
  // The censor is applied to the authorization/cookie paths too. A bearer
  // token must not be partially preserved.
  assert.equal(censorPii("Bearer sk-abc123", ["req", "headers", "authorization"]), "[Redacted]");
  assert.equal(censorPii({ nested: true }, ["phone"]), "[Redacted]");
});

// ── Layer 2: the logger backstop ────────────────────────────────────────────

test("a raw e164 logged top-level never reaches the output", () => {
  const { log, records } = captureLogger();
  log.info({ e164: RAW_E164 }, "unmasked.call.site");
  const out = records();
  assert.ok(!out.includes(RAW_E164), `raw number leaked: ${out}`);
  assert.ok(out.includes("+9198******10"), `expected masked form, got: ${out}`);
});

test("a raw email logged top-level never reaches the output", () => {
  const { log, records } = captureLogger();
  log.info({ email: RAW_EMAIL }, "unmasked.call.site");
  const out = records();
  assert.ok(!out.includes(RAW_EMAIL), `raw email leaked: ${out}`);
  assert.ok(out.includes("@gmail.com"), `expected masked form, got: ${out}`);
});

test("phone and phoneE164 are covered, nested one level as well as top-level", () => {
  const { log, records } = captureLogger();
  log.info({ phone: RAW_E164 }, "a");
  log.info({ phoneE164: RAW_E164 }, "b");
  log.info({ user: { phone: RAW_E164 } }, "c");
  log.info({ user: { email: RAW_EMAIL } }, "d");
  const out = records();
  assert.ok(!out.includes(RAW_E164), `raw number leaked: ${out}`);
  assert.ok(!out.includes(RAW_EMAIL), `raw email leaked: ${out}`);
});

test("an already-masked call site survives the censor unchanged", () => {
  // The regression this guards: a naive censor replaces the value with
  // "[Redacted]" (or re-masks it to "***"), silently destroying the
  // country-code + last-two-digits that ops uses to tell two concurrent OTP
  // attempts apart — turning a security fix into an observability outage.
  const { log, records } = captureLogger();
  log.info({ e164: maskE164(RAW_E164) }, "masked.call.site");
  const out = records();
  assert.ok(out.includes("+9198******10"), `masked value was destroyed: ${out}`);
  assert.ok(!out.includes("[Redacted]"), `masked value was blanked: ${out}`);
});

test("the pre-existing credential redactions still behave as before", () => {
  const { log, records } = captureLogger();
  log.info({ req: { headers: { authorization: "Bearer sk-abc123", cookie: "sid=xyz" } } }, "req");
  const out = records();
  assert.ok(!out.includes("sk-abc123"), `token leaked: ${out}`);
  assert.ok(!out.includes("sid=xyz"), `cookie leaked: ${out}`);
  assert.ok(out.includes("[Redacted]"), `expected [Redacted], got: ${out}`);
});
