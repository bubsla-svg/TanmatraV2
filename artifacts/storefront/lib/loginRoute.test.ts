import test from "node:test";
import assert from "node:assert/strict";
import {
  parseAuthStep,
  otpStageForAuthStep,
  authStepForOtpStage,
  safeNextPath,
} from "./loginRoute";

test("parseAuthStep accepts only the implemented steps", () => {
  assert.equal(parseAuthStep("phone"), "phone");
  assert.equal(parseAuthStep("otp"), "otp");
});

test("parseAuthStep rejects account-conflict — no backing implementation exists", () => {
  assert.equal(parseAuthStep("account-conflict"), undefined);
});

test("parseAuthStep rejects garbage and absence", () => {
  assert.equal(parseAuthStep("bogus"), undefined);
  assert.equal(parseAuthStep(undefined), undefined);
  assert.equal(parseAuthStep(""), undefined);
});

test("otpStageForAuthStep maps the URL contract onto PhoneAuth's stages", () => {
  assert.equal(otpStageForAuthStep("phone"), "phone");
  assert.equal(otpStageForAuthStep("otp"), "code");
  assert.equal(otpStageForAuthStep(undefined), undefined);
});

test("authStepForOtpStage is the inverse, minus the URL-less collapsed stage", () => {
  assert.equal(authStepForOtpStage("phone"), "phone");
  assert.equal(authStepForOtpStage("code"), "otp");
  assert.equal(authStepForOtpStage("collapsed"), undefined);
});

// ── D-05A/D-10 return-route sanitizer — exhaustive table ────────────────────
// Every non-"/"-prefixed, malformed, protocol-relative, external, or scheme
// value collapses to "/"; only a genuine same-origin absolute path passes.

test("safeNextPath passes through an internal absolute path, query and hash intact", () => {
  assert.equal(safeNextPath("/menu?group=lunch"), "/menu?group=lunch");
  assert.equal(safeNextPath("/account/orders"), "/account/orders");
  assert.equal(safeNextPath("/meal-planner#today"), "/meal-planner#today");
  assert.equal(safeNextPath("/"), "/");
});

test("safeNextPath rejects protocol-relative URLs", () => {
  assert.equal(safeNextPath("//evil.example"), "/");
  assert.equal(safeNextPath("///evil.example"), "/");
  assert.equal(safeNextPath("//evil.example/phish?x=1"), "/");
});

test("safeNextPath rejects absolute external URLs, any scheme", () => {
  assert.equal(safeNextPath("https://evil.example/phish"), "/");
  assert.equal(safeNextPath("http://evil.example"), "/");
  assert.equal(safeNextPath("ftp://evil.example"), "/");
});

test("safeNextPath rejects javascript: and other non-http(s) schemes", () => {
  assert.equal(safeNextPath("javascript:alert(1)"), "/");
  assert.equal(safeNextPath("JavaScript:alert(1)"), "/");
  assert.equal(safeNextPath("data:text/html,<script>alert(1)</script>"), "/");
  assert.equal(safeNextPath("vbscript:msgbox(1)"), "/");
});

test("safeNextPath rejects the backslash-normalization bypass (browsers treat \\ as / for special schemes)", () => {
  assert.equal(safeNextPath("/\\evil.example"), "/");
  assert.equal(safeNextPath("\\\\evil.example"), "/");
  assert.equal(safeNextPath("/\\/evil.example"), "/");
});

test("safeNextPath rejects encoded variants — the raw string must itself start with \"/\"", () => {
  assert.equal(safeNextPath("%2F%2Fevil.example"), "/");
  assert.equal(safeNextPath("%2Fevil.example"), "/");
  assert.equal(safeNextPath("/%2F%2Fevil.example"), "/%2F%2Fevil.example"); // literal path segment, same-origin
});

test("safeNextPath rejects a bare relative path (contract is absolute-path-only)", () => {
  assert.equal(safeNextPath("menu"), "/");
  assert.equal(safeNextPath("../admin"), "/");
});

test("safeNextPath rejects malformed values without throwing", () => {
  assert.doesNotThrow(() => safeNextPath("/%"));
  assert.equal(safeNextPath("/%"), "/%"); // a literal same-origin path segment, not actually malformed to the URL parser
  assert.doesNotThrow(() => safeNextPath("http://"));
  assert.equal(safeNextPath("http://"), "/");
});

test("safeNextPath falls back to / when absent or empty", () => {
  assert.equal(safeNextPath(undefined), "/");
  assert.equal(safeNextPath(""), "/");
});
