import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cutoffNotice,
  dateKeyInZone,
  dayLabel,
  defaultDayChoice,
  groupSlots,
  isSlotBookable,
  slotSummary,
  slotWindowLabel,
  type DeliverySlot,
} from "./deliverySlots";

// 2026-09-03 09:00 IST (03:30 UTC).
const NOW = new Date("2026-09-03T03:30:00.000Z");

function slot(id: number, date: string, startHourIst: number, over: Partial<DeliverySlot> = {}): DeliverySlot {
  const start = new Date(`${date}T${String(startHourIst).padStart(2, "0")}:30:00+05:30`);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    id,
    slotDate: date,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    zone: "default",
    capacity: 10,
    reservedCount: 0,
    remaining: 10,
    full: false,
    ...over,
  };
}

test("dateKeyInZone reports the kitchen's calendar day, not UTC's", () => {
  // 2026-09-03 23:30 UTC is already 04 September in Noida.
  assert.equal(dateKeyInZone(new Date("2026-09-03T23:30:00.000Z")), "2026-09-04");
  assert.equal(dateKeyInZone(NOW), "2026-09-03");
});

test("a closed or full window is never bookable", () => {
  assert.equal(isSlotBookable(slot(1, "2026-09-03", 12), NOW), true);
  assert.equal(isSlotBookable(slot(2, "2026-09-03", 7), NOW), false, "ended before now");
  assert.equal(isSlotBookable(slot(3, "2026-09-03", 12, { full: true }), NOW), false);
});

test("groupSlots splits today / tomorrow / later and drops the dead ones", () => {
  const g = groupSlots(
    [
      slot(5, "2026-09-05", 12),
      slot(1, "2026-09-03", 12),
      slot(2, "2026-09-03", 7), // already over
      slot(3, "2026-09-04", 12),
      slot(4, "2026-09-04", 18, { full: true }),
      slot(6, "2026-09-05", 18),
    ],
    NOW,
  );
  assert.deepEqual(g.today.map((s) => s.id), [1]);
  assert.deepEqual(g.tomorrow.map((s) => s.id), [3]);
  assert.deepEqual(g.later.map((d) => [d.date, d.slots.map((s) => s.id)]), [["2026-09-05", [5, 6]]]);
});

test("the window label writes the meridiem once, en-dashed", () => {
  assert.equal(slotWindowLabel(slot(1, "2026-09-03", 12)), "12:30–1:30 pm");
  assert.equal(slotWindowLabel(slot(2, "2026-09-03", 11)), "11:30 am–12:30 pm");
  assert.equal(slotWindowLabel(slot(3, "2026-09-03", 18)), "6:30–7:30 pm");
});

test("day labels are relative, then calendar", () => {
  assert.equal(dayLabel("2026-09-03", NOW), "Today");
  assert.equal(dayLabel("2026-09-04", NOW), "Tomorrow");
  assert.equal(dayLabel("2026-09-07", NOW), "Mon 7 Sept");
  assert.equal(slotSummary(slot(1, "2026-09-04", 12), NOW), "Tomorrow · 12:30–1:30 pm");
});

test("the cut-off notice only speaks when today has genuinely closed", () => {
  const open = groupSlots([slot(1, "2026-09-03", 12)], NOW);
  assert.equal(cutoffNotice(open, NOW), null);
  assert.equal(defaultDayChoice(open), "today");

  const tomorrowOnly = groupSlots([slot(1, "2026-09-04", 12)], NOW);
  assert.match(cutoffNotice(tomorrowOnly, NOW) ?? "", /next delivery is tomorrow/);
  assert.equal(defaultDayChoice(tomorrowOnly), "tomorrow");

  const laterOnly = groupSlots([slot(1, "2026-09-07", 12)], NOW);
  assert.match(cutoffNotice(laterOnly, NOW) ?? "", /Mon 7 Sept/);
  assert.equal(defaultDayChoice(laterOnly), "later");

  assert.equal(defaultDayChoice(groupSlots([], NOW)), null);
  assert.equal(cutoffNotice(groupSlots([], NOW), NOW), null);
});
