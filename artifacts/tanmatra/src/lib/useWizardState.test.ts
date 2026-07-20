// Unit tests for the pure wizard-state helpers (playbook R1 contract).
//
// tanmatra has no wired `test` script (this mirrors sessionReplay.test.ts,
// the existing node:test convention in this package). Run with the
// api-server's tsx loader, which resolves this package's deps fine:
//
//   cd artifacts/api-server && \
//   node --test --import tsx ../tanmatra/src/lib/useWizardState.test.ts
import { describe, it } from "node:test";
import assert from "node:assert";
import {
  wizardDraftKey,
  parseWizardStep,
  boundWizardStep,
  decodeWizardDraftRecord,
  serializeWizardDraft,
} from "./useWizardState";

describe("wizardDraftKey", () => {
  it("builds the versioned tanmatra:<flow>-draft:v1 key", () => {
    assert.strictEqual(wizardDraftKey("subscribe"), "tanmatra:subscribe-draft:v1");
    assert.strictEqual(wizardDraftKey("checkout"), "tanmatra:checkout-draft:v1");
  });

  it("stays byte-compatible with the pre-extraction Subscribe key", () => {
    // Drafts written by the old inline Subscribe implementation must keep
    // rehydrating after the refactor — the key may never drift silently.
    assert.strictEqual(wizardDraftKey("subscribe"), "tanmatra:subscribe-draft:v1");
  });
});

describe("parseWizardStep (untrusted URL/draft input)", () => {
  it("keeps a valid integer step within [0, totalSteps - 1]", () => {
    assert.strictEqual(parseWizardStep(0, 8), 0);
    assert.strictEqual(parseWizardStep(7, 8), 7);
    assert.strictEqual(parseWizardStep(3, 8), 3);
  });

  it("parses the numeric strings a ?step= URL param delivers", () => {
    assert.strictEqual(parseWizardStep("5", 8), 5);
    assert.strictEqual(parseWizardStep("0", 8), 0);
  });

  it("falls back to 0 (flow start) for out-of-range values instead of clamping", () => {
    // A hand-edited ?step=99 must NOT jump to the final payment/success step.
    assert.strictEqual(parseWizardStep(99, 8), 0);
    assert.strictEqual(parseWizardStep("99", 8), 0);
    assert.strictEqual(parseWizardStep(8, 8), 0); // one past the end
    assert.strictEqual(parseWizardStep(-1, 8), 0);
    assert.strictEqual(parseWizardStep("-1", 8), 0);
  });

  it("falls back to 0 for non-integer and garbage input", () => {
    assert.strictEqual(parseWizardStep("3.5", 8), 0);
    assert.strictEqual(parseWizardStep(3.5, 8), 0);
    assert.strictEqual(parseWizardStep("abc", 8), 0);
    assert.strictEqual(parseWizardStep(null, 8), 0);
    assert.strictEqual(parseWizardStep(undefined, 8), 0);
    assert.strictEqual(parseWizardStep({}, 8), 0);
    assert.strictEqual(parseWizardStep(true, 8), 0);
    assert.strictEqual(parseWizardStep(Number.NaN, 8), 0);
  });

  it("treats an empty-string param as step 0 (original popstate semantics)", () => {
    // Number("") === 0 — the pre-extraction Subscribe listener resolved a
    // bare `?step=` to 0; keep that exact behavior.
    assert.strictEqual(parseWizardStep("", 8), 0);
  });
});

describe("boundWizardStep (programmatic goToStep)", () => {
  it("passes through in-range steps", () => {
    assert.strictEqual(boundWizardStep(0, 8), 0);
    assert.strictEqual(boundWizardStep(4, 8), 4);
    assert.strictEqual(boundWizardStep(7, 8), 7);
  });

  it("clamps overshoot and undershoot into range", () => {
    assert.strictEqual(boundWizardStep(99, 8), 7);
    assert.strictEqual(boundWizardStep(8, 8), 7);
    assert.strictEqual(boundWizardStep(-1, 8), 0);
    assert.strictEqual(boundWizardStep(-1, 3), 0);
    assert.strictEqual(boundWizardStep(5, 3), 2);
  });

  it("truncates fractions and normalizes non-finite input to 0", () => {
    assert.strictEqual(boundWizardStep(2.9, 8), 2);
    assert.strictEqual(boundWizardStep(Number.NaN, 8), 0);
    assert.strictEqual(boundWizardStep(Number.POSITIVE_INFINITY, 8), 0);
  });
});

describe("serializeWizardDraft / decodeWizardDraftRecord", () => {
  it("round-trips draft fields with the step in one flat object", () => {
    // Arrange
    const draft = { cadence: "weekly", startDate: "2026-07-22" };

    // Act
    const raw = serializeWizardDraft(draft, 3);
    const decoded = decodeWizardDraftRecord(raw);

    // Assert
    assert.ok(decoded);
    assert.strictEqual(decoded.step, 3);
    assert.strictEqual(decoded.cadence, "weekly");
    assert.strictEqual(decoded.startDate, "2026-07-22");
  });

  it("keeps the flat { ...fields, step } payload shape Subscribe v1 wrote", () => {
    // The step must sit at the TOP level next to the draft fields — not
    // nested — or every in-flight draft from the pre-extraction code breaks.
    const parsed = JSON.parse(serializeWizardDraft({ daysMode: "weekdays" }, 2)) as Record<
      string,
      unknown
    >;
    assert.deepStrictEqual(parsed, { daysMode: "weekdays", step: 2 });
  });

  it("lets the step argument win over a stray draft field named step", () => {
    const decoded = decodeWizardDraftRecord(
      serializeWizardDraft({ step: 99, other: 1 }, 4),
    );
    assert.ok(decoded);
    assert.strictEqual(decoded.step, 4);
  });

  it("returns null for missing or blank input", () => {
    assert.strictEqual(decodeWizardDraftRecord(null), null);
    assert.strictEqual(decodeWizardDraftRecord(undefined), null);
    assert.strictEqual(decodeWizardDraftRecord(""), null);
  });

  it("returns null for invalid JSON instead of throwing", () => {
    assert.strictEqual(decodeWizardDraftRecord("{not json"), null);
    assert.strictEqual(decodeWizardDraftRecord("undefined"), null);
  });

  it("returns null for valid JSON that is not a plain object", () => {
    assert.strictEqual(decodeWizardDraftRecord('"a string"'), null);
    assert.strictEqual(decodeWizardDraftRecord("42"), null);
    assert.strictEqual(decodeWizardDraftRecord("null"), null);
    assert.strictEqual(decodeWizardDraftRecord("[1,2]"), null);
  });

  it("rehydrates the exact payload the pre-extraction Subscribe code wrote", () => {
    // A frozen sample of the legacy serializer's output. New code must read
    // old drafts (same tab session across a deploy).
    const legacy = JSON.stringify({
      step: 5,
      slots: { breakfast: false, lunch: true, dinner: true },
      daysMode: "everyday",
      cadence: "fortnightly",
      selectedBillingCadence: "fortnightly",
      startDate: "2026-07-22",
      address: {
        label: "Home",
        line: "Sector 62",
        city: "Noida",
        pincode: "201301",
        phone: "+91 92892 13115",
      },
    });

    const decoded = decodeWizardDraftRecord(legacy);
    assert.ok(decoded);
    assert.strictEqual(parseWizardStep(decoded.step, 8), 5);
    assert.deepStrictEqual(decoded.slots, {
      breakfast: false,
      lunch: true,
      dinner: true,
    });
    assert.strictEqual(decoded.cadence, "fortnightly");
  });
});
