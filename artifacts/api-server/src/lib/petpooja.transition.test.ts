/**
 * classifyPosStatusTransition — the truth table.
 *
 * Pure, so it runs without a database. The route-level consequences of these
 * verdicts are in routes/petpooja.statusMonotonic.test.ts; this file is only
 * about whether the verdicts themselves are right.
 *
 * Two things are being pinned here. The obvious one is the classification of
 * each pair. The less obvious one is the INVARIANT between the two lookup
 * tables in lib/db — a status that accepts external updates must have a ladder
 * rank — because if that ever stops holding, classifyPosStatusTransition
 * silently starts taking a branch it currently cannot reach, and no individual
 * pair assertion would notice.
 *
 * Run with:
 *   node --test --import tsx ./src/lib/petpooja.transition.test.ts
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  orderStatusValues,
  orderStatusLadderRank,
  orderStatusAcceptsExternalUpdate,
  isOrderStatus,
  type OrderStatus,
} from "@workspace/db/schema";

import { classifyPosStatusTransition, type PosStatusTransition } from "./petpooja";

type Case = [from: string, to: OrderStatus, expected: PosStatusTransition, why: string];

const CASES: Case[] = [
  // ---- advance: ordinary forward motion --------------------------------
  ["placed", "preparing", "advance", "the kitchen accepted it"],
  ["preparing", "ready", "advance", "cooked"],
  ["ready", "rider_assigned", "advance", "courier attached"],
  ["rider_assigned", "out_for_delivery", "advance", "picked up"],
  ["out_for_delivery", "delivered", "advance", "landed"],

  // Skipping rungs is forward motion, not an anomaly. Petpooja emits a subset
  // of the ladder (mapPetpoojaStatus has no `ready`), and an aggregator that
  // handles its own courier may never send a rider event at all, so demanding
  // adjacency would refuse the normal case.
  ["placed", "out_for_delivery", "advance", "no `ready` callback exists"],
  ["placed", "delivered", "advance", "aggregator reporting only the outcome"],
  ["preparing", "delivered", "advance", "same, one rung later"],

  // ---- advance: cancellation from any live rung ------------------------
  // `cancelled` has no ladder rank, so it is special-cased. An outlet can
  // reject an order at any point before it lands, and that is forward motion.
  ["placed", "cancelled", "advance", "rejected before prep"],
  ["preparing", "cancelled", "advance", "abandoned mid-prep"],
  ["ready", "cancelled", "advance", "nobody came for it"],
  ["rider_assigned", "cancelled", "advance", "courier dropped it"],
  ["out_for_delivery", "cancelled", "advance", "failed en route"],

  // ---- hold: the same rung twice ---------------------------------------
  ["placed", "placed", "hold", "duplicate delivery"],
  ["preparing", "preparing", "hold", "duplicate delivery"],
  ["rider_assigned", "rider_assigned", "hold", "REASSIGNMENT arrives this way"],
  ["out_for_delivery", "out_for_delivery", "hold", "duplicate delivery"],
  // Even a settled state holds against itself rather than regressing. A repeat
  // of the event that settled it is not a contradiction — there is simply
  // nothing left to do, and calling it a regress would log an alarm on the most
  // ordinary thing a retrying webhook does.
  ["delivered", "delivered", "hold", "the delivery webhook, twice"],
  ["cancelled", "cancelled", "hold", "the cancellation webhook, twice"],

  // ---- regress: backwards down the ladder ------------------------------
  ["preparing", "placed", "regress", "un-accepting an accepted order"],
  ["ready", "preparing", "regress", "back onto the KDS board"],
  ["rider_assigned", "ready", "regress", "un-assigning a courier"],
  ["out_for_delivery", "rider_assigned", "regress", "the pickedup/rider-assigned race"],
  ["delivered", "out_for_delivery", "regress", "food is already with the customer"],
  ["delivered", "preparing", "regress", "a delivered meal reappearing as a ticket"],

  // ---- regress: anything at all out of a settled state ------------------
  ["delivered", "cancelled", "regress", "cancelling something already eaten"],
  ["cancelled", "preparing", "regress", "resurrecting a cancelled order"],
  ["cancelled", "delivered", "regress", "same, at the other end"],
  ["failed", "preparing", "regress", "settled"],
  ["refunded", "delivered", "regress", "settled; only our refund path writes it"],
  ["billed", "preparing", "regress", "marketplace settlement, not a delivery state"],

  // ---- regress: a current status we cannot place ------------------------
  // orders.status is an unconstrained varchar, and these two values were really
  // written by the old Petpooja mappers before they were typed. A row still
  // holding one cannot be located on the ladder, so it fails closed.
  ["confirmed", "preparing", "regress", "legacy value, no ladder position"],
  ["dispatched", "delivered", "regress", "legacy value, no ladder position"],
  ["", "preparing", "regress", "empty is not a status"],
  ["PLACED", "preparing", "regress", "the vocabulary is case-sensitive"],
];

test("classifyPosStatusTransition matches the truth table", () => {
  for (const [from, to, expected, why] of CASES) {
    assert.equal(
      classifyPosStatusTransition(from, to),
      expected,
      `${from} → ${to} should be ${expected} (${why})`
    );
  }
});

test("no live status can move to an earlier one", () => {
  // The table above is a sample; this is the sweep. Every ordered pair of
  // ranked statuses must classify strictly by rank, so a new rung inserted in
  // the middle of the ladder cannot be quietly inconsistent with its
  // neighbours.
  const ranked = orderStatusValues.filter(
    (s) => orderStatusLadderRank[s] !== null && orderStatusAcceptsExternalUpdate[s]
  );

  for (const from of ranked) {
    for (const to of orderStatusValues) {
      const toRank = orderStatusLadderRank[to];
      if (toRank === null) continue;
      const fromRank = orderStatusLadderRank[from]!;
      const verdict = classifyPosStatusTransition(from, to);
      const expected: PosStatusTransition =
        from === to ? "hold" : toRank > fromRank ? "advance" : "regress";
      assert.equal(verdict, expected, `${from} → ${to}`);
    }
  }
});

test("every settled status refuses every move except to itself", () => {
  const settled = orderStatusValues.filter((s) => !orderStatusAcceptsExternalUpdate[s]);
  assert.ok(settled.length > 0, "nothing is settled — the table has been gutted");

  for (const from of settled) {
    for (const to of orderStatusValues) {
      const verdict = classifyPosStatusTransition(from, to);
      assert.equal(
        verdict,
        from === to ? "hold" : "regress",
        `${from} → ${to} escaped a settled state`
      );
    }
  }
});

test("a status that accepts external updates always has a ladder rank", () => {
  // The invariant that makes the `fromRank === null` guard inside
  // classifyPosStatusTransition unreachable today. If someone adds a status
  // that is externally writable but off the ladder, that guard starts firing
  // and every move out of the new status becomes a silent regress — which is
  // safe, but is not what they will have intended. Fail here instead, where
  // the message says what to do about it.
  for (const s of orderStatusValues) {
    if (orderStatusAcceptsExternalUpdate[s]) {
      assert.notEqual(
        orderStatusLadderRank[s],
        null,
        `${s} accepts external updates but has no ladder rank — give it one, or mark it settled`
      );
    }
  }
});

test("the ladder is a strict ordering with no shared rungs", () => {
  const ranks = orderStatusValues
    .map((s) => orderStatusLadderRank[s])
    .filter((r): r is number => r !== null);
  assert.equal(new Set(ranks).size, ranks.length, "two statuses share a ladder rank");
});

test("isOrderStatus accepts exactly the vocabulary", () => {
  for (const s of orderStatusValues) {
    assert.ok(isOrderStatus(s), `${s} is in the vocabulary but was rejected`);
  }
  for (const s of ["confirmed", "dispatched", "", "Placed", "delivered "]) {
    assert.ok(!isOrderStatus(s), `${JSON.stringify(s)} is not a status but was accepted`);
  }
});
