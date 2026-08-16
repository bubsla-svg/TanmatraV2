import { SKIP_SWAP_CUTOFF_MS, isPastSkipCutoff } from "@workspace/subscription-rules";
import { SKIP_SWAP_CUTOFF_HOURS } from "./planDecisionFacts";

/**
 * Whether a delivery can still be changed, and — when it cannot — which one can
 * (plan item 2.2, Law 9).
 *
 * The account surface today offers Skip on every upcoming row and finds out
 * from the server that it was too late. `ManageDeliverySheet` pre-checks the
 * cutoff; `DeliveryList` does not. So the common path is: tap, wait, get
 * refused. This module is the shared predicate both surfaces should have been
 * using, plus the part 2.2 asks for that did not exist anywhere — the next
 * delivery the customer CAN still change.
 *
 * THE FAIL-OPEN THIS CLOSES. `isPastSkipCutoff` returns `false` for an
 * unparseable date ("unknown schedule → don't block on a bad value"). That is
 * the right call for a SERVER gate, which has the row in front of it and must
 * not refuse a real request over a bad string. It is the wrong call for a UI
 * affordance: there, "not past cutoff" renders an enabled Skip button that the
 * server will then refuse, which is the exact dead end this item exists to
 * remove. So `isChangeable` requires a parseable date rather than inheriting
 * the permissive default.
 *
 * Pure and DOM-free; `now` is injectable so every boundary is testable without
 * the clock.
 */

export interface CutoffDelivery {
  scheduledFor: string;
  status: string;
  [k: string]: unknown;
}

/** Only an upcoming delivery with a real date is changeable. */
export function isChangeable(delivery: CutoffDelivery, now: number = Date.now()): boolean {
  if (delivery.status !== "upcoming") return false;
  const t = Date.parse(delivery.scheduledFor);
  if (!Number.isFinite(t)) return false; // see the fail-open note above
  return !isPastSkipCutoff(delivery.scheduledFor, now);
}

/** Why this one is locked, in the customer's words. The number is derived. */
export function lockedReason(): string {
  return `With the kitchen — changes close ${SKIP_SWAP_CUTOFF_HOURS} hours before a delivery.`;
}

/**
 * The soonest delivery still inside the change window, or null.
 *
 * Null is a legitimate answer — a paused subscription has no upcoming rows at
 * all, and a customer at the end of a cycle may have nothing changeable left.
 * Callers render nothing rather than an empty promise.
 */
export function nextChangeableDelivery<T extends CutoffDelivery>(
  deliveries: readonly T[],
  now: number = Date.now(),
): T | null {
  const open = deliveries
    .filter((d) => isChangeable(d, now))
    .sort((a, b) => Date.parse(a.scheduledFor) - Date.parse(b.scheduledFor));
  return open[0] ?? null;
}

/** Short, unambiguous date for a customer: "Thu 21 Aug". */
export function formatDeliveryDate(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
}

/**
 * The Law 9 line beneath a refusal: not just "you can't", but which one you
 * still can. Null when there is genuinely nothing left to point at — saying
 * nothing beats inventing a date.
 */
export function nextChangeNote(
  deliveries: readonly CutoffDelivery[],
  now: number = Date.now(),
): string | null {
  const next = nextChangeableDelivery(deliveries, now);
  if (!next) return null;
  const when = formatDeliveryDate(next.scheduledFor);
  if (!when) return null;
  return `The next delivery you can still change is ${when}.`;
}

/**
 * The earliest date a reschedule can legally land on: at least the cutoff away,
 * and never a weekend.
 *
 * `ManageDeliverySheet` currently sets the date picker's `min` to today, so it
 * offers dates the app's own promise says are already closed — the customer
 * picks one and the server refuses. Weekends are excluded because
 * `nextWeekdayISO` never schedules one, so offering Saturday would be a second
 * way to pick an impossible date.
 */
export function earliestReschedulableDateISO(now: number = Date.now()): string {
  const d = new Date(now + SKIP_SWAP_CUTOFF_MS);
  // Round up to the next whole day: a same-day slot inside the window is not
  // selectable, and a date input has no time component to disambiguate it.
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
