/**
 * Kitchen display board — the pure half. No fetch, no React, no clock reads:
 * every function here takes the current time as an argument, so the whole
 * board is testable without faking timers.
 *
 * The board renders GET /api/ops/kds/orders (routes/ops.ts), which since the
 * order-channel work returns own-app meal tickets only — the aggregator and
 * counter orders live on Petpooja's own screen. See §5 of
 * claude/order-channel-split.md for why that is two boards and not one.
 *
 * Two properties are load-bearing enough to have tests of their own:
 *
 *   • A line the board cannot parse must still be VISIBLE. `orders.items` is
 *     jsonb with no runtime validation behind it, so a malformed line is
 *     possible. Dropping it silently makes the kitchen under-produce a ticket
 *     and nobody finds out until the customer opens the bag. A line that
 *     doesn't parse is shown, flagged, and counted.
 *
 *   • Age never reads as fresh when it is unknown. An unparseable createdAt
 *     returns null, not 0 — 0 would paint a broken ticket green.
 */

/** One row of GET /api/ops/kds/orders. `items` is deliberately `unknown`:
 *  the server sends the jsonb column straight through, and the shape is not
 *  validated anywhere between the database and here. */
export interface KdsTicket {
  id: number;
  /** Nullable in the schema — orders created before the id existed, and any
   *  row the checkout path didn't stamp, have none. */
  externalOrderId: string | null;
  status: string;
  items: unknown;
  createdAt: string;
}

/** A line as the cook reads it. `suspect` means the source row was malformed
 *  and one of these values is a fallback, not the truth. */
export interface TicketLine {
  name: string;
  qty: number;
  suspect: boolean;
  /** Non-default customisation selections billed on this line (e.g.
   *  ["Multigrain Bread"]) — the kitchen must see these or it fires the plain
   *  dish while the customer paid for, and expects, the modification. Absent
   *  or empty on a line with no customisations; never fabricated when unclear
   *  — a malformed entry here is simply dropped, not guessed at. */
  customizations: string[];
}

export type Urgency = "fresh" | "due" | "late";

// ---------------------------------------------------------------------------
// The ladder.
//
// These are NOT invented numbers, and they are not the board's to choose. Both
// are the house's existing commitments, restated here because the storefront
// cannot import from api-server:
//
//   KITCHEN_PREP_BASE_MINUTES  = PREP_BASE in api-server/src/lib/etaModel.ts —
//     the flat prep component of the ETA the customer was quoted.
//   CUSTOMER_PROMISE_MINUTES   = the 25-minute door-to-door SLA the status
//     endpoint counts down (api-server/src/routes/checkout.ts).
//
// A ticket is `due` once it has outlived the kitchen's own estimate of itself,
// and `late` once no rider could still make the promise: LATE_MINUTES leaves
// five minutes for pickup and transit, which the ETA model's own floor
// (0.5km × 3 min/km + 2 min handoff) says is already optimistic.
//
// If either upstream number moves, this must move with it. There is no import
// that would make that automatic, so it is written down instead — and
// kds.test.ts asserts the DERIVATION, not the literals, so a change that
// breaks the reasoning fails rather than silently re-anchoring the board.
// ---------------------------------------------------------------------------
export const KITCHEN_PREP_BASE_MINUTES = 12;
export const CUSTOMER_PROMISE_MINUTES = 25;
export const TRANSIT_RESERVE_MINUTES = 5;

export const DUE_MINUTES = KITCHEN_PREP_BASE_MINUTES;
export const LATE_MINUTES = CUSTOMER_PROMISE_MINUTES - TRANSIT_RESERVE_MINUTES;

/**
 * Minutes since the ticket was placed, or null if `createdAt` doesn't parse.
 *
 * Null rather than 0: a ticket whose timestamp is garbage is a ticket of
 * unknown age, and unknown must not render as new. Negative ages (a tablet
 * clock running behind the server) floor at 0 rather than showing "-3 min".
 */
export function ticketAgeMinutes(createdAt: string, nowMs: number): number | null {
  const placed = Date.parse(createdAt);
  if (!Number.isFinite(placed)) return null;
  return Math.max(0, Math.floor((nowMs - placed) / 60_000));
}

/** Where a ticket sits on the ladder. Unknown age is never `fresh`. */
export function urgencyOf(minutes: number | null): Urgency {
  if (minutes === null) return "due";
  if (minutes >= LATE_MINUTES) return "late";
  if (minutes >= DUE_MINUTES) return "due";
  return "fresh";
}

/**
 * The server's clock, minus this device's.
 *
 * A kitchen tablet is a cheap device that has been on a wall for a year; its
 * clock drifts, and every age on this board is computed from it. The HTTP
 * `Date` response header is the server's own clock and costs nothing to read.
 *
 * Cross-origin it is usually absent — `Date` is not a CORS-safelisted response
 * header, so unless the API sets Access-Control-Expose-Headers it won't be
 * visible to this code. That is why an absent or unparseable header yields an
 * offset of 0 (trust the local clock) rather than an error: correcting the
 * clock is an improvement when available, never a dependency.
 */
export function serverClockOffsetMs(dateHeader: string | null, localNowMs: number): number {
  if (!dateHeader) return 0;
  const serverNow = Date.parse(dateHeader);
  if (!Number.isFinite(serverNow)) return 0;
  return serverNow - localNowMs;
}

/**
 * The lines to cook, from the unvalidated `items` jsonb.
 *
 * Tolerant on purpose. Anything array-shaped yields one line per entry; a
 * name that isn't a usable string and a qty that isn't a positive whole
 * number each fall back and set `suspect`. The only thing that produces an
 * empty list is a value that is not an array at all — and the caller renders
 * THAT as a visible warning, not as a ticket with nothing to make.
 */
