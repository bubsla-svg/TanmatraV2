/**
 * Kitchen board — the pure logic. No network, no timers: every function takes
 * the clock as an argument, so these are ordinary assertions.
 *
 * Run: node --test --import tsx ../storefront/lib/kds.test.ts  (from api-server)
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  CUSTOMER_PROMISE_MINUTES,
  DUE_MINUTES,
  KITCHEN_PREP_BASE_MINUTES,
  LATE_MINUTES,
  TRANSIT_RESERVE_MINUTES,
  asTicket,
  freshnessLabel,
  readyOutcome,
  serverClockOffsetMs,
  sortBoard,
  ticketAgeMinutes,
  ticketLabel,
  ticketLines,
  totalPortions,
  urgencyOf,
  type KdsTicket,
} from "./kds";

const T0 = Date.parse("2026-07-25T09:00:00.000Z");
const at = (offsetMin: number) => new Date(T0 + offsetMin * 60_000).toISOString();

function ticket(over: Partial<KdsTicket> = {}): KdsTicket {
  return {
    id: 1,
    externalOrderId: "alc-1",
    status: "placed",
    items: [{ id: 7, name: "Millet Khichdi", qty: 2, price: 30_000 }],
    createdAt: at(0),
    ...over,
  };
}

// --- the ladder ------------------------------------------------------------
// These assert the DERIVATION, not the literals. Retuning the board is fine;
// retuning it into a shape that no longer follows from the kitchen's own prep
// estimate and the customer's promise is what fails here.

test("the ladder is anchored to the kitchen's numbers, not to taste", () => {
  assert.equal(DUE_MINUTES, KITCHEN_PREP_BASE_MINUTES);
  assert.equal(LATE_MINUTES, CUSTOMER_PROMISE_MINUTES - TRANSIT_RESERVE_MINUTES);
  assert.ok(DUE_MINUTES < LATE_MINUTES, "due must precede late");
  assert.ok(
    LATE_MINUTES < CUSTOMER_PROMISE_MINUTES,
    "a ticket must go red while the promise can still be kept, not after",
  );
  assert.ok(TRANSIT_RESERVE_MINUTES > 0, "no rider teleports");
});

test("urgencyOf steps exactly on the boundaries", () => {
  assert.equal(urgencyOf(0), "fresh");
  assert.equal(urgencyOf(DUE_MINUTES - 1), "fresh");
  assert.equal(urgencyOf(DUE_MINUTES), "due");
  assert.equal(urgencyOf(LATE_MINUTES - 1), "due");
  assert.equal(urgencyOf(LATE_MINUTES), "late");
  assert.equal(urgencyOf(600), "late");
});

test("an unknown age is never fresh", () => {
  // The whole point of returning null instead of 0. A ticket whose timestamp
  // is unreadable is a ticket nobody can vouch for; painting it green is the
  // one answer that gets food forgotten.
  assert.equal(urgencyOf(null), "due");
});

// --- age -------------------------------------------------------------------

test("ticketAgeMinutes floors, never rounds up", () => {
  assert.equal(ticketAgeMinutes(at(0), T0), 0);
  assert.equal(ticketAgeMinutes(at(-1), T0), 1);
  assert.equal(ticketAgeMinutes(at(-90), T0), 90);
  // 119 seconds is one minute of elapsed time, not two.
  assert.equal(ticketAgeMinutes(new Date(T0 - 119_000).toISOString(), T0), 1);
});

test("a ticket from the future reads as new, not negative", () => {
  // A tablet whose clock runs behind the server. "-3 min" on a kitchen screen
  // is a bug report; 0 is a ticket that just landed.
  assert.equal(ticketAgeMinutes(at(3), T0), 0);
});

test("an unparseable timestamp yields null", () => {
  assert.equal(ticketAgeMinutes("not a date", T0), null);
  assert.equal(ticketAgeMinutes("", T0), null);
});

// --- lines -----------------------------------------------------------------

test("well-formed lines pass through unflagged", () => {
  const lines = ticketLines([
    { id: 1, name: "Millet Khichdi", qty: 2, price: 30_000 },
    { id: 2, name: "  Dal Tadka  ", qty: 1, price: 18_000 },
  ]);
  assert.deepEqual(lines, [
    { name: "Millet Khichdi", qty: 2, suspect: false, customizations: [] },
    { name: "Dal Tadka", qty: 1, suspect: false, customizations: [] },
  ]);
});

test("customisation labels reach the cook — the kitchen must know a boost was billed", () => {
  // The concrete bug this closes: a customer pays for "Multigrain Bread" and
  // the kitchen fires the plain dish because the label never reached the
  // board (see BATCH-4-GROUNDING.md finding 1 and dishCustomizations.ts).
  const lines = ticketLines([
    { id: 1, name: "Grilled Veggie Sandwich", qty: 1, price: 27500, customizations: ["Multigrain Bread"] },
  ]);
  assert.deepEqual(lines, [
    { name: "Grilled Veggie Sandwich", qty: 1, suspect: false, customizations: ["Multigrain Bread"] },
  ]);
});

test("a line with no customisations field gets an empty array, not undefined", () => {
  const lines = ticketLines([{ id: 1, name: "Plain Dal", qty: 1 }]);
  assert.deepEqual(lines[0]?.customizations, []);
});

test("a malformed customizations field is tolerated — treated as none, not a parse failure", () => {
  // customizations riding shotgun on jsonb is just as unvalidated as name/qty;
  // garbage there must not make an otherwise-good line `suspect`.
  const lines = ticketLines([{ id: 1, name: "Dal", qty: 1, customizations: "not an array" }]);
  assert.equal(lines[0]?.suspect, false);
  assert.deepEqual(lines[0]?.customizations, []);
});

test("non-string entries inside customizations are dropped, not fabricated as text", () => {
  const lines = ticketLines([{ id: 1, name: "Dal", qty: 1, customizations: ["Extra Spice", 42, null, "  "] }]);
  assert.deepEqual(lines[0]?.customizations, ["Extra Spice"]);
});

test("a malformed line is kept, flagged, and counted — never dropped", () => {
  // The invariant this file exists for. `orders.items` is jsonb with no
  // runtime validation between the database and the screen. Dropping a line
  // the parser dislikes makes the kitchen under-produce that ticket, and the
  // first person to notice is the customer opening the bag.
  const raw: unknown[] = [
    { id: 1, name: "Millet Khichdi", qty: 2 },
    { id: 2, name: "", qty: 1 },
    { id: 3, name: "Dal Tadka", qty: 0 },
    { id: 4, name: "Roti", qty: 2.5 },
    { id: 5, name: 42, qty: 1 },
    null,
    "not an object",
  ];
  const lines = ticketLines(raw);
  assert.equal(lines.length, raw.length, "every entry produces exactly one line");
  assert.equal(lines[0]?.suspect, false);
  for (const i of [1, 2, 3, 4, 5, 6]) {
    assert.equal(lines[i]?.suspect, true, `entry ${i} should be flagged`);
  }
  // A fallback qty is 1, never 0 — the cook makes one and checks, rather than
  // making none because the number was unreadable.
  assert.ok(lines.every((l) => l.qty >= 1));
  assert.ok(lines.every((l) => l.name.trim() !== ""));
});

test("items that are not an array yield no lines at all", () => {
  // Distinct from "an array of junk": there is nothing here to salvage, and
  // the caller renders it as a warning rather than as a ticket to make.
  for (const junk of [null, undefined, 0, "x", {}]) {
    assert.deepEqual(ticketLines(junk), []);
  }
});

test("totalPortions counts what leaves the pass", () => {
  assert.equal(totalPortions(ticketLines([{ name: "A", qty: 2 }, { name: "B", qty: 3 }])), 5);
  assert.equal(totalPortions([]), 0);
});

// --- labels ----------------------------------------------------------------

test("a ticket is never nameless", () => {
  assert.equal(ticketLabel(ticket({ externalOrderId: "alc-42" })), "alc-42");
  assert.equal(ticketLabel(ticket({ id: 9, externalOrderId: null })), "#9");
  assert.equal(ticketLabel(ticket({ id: 9, externalOrderId: "   " })), "#9");
});

// --- ordering --------------------------------------------------------------

test("the board is oldest first and does not mutate its input", () => {
  const input = [
    ticket({ id: 3, createdAt: at(-5) }),
    ticket({ id: 1, createdAt: at(-30) }),
    ticket({ id: 2, createdAt: at(-12) }),
  ];
  const snapshot = input.map((t) => t.id);
  const sorted = sortBoard(input);
  assert.deepEqual(sorted.map((t) => t.id), [1, 2, 3]);
  assert.deepEqual(input.map((t) => t.id), snapshot, "sortBoard must not sort in place");
});

test("same-millisecond tickets hold a stable position across polls", () => {
  // Two orders placed in the same millisecond must not swap places between
  // polls: a card that moves under a cook's thumb is how the wrong ticket
  // gets marked ready.
  const a = ticket({ id: 8, createdAt: at(-4) });
  const b = ticket({ id: 5, createdAt: at(-4) });
  assert.deepEqual(sortBoard([a, b]).map((t) => t.id), [5, 8]);
  assert.deepEqual(sortBoard([b, a]).map((t) => t.id), [5, 8]);
});

test("a ticket with an unreadable timestamp sorts to the front", () => {
  const sorted = sortBoard([
    ticket({ id: 1, createdAt: at(-2) }),
    ticket({ id: 2, createdAt: "garbage" }),
  ]);
  assert.deepEqual(sorted.map((t) => t.id), [2, 1]);
});

// --- clock -----------------------------------------------------------------

test("an absent or unreadable Date header means trust the local clock", () => {
  // Cross-origin this header is usually invisible (`Date` is not CORS-safelisted).
  // The correction is an improvement when available, never a dependency.
  assert.equal(serverClockOffsetMs(null, T0), 0);
  assert.equal(serverClockOffsetMs("", T0), 0);
  assert.equal(serverClockOffsetMs("yesterday-ish", T0), 0);
});

test("a Date header corrects a drifting tablet", () => {
  const header = new Date(T0 + 4 * 60_000).toUTCString();
  const offset = serverClockOffsetMs(header, T0);
  assert.equal(offset, 4 * 60_000);
  // A ticket placed 10 real minutes ago on a tablet running 4 minutes slow
  // reads as 10, not 6.
  assert.equal(ticketAgeMinutes(at(-6), T0 + offset), 10);
});

// --- the Ready tap ---------------------------------------------------------

test("a Ready that did not take gives the ticket back", () => {
  // The invariant. An optimistic board removes the card on tap; if the request
  // then fails and the card does not return, that order is never cooked and
  // nobody in the kitchen has any way to notice.
  for (const kind of ["forbidden", "unavailable"] as const) {
    const outcome = readyOutcome(kind, "alc-7");
    assert.equal(outcome.restore, true, kind);
    assert.match(outcome.note ?? "", /alc-7/, `${kind} must name the ticket`);
  }
});

test("success is silent; not_on_board is explained and stays gone", () => {
  assert.deepEqual(readyOutcome("ok", "alc-7"), { restore: false, note: null });
  const gone = readyOutcome("not_on_board", "alc-7");
  assert.equal(gone.restore, false, "the server says it is not ours to advance");
  assert.match(gone.note ?? "", /alc-7/);
});

test("every outcome that is not success says something", () => {
  // Before the order-channel work all four of these were `{ok:true}`. Silence
  // is what that bug felt like from the kitchen, so silence is now only ever
  // the sound of an order that really did advance.
  for (const kind of ["not_on_board", "forbidden", "unavailable"] as const) {
    assert.ok((readyOutcome(kind, "alc-7").note ?? "").length > 0, kind);
  }
});

// --- liveness --------------------------------------------------------------

test("freshnessLabel never lets `never` read as `recently`", () => {
  assert.equal(freshnessLabel(null, T0), "never");
  assert.equal(freshnessLabel(T0, T0), "just now");
  assert.equal(freshnessLabel(T0 - 9_000, T0), "just now");
  assert.equal(freshnessLabel(T0 - 20_000, T0), "20s ago");
  assert.equal(freshnessLabel(T0 - 89_000, T0), "89s ago");
  assert.equal(freshnessLabel(T0 - 90_000, T0), "1 min ago");
  assert.equal(freshnessLabel(T0 - 20 * 60_000, T0), "20 min ago");
  // A device clock that jumped backwards must not print a negative age.
  assert.equal(freshnessLabel(T0 + 5_000, T0), "just now");
});

// --- row narrowing ---------------------------------------------------------

test("asTicket keeps a good row and rejects only what it cannot identify", () => {
  const good = asTicket({
    id: 4,
    externalOrderId: "alc-4",
    status: "preparing",
    items: [],
    createdAt: at(-1),
  });
  assert.equal(good?.id, 4);
  assert.equal(good?.externalOrderId, "alc-4");

  // A missing/!string external id degrades that FIELD to null; it does not
  // cost the kitchen the ticket.
  assert.equal(asTicket({ id: 4, status: "placed", createdAt: at(0) })?.externalOrderId, null);

  // No id, no status, no timestamp — nothing to render or act on.
  assert.equal(asTicket({ status: "placed", createdAt: at(0) }), null);
  assert.equal(asTicket({ id: 4, createdAt: at(0) }), null);
  assert.equal(asTicket({ id: 4, status: "placed" }), null);
  assert.equal(asTicket(null), null);
  assert.equal(asTicket("row"), null);
});
