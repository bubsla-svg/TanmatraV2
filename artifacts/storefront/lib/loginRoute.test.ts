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

test("safeNextPath passes through an internal absolute path", () => {
  assert.equal(safeNextPath("/menu?group=lunch"), "/menu?group=lunch");
});

test("safeNextPath rejects a protocol-relative URL (open-redirect)", () => {
  assert.equal(safeNextPath("//evil.example"), "/account");
});

test("safeNextPath rejects an absolute external URL", () => {
  assert.equal(safeNextPath("https://evil.example/phish"), "/account");
});

test("safeNextPath falls back to /account when absent or empty", () => {
  assert.equal(safeNextPath(undefined), "/account");
  assert.equal(safeNextPath(""), "/account");
});
