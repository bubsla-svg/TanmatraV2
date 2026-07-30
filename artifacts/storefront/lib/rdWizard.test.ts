import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "./apiClient";
import {
  emptyRdDraft,
  rdStepErrors,
  canLeaveRdStep,
  isRdDraftComplete,
  toRdApplicationInput,
  rdSubmitProblem,
  type RdDraft,
} from "./rdWizard";

/** A draft that passes every step, so each test can break exactly one thing. */
function validDraft(): RdDraft {
  return {
    ...emptyRdDraft(),
    fullName: "Dt. Anjali Nair",
    email: "anjali@clinic.example",
    credentials: "RD, MSc Clinical Nutrition",
    yearsExperience: "12",
    cityRegion: "Noida, UP",
    practiceSetting: "clinic",
  };
}

test("the empty draft is not submittable", () => {
  assert.equal(isRdDraftComplete(emptyRdDraft()), false);
});

test("a fully filled draft is submittable", () => {
  assert.equal(isRdDraftComplete(validDraft()), true);
});

test("step 0 (path) never blocks — it has a default", () => {
  assert.deepEqual(rdStepErrors(emptyRdDraft(), 0), {});
  assert.equal(canLeaveRdStep(emptyRdDraft(), 0), true);
});

test("profile step requires a name, a valid email and credentials", () => {
  const e = rdStepErrors(emptyRdDraft(), 1);
  assert.ok(e.fullName);
  assert.ok(e.email);
  assert.ok(e.credentials);
});

test("profile step rejects a malformed email", () => {
  const e = rdStepErrors({ ...validDraft(), email: "anjali@clinic" }, 1);
  assert.ok(e.email);
});

test("practice step rejects a non-integer or out-of-range experience", () => {
  assert.ok(rdStepErrors({ ...validDraft(), yearsExperience: "" }, 2).yearsExperience);
  assert.ok(rdStepErrors({ ...validDraft(), yearsExperience: "abc" }, 2).yearsExperience);
  assert.ok(rdStepErrors({ ...validDraft(), yearsExperience: "-2" }, 2).yearsExperience);
  assert.ok(rdStepErrors({ ...validDraft(), yearsExperience: "81" }, 2).yearsExperience);
  assert.ok(rdStepErrors({ ...validDraft(), yearsExperience: "4.5" }, 2).yearsExperience);
});

test("practice step accepts zero years — a new graduate is valid", () => {
  assert.equal(rdStepErrors({ ...validDraft(), yearsExperience: "0" }, 2).yearsExperience, undefined);
});

test("practice step requires a practice setting", () => {
  assert.ok(rdStepErrors({ ...validDraft(), practiceSetting: "" }, 2).practiceSetting);
});

test("multi-selects are capped at the schema's 20 entries", () => {
  const many = Array.from({ length: 21 }, (_, i) => `s${i}`);
  assert.ok(rdStepErrors({ ...validDraft(), specializations: many }, 2).specializations);
  assert.ok(rdStepErrors({ ...validDraft(), languages: many }, 2).languages);
  assert.ok(rdStepErrors({ ...validDraft(), interests: many }, 3).interests);
});

test("bio over 2000 characters is rejected before the server sees it", () => {
  assert.ok(rdStepErrors({ ...validDraft(), bio: "x".repeat(2001) }, 2).bio);
  assert.equal(rdStepErrors({ ...validDraft(), bio: "x".repeat(2000) }, 2).bio, undefined);
});

test("toRdApplicationInput trims and coerces experience to a number", () => {
  const input = toRdApplicationInput({ ...validDraft(), fullName: "  Anjali  " }, "sess-1234");
  assert.equal(input.fullName, "Anjali");
  assert.equal(input.yearsExperience, 12);
  assert.equal(typeof input.yearsExperience, "number");
  assert.equal(input.sessionId, "sess-1234");
});

test("toRdApplicationInput omits blank optionals rather than sending empty strings", () => {
  const input = toRdApplicationInput(validDraft(), "sess-1234");
  assert.equal("registrationBody" in input, false);
  assert.equal("registrationNumber" in input, false);
  assert.equal("bio" in input, false);
  assert.equal("whatsapp" in input, false);
  assert.equal("specializations" in input, false);
});

test("toRdApplicationInput sends the phone but NOT the opt-in when unverified", () => {
  const input = toRdApplicationInput({ ...validDraft(), phone: "9812345678" }, "s");
  assert.deepEqual(input.whatsapp, { countryCode: "+91", phone: "9812345678" });
  assert.equal(input.whatsappOptIn, undefined);
});

test("toRdApplicationInput asserts the opt-in only once the session verified", () => {
  const input = toRdApplicationInput(
    { ...validDraft(), phone: "9812345678", whatsappVerified: true },
    "s",
  );
  assert.equal(input.whatsappOptIn, true);
});

test("a verified flag with no number never claims an opt-in", () => {
  // Guards the state bug: clearing the number must retract the claim.
  const input = toRdApplicationInput({ ...validDraft(), phone: "", whatsappVerified: true }, "s");
  assert.equal(input.whatsappOptIn, undefined);
  assert.equal("whatsapp" in input, false);
});

test("rdSubmitProblem treats 409 as terminal with duplicate-email copy", () => {
  const p = rdSubmitProblem(new ApiError(409, "error", "exists"));
  assert.equal(p.terminal, true);
  assert.match(p.title, /already exists/i);
});

test("rdSubmitProblem treats 429 as terminal and names the daily limit", () => {
  const p = rdSubmitProblem(new ApiError(429, "error", "rate limited"));
  assert.equal(p.terminal, true);
  assert.match(p.detail, /5 per day/);
});

test("rdSubmitProblem keeps 400 retryable and surfaces the server message", () => {
  const p = rdSubmitProblem(new ApiError(400, "error", "yearsExperience must be an integer"));
  assert.equal(p.terminal, false);
  assert.match(p.detail, /yearsExperience/);
});

test("rdSubmitProblem keeps an unknown failure retryable, never a dead end", () => {
  assert.equal(rdSubmitProblem(new Error("socket hang up")).terminal, false);
  assert.equal(rdSubmitProblem(new ApiError(503, "error", "")).terminal, false);
  assert.equal(rdSubmitProblem(undefined).terminal, false);
});
