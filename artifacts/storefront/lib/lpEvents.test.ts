import assert from "node:assert/strict";
import { test } from "node:test";
import { emitLpEvent, type LpEventName } from "./lpEvents";

test("emitLpEvent runs safely in server/node environments without throwing (L-1)", () => {
  const event: LpEventName = "lp_view";
  // In node environment, window is undefined, emitLpEvent should safely no-op
  assert.doesNotThrow(() => {
    emitLpEvent(event, { page: "/partners/gyms", ref: "test_ref" });
  });
});

test("emitLpEvent handles all valid LP event names", () => {
  const events: LpEventName[] = [
    "lp_view",
    "hero_cta_click",
    "sticky_cta_click",
    "plan_card_select",
    "menu_preview_interact",
    "calc_interact",
    "faq_open",
    "lead_submit",
    "lead_success",
    "lead_error",
    "trial_checkout_start",
  ];
  assert.equal(events.length, 11);
  for (const ev of events) {
    assert.doesNotThrow(() => emitLpEvent(ev));
  }
});
