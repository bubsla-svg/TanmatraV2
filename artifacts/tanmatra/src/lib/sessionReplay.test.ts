import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import {
  recordSessionEvent,
  getSessionReplayBuffer,
  clearSessionReplayBufferForTesting,
  trackClickForRageDetection,
  reportLinkedError,
} from "./sessionReplay";

describe("Session Replay, Error Linking & Rage-Click Detector Engine", () => {
  beforeEach(() => {
    clearSessionReplayBufferForTesting();
  });

  it("Step 1 (Session Replay): captures user clicks, scrolls, and interactions into rolling buffer", () => {
    recordSessionEvent({ type: "click", targetSelector: "button#subscribe-cta" });
    recordSessionEvent({ type: "scroll", path: "/subscribe" });

    const buffer = getSessionReplayBuffer();
    assert.strictEqual(buffer.length, 2);
    assert.strictEqual(buffer[0].type, "click");
    assert.strictEqual(buffer[0].targetSelector, "button#subscribe-cta");
    assert.strictEqual(buffer[1].type, "scroll");
  });

  it("Step 2 (Error Linking): links session replay trajectory directly to exception error payloads", async () => {
    // Simulate user trajectory leading up to error
    recordSessionEvent({ type: "click", targetSelector: "button#checkout" });
    recordSessionEvent({ type: "input", targetSelector: "input#card-number" });

    const error = new TypeError("Cannot read properties of undefined (reading 'paymentId')");
    const payload = await reportLinkedError(error);

    assert.strictEqual(payload.errorName, "TypeError");
    assert.ok(payload.errorMessage.includes("Cannot read properties"));
    assert.ok(payload.sessionReplayTrace.length >= 3); // Clicks + Error event

    const lastEvent = payload.sessionReplayTrace[payload.sessionReplayTrace.length - 1];
    assert.strictEqual(lastEvent.type, "error");
    assert.ok(lastEvent.errorStack?.includes("TypeError"));
  });

  it("Step 3 (Rage Clicks): detects >= 5 rapid clicks within 3s and flags UX failure alert", () => {
    const btnSelector = "button#submit-order-disabled";

    // First 4 rapid clicks -> normal click events
    for (let i = 0; i < 4; i++) {
      const res = trackClickForRageDetection(btnSelector, "Pay Now");
      assert.strictEqual(res.isRageClick, false);
    }

    // 5th rapid click within 3s -> triggers Rage Click UX Failure Alert!
    const rageRes = trackClickForRageDetection(btnSelector, "Pay Now");
    assert.strictEqual(rageRes.isRageClick, true);
    assert.ok(rageRes.event);
    assert.strictEqual(rageRes.event.type, "rage_click");
    assert.ok(rageRes.event.targetText?.includes("Rage click detected"));

    // Verify replay buffer now contains the rage_click event
    const buffer = getSessionReplayBuffer();
    const rageBufferEvent = buffer.find((e) => e.type === "rage_click");
    assert.ok(rageBufferEvent);
  });
});
