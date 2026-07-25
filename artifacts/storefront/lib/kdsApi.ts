/**
 * Kitchen display board — the transport half. Two endpoints, both ops-scoped
 * (artifacts/api-server/src/routes/ops.ts):
 *
 *   GET  /api/ops/kds/orders            → {orders:[{id,externalOrderId,status,items,createdAt}]}
 *   POST /api/ops/kds/orders/:id/ready  → 200 {ok:true}
 *                                       → 404 {ok:false, code:"order_not_on_board"}
 *
 * Auth is the signed `tanmatra_admin_sid` cookie (adminGate.ts accepts it for
 * ops scope), so these are `credentials:"include"` and carry no secret in
 * client JS.
 *
 * Nothing here throws. Every outcome is a named variant, because on this
 * screen the difference between them is the difference between actions:
 *
 *   forbidden    → the admin session expired. Sign in again. Retrying is futile.
 *   unavailable  → the network or the API is down. Retrying is the whole fix.
 *   not_on_board → this ticket is genuinely not ours to advance any more.
 *
 * A board that collapsed those three into "error" would leave a kitchen
 * staring at a spinner while the real problem was a seven-day cookie expiring
 * on a Tuesday.
 */
import { API_BASE } from "./apiClient";
import { asTicket, serverClockOffsetMs, type KdsTicket, type ReadyKind } from "./kds";

export type FetchImpl = typeof fetch;

export type BoardResult =
  | {
      kind: "ok";
      tickets: KdsTicket[];
      /** Server clock minus device clock; 0 when the Date header isn't visible. */
      serverOffsetMs: number;
      /** Rows the server sent that could not be read as tickets. Surfaced
       *  rather than swallowed — a board showing four of five tickets and
       *  saying nothing is worse than one that admits it. */
      dropped: number;
    }
  | { kind: "forbidden" }
  | { kind: "unavailable" };

/** The kinds live in ./kds so `readyOutcome` — the board's decision about what
 *  each one does to the card — can be tested without going near a fetch. */
export type ReadyResult = { kind: ReadyKind };

/**
 * The board, oldest-first ordering left to the caller (`sortBoard`).
 *
 * `nowMs` is passed in rather than read here so the clock-offset calculation
 * is deterministic under test.
 */
export async function fetchBoard(
  nowMs: number,
  fetchImpl: FetchImpl = fetch,
): Promise<BoardResult> {
  let res: Response;
  try {
    res = await fetchImpl(`${API_BASE}/api/ops/kds/orders`, {
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    return { kind: "unavailable" };
  }
  if (res.status === 401 || res.status === 403) return { kind: "forbidden" };
  if (!res.ok) return { kind: "unavailable" };

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { kind: "unavailable" };
  }
  const rows = (body as { orders?: unknown })?.orders;
  // An `orders` that isn't an array is a contract break, not an empty board.
  // Reporting it as zero tickets would tell the kitchen there is nothing to
  // cook, which is the one lie this screen must never tell.
  if (!Array.isArray(rows)) return { kind: "unavailable" };

  const tickets: KdsTicket[] = [];
  for (const row of rows) {
    const t = asTicket(row);
    if (t) tickets.push(t);
  }
  return {
    kind: "ok",
    tickets,
    serverOffsetMs: serverClockOffsetMs(res.headers?.get?.("date") ?? null, nowMs),
    dropped: rows.length - tickets.length,
  };
}

/**
 * Mark a ticket ready.
 *
 * The 404 is the interesting one. Until the order-channel work, this endpoint
 * answered `{ok:true}` unconditionally — a second tap on an already-advanced
 * ticket, or a tap on a stale board, reported success and changed nothing. It
 * now says which happened, and this is the client that tells the cook.
 */
export async function markReady(
  orderId: number,
  fetchImpl: FetchImpl = fetch,
): Promise<ReadyResult> {
  let res: Response;
  try {
    res = await fetchImpl(`${API_BASE}/api/ops/kds/orders/${orderId}/ready`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    return { kind: "unavailable" };
  }
  if (res.ok) return { kind: "ok" };
  if (res.status === 401 || res.status === 403) return { kind: "forbidden" };
  if (res.status === 404) return { kind: "not_on_board" };
  return { kind: "unavailable" };
}
