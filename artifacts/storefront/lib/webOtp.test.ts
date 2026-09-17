import { test } from "node:test";
import assert from "node:assert/strict";
import { requestSmsOtp, webOtpSupported } from "./webOtp";

const supportedWin = { OTPCredential: class {} };

test("unsupported browsers resolve null without touching credentials", async () => {
  let called = 0;
  const nav = { credentials: { get: async () => { called += 1; return { code: "123456" }; } } };
  assert.equal(webOtpSupported(nav, {}), false);
  assert.equal(await requestSmsOtp(nav, {}, new AbortController().signal), null);
  assert.equal(await requestSmsOtp(undefined, supportedWin, new AbortController().signal), null);
  assert.equal(called, 0);
});

test("a supported browser hands back the SMS code, digits only", async () => {
  let opts: unknown;
  const nav = { credentials: { get: async (o: unknown) => { opts = o; return { code: "12 34 56" }; } } };
  assert.equal(webOtpSupported(nav, supportedWin), true);
  const ctrl = new AbortController();
  assert.equal(await requestSmsOtp(nav, supportedWin, ctrl.signal), "123456");
  assert.deepEqual((opts as { otp: unknown }).otp, { transport: ["sms"] });
  assert.equal((opts as { signal: unknown }).signal, ctrl.signal);
});

test("a dismissed prompt, an abort, or an empty credential all resolve null", async () => {
  const rejecting = { credentials: { get: async () => { throw new DOMException("aborted", "AbortError"); } } };
  assert.equal(await requestSmsOtp(rejecting, supportedWin, new AbortController().signal), null);
  const empty = { credentials: { get: async () => null } };
  assert.equal(await requestSmsOtp(empty, supportedWin, new AbortController().signal), null);
  const blank = { credentials: { get: async () => ({ code: "" }) } };
  assert.equal(await requestSmsOtp(blank, supportedWin, new AbortController().signal), null);
});
