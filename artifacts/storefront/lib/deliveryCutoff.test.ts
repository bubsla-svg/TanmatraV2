/**
 * The cutoff, as the account surface must show it (plan item 2.2, Law 9).
 *
 * Today `DeliveryList` renders Skip on every upcoming row and lets the server
 * refuse it. `ManageDeliverySheet` pre-checks but offers a date picker whose
 * `min` is today — dates the app's own rule has already closed. Both are the
 * same defect: an affordance the system will not honour.
 *
 * Run: node --test --import tsx ./lib/deliveryCutoff.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import { SKIP_SWAP_CUTOFF_MS } from "@workspace/subscription-rules";
import { SKIP_SWAP_CUTOFF_HOURS } from "./planDecisionFacts";
import {
  earliestReschedulableDateISO,
  formatDeliveryDate,
  isChangeable,
  lockedReason,
  nextChangeNote,
  nextChangeableDelivery,
} from "./deliveryCutoff";

const NOW = Date.parse("2026-08-17T09:00:00Z"); // a Monday
const at = (ms: number) => new Date(NOW + ms).toISOString();
const upcoming = (ms: number) => ({ scheduledFor: at(ms), status: "upcoming" });

test("the boundary is 'at least the cutoff away', not 'more than'", () => {
  // The shared rule is `t - now < MS`, so exactly MS away is still changeable.
  // Copy that said "more than 24 hours" would be wrong by one minute at the
  // one moment a customer is most likely to be looking.
  assert.equal(isChangeable(upcoming(SKIP_SWAP_CUTOFF_MS), NOW), true);
  assert.equal(isChangeable(upcoming(SKIP_SWAP_CUTOFF_MS + 60_000), NOW), true);
  assert.equal(isChangeable(upcoming(SKIP_SWAP_CUTOFF_MS - 60_000), NOW), false);
});

test("a delivery already in the past is not changeable", () => {
  assert.equal(isChangeable(upcoming(-60 * 60 * 1000), NOW), false);
});

test("an unparseable date is NOT treated as changeable", () => {
  // isPastSkipCutoff returns false for NaN — correct for a server gate, which
  // must not refuse a real request over a bad string. Inherited by a UI
  // affordance it renders an enabled Skip the server will then refuse, which
  // is the dead end this item exists to remove.
  assert.equal(isChangeable({ scheduledFor: "not-a-date", status: "upcoming" }, NOW), false);
  assert.equal(isChangeable({ scheduledFor: "", status: "upcoming" }, NOW), false);
});

test("only an upcoming delivery is changeable", () => {
  for (const status of ["skipped", "delivered", "cancelled", "preparing"]) {
    assert.equal(isChangeable({ scheduledFor: at(SKIP_SWAP_CUTOFF_MS * 3), status }, NOW), false, status);
  }
});

test("the next changeable delivery is the soonest one, not the first in the array", () => {
  const far = upcoming(SKIP_SWAP_CUTOFF_MS * 5);
  const near = upcoming(SKIP_SWAP_CUTOFF_MS * 2);
  const locked = upcoming(SKIP_SWAP_CUTOFF_MS / 2);
  const next = nextChangeableDelivery([far, locked, near], NOW);
  assert.equal(next?.scheduledFor, near.scheduledFor);
});

test("nothing changeable yields null, never an invented date", () => {
  assert.equal(nextChangeableDelivery([], NOW), null);
  assert.equal(nextChangeableDelivery([upcoming(SKIP_SWAP_CUTOFF_MS / 2)], NOW), null);
  // A paused subscription has no upcoming rows at all.
  assert.equal(
    nextChangeableDelivery([{ scheduledFor: at(SKIP_SWAP_CUTOFF_MS * 4), status: "paused" }], NOW),
    null,
  );
  assert.equal(nextChangeNote([], NOW), null);
});

test("the next-change note names a real, still-open delivery", () => {
  const note = nextChangeNote([upcoming(SKIP_SWAP_CUTOFF_MS / 2), upcoming(SKIP_SWAP_CUTOFF_MS * 3)], NOW);
  assert.ok(note);
  assert.match(note, /next delivery you can still change/i);
  assert.match(note, /\d/, "a next-step with no date is not a next step");
});

test("the locked reason derives the number instead of restating it", () => {
  // DeliveryList currently hardcodes "24h" twice. Change the constant and that
  // copy lies with every test still green.
  assert.match(lockedReason(), new RegExp(`${SKIP_SWAP_CUTOFF_HOURS} hours`));
});

test("a reschedule can never be offered a date inside the window", () => {
  for (const hour of [0, 5, 12, 18, 23]) {
    const now = Date.parse(`2026-08-17T${String(hour).padStart(2, "0")}:30:00Z`);
    const iso = earliestReschedulableDateISO(now);
    const chosen = Date.parse(`${iso}T00:00:00Z`);
    assert.ok(
      chosen - now >= SKIP_SWAP_CUTOFF_MS,
      `${iso} from ${new Date(now).toISOString()} is inside the cutoff`,
    );
  }
});

test("a reschedule is never offered a weekend", () => {
  // nextWeekdayISO never schedules one, so offering Saturday would be a second
  // way to pick a date the system will refuse.
  for (let day = 0; day < 14; day += 1) {
    const now = Date.parse("2026-08-17T09:00:00Z") + day * 86_400_000;
    const iso = earliestReschedulableDateISO(now);
    const dow = new Date(`${iso}T00:00:00Z`).getUTCDay();
    assert.ok(dow >= 1 && dow <= 5, `${iso} is a weekend`);
  }
});

test("a date renders for a person, and a bad one renders as nothing", () => {
  assert.match(formatDeliveryDate(at(SKIP_SWAP_CUTOFF_MS * 3)), /\w/);
  assert.equal(formatDeliveryDate("not-a-date"), "");
});

// ── Wiring ────────────────────────────────────────────────────────────────────
// The predicate above is only worth anything if the surfaces actually consult
// it. These assert the three defects the item names are closed.

test("the delivery list checks the cutoff before offering Skip", () => {
  // It used to offer Skip on every upcoming row and let the server refuse:
  // the sheet pre-checked, the list did not.
  const src = fs.readFileSync(new URL("../components/account/DeliveryList.tsx", import.meta.url), "utf8");
  assert.match(src, /!isChangeable\(d\)/);
  assert.match(src, /disabled=\{busyIds\.has\(d\.id\) \|\| locked\}/);
  assert.match(src, /lockedReason\(\)/, "a disabled control must say why");
});

test("no customer-facing copy restates the cutoff as a literal", () => {
  // Two lines hardcoded "24h". Change the shared constant and they lie with
  // every test green.
  const src = fs.readFileSync(new URL("../components/account/DeliveryList.tsx", import.meta.url), "utf8");
  const visible = src.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"));
  assert.ok(
    !visible.some((l) => /\b24h\b/.test(l)),
    "import SKIP_SWAP_CUTOFF_HOURS instead of typing the number",
  );
  assert.match(src, /SKIP_SWAP_CUTOFF_HOURS/);
});

test("a refusal is followed by what can still be done", () => {
  // Law 9. The server writes an action-specific sentence, so the next step is
  // APPENDED rather than replacing it.
  const src = fs.readFileSync(new URL("../components/account/DeliveryList.tsx", import.meta.url), "utf8");
  assert.match(src, /nextChangeNote\(detail\?\.deliveries \?\? \[\]\)/);
  assert.match(src, /next \? `\$\{said\} \$\{next\}` : said/);
});

test("the reschedule picker cannot offer a closed date", () => {
  const src = fs.readFileSync(new URL("../components/account/ManageDeliverySheet.tsx", import.meta.url), "utf8");
  assert.match(src, /min=\{earliestReschedulableDateISO\(\)\}/);
  assert.doesNotMatch(src, /min=\{new Date\(\)\.toISOString\(\)/);
});

test("a skip refreshes the card that shows the next delivery", () => {
  // Invalidating only the list left the card's "Next delivery" and the credits
  // chip stale on screen beside the row that had just moved.
  const src = fs.readFileSync(new URL("../components/account/DeliveryList.tsx", import.meta.url), "utf8");
  assert.match(src, /queryKey: \["account", "subscription"\]/);
});

test("every retention action reports only once the server accepted it", () => {
  const mgr = fs.readFileSync(new URL("../components/account/SubscriptionManager.tsx", import.meta.url), "utf8");
  // After the await, not on the tap — otherwise refusals inflate the numbers.
  const await_ix = mgr.indexOf("await actionMutation.mutateAsync");
  const emit_ix = mgr.indexOf("emitFunnel(event");
  assert.ok(await_ix > 0 && emit_ix > await_ix, "emit must follow the accepted mutation");
  // reactivate-billing is deliberately unmapped — a payment-rail recovery is
  // not a customer lifecycle decision.
  assert.match(mgr, /Partial<Record<SubAction, FunnelEvent>>/);
  assert.ok(!/"reactivate-billing":\s*"subscription_/.test(mgr));
});