export function ticketLines(items: unknown): TicketLine[] {
  if (!Array.isArray(items)) return [];
  return items.map((raw) => {
    const row = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
    const rawName = row["name"];
    const rawQty = row["qty"];
    const rawCustomizations = row["customizations"];
    const nameOk = typeof rawName === "string" && rawName.trim() !== "";
    const qtyOk = typeof rawQty === "number" && Number.isInteger(rawQty) && rawQty > 0;
    const customizations = Array.isArray(rawCustomizations)
      ? rawCustomizations.filter((c): c is string => typeof c === "string" && c.trim() !== "")
      : [];
    return {
      name: nameOk ? (rawName as string).trim() : "Unreadable item — check the order",
      qty: qtyOk ? (rawQty as number) : 1,
      suspect: !nameOk || !qtyOk,
      customizations,
    };
  });
}

/** Total portions on a ticket — what the cook is actually counting out. */
export function totalPortions(lines: readonly TicketLine[]): number {
  return lines.reduce((n, l) => n + l.qty, 0);
}

/** The handle the cook calls out. The external id is what's printed on the
 *  sticker; rows without one fall back to the internal id so a ticket is
 *  never nameless. */
export function ticketLabel(ticket: KdsTicket): string {
  const ext = ticket.externalOrderId?.trim();
  return ext ? ext : `#${ticket.id}`;
}

/**
 * Board order: oldest first, always. A kitchen board that reorders itself by
 * anything other than arrival is a board that lets a ticket sit.
 *
 * Ties break on `id` ascending so two orders placed in the same millisecond
 * hold a stable position across polls — a card that swaps places under a
 * cook's thumb is how the wrong ticket gets marked ready. An unparseable
 * timestamp sorts FIRST, for the same reason it never reads as fresh: a
 * ticket of unknown age is the one to look at.
 */
export function sortBoard(tickets: readonly KdsTicket[]): KdsTicket[] {
  return [...tickets].sort((a, b) => {
    const ta = Date.parse(a.createdAt);
    const tb = Date.parse(b.createdAt);
    const va = Number.isFinite(ta) ? ta : -Infinity;
    const vb = Number.isFinite(tb) ? tb : -Infinity;
    if (va !== vb) return va - vb;
    return a.id - b.id;
  });
}

/** The four ways `POST /kds/orders/:id/ready` can land. Declared here rather
 *  than in kdsApi so the decision below is testable without the transport. */
export type ReadyKind = "ok" | "not_on_board" | "forbidden" | "unavailable";

export interface ReadyOutcome {
  /** Put the card back on the board? */
  restore: boolean;
  /** What the cook is told. Null only when there is nothing to say. */
  note: string | null;
}

/**
 * What a Ready tap means for the board.
 *
 * The rule worth stating out loud: a tap that did NOT advance the order gives
 * the ticket back. A board that swallows a card on a failed request loses
 * food — the cook has no way to know the tap didn't take, so the order is
 * simply never made and the first person to find out is the customer.
 *
 * `not_on_board` is the one failure that does not restore. There the server is
 * saying this order is genuinely no longer on this board — already advanced,
 * here or from another screen — and putting it back would invent work.
 *
 * That distinction is new. Until the order-channel work the endpoint answered
 * `{ok:true}` whether or not the order was on this board, so a tap on a stale
 * card reported success and changed nothing.
 */
export function readyOutcome(kind: ReadyKind, label: string): ReadyOutcome {
  switch (kind) {
    case "ok":
      return { restore: false, note: null };
    case "not_on_board":
      return {
        restore: false,
        note: `${label} is no longer on this board — it had already been advanced, possibly from another screen. Nothing changed here.`,
      };
    case "forbidden":
      return {
        restore: true,
        note: `Couldn't mark ${label} ready: the ops session has expired. Sign in again, then retry — the ticket is back on the board.`,
      };
    case "unavailable":
      return {
        restore: true,
        note: `Couldn't mark ${label} ready: the kitchen server is unreachable. The ticket is back on the board — try again.`,
      };
  }
}

/**
 * How long ago the board last heard from the server.
 *
 * A kitchen screen's first question is "is this thing still live?", and the
 * honest answer is relative, not a wall clock: "09:14" needs arithmetic, "4
 * min ago" is the arithmetic. `never` is the load-bearing case — a board that
 * has not once succeeded must not imply it is merely a little behind.
 */
export function freshnessLabel(lastGoodAtMs: number | null, nowMs: number): string {
  if (lastGoodAtMs === null) return "never";
  const sec = Math.max(0, Math.floor((nowMs - lastGoodAtMs) / 1000));
  if (sec < 10) return "just now";
  if (sec < 90) return `${sec}s ago`;
  return `${Math.floor(sec / 60)} min ago`;
}

/**
 * Narrows an arbitrary JSON value to a ticket, or null.
 *
 * The board applies this per row and keeps the rows that survive, so one bad
 * record costs one ticket rather than the whole screen. `items` is passed
 * through unexamined — `ticketLines` is where that shape is dealt with.
 */
export function asTicket(raw: unknown): KdsTicket | null {
  if (typeof raw !== "object" || raw === null) return null;
  const row = raw as Record<string, unknown>;
  const id = row["id"];
  const status = row["status"];
  const createdAt = row["createdAt"];
  if (typeof id !== "number" || !Number.isFinite(id)) return null;
  if (typeof status !== "string" || typeof createdAt !== "string") return null;
  const ext = row["externalOrderId"];
  return {
    id,
    externalOrderId: typeof ext === "string" ? ext : null,
    status,
    items: row["items"],
    createdAt,
  };
}
