"use client";
// Client: it reports the polling island's own state and has no data of its own.

import { freshnessLabel } from "@/lib/kds";
import type { BoardHealth } from "./useKitchenBoard";

/**
 * The board's honesty line. It renders ONLY when something is wrong, so that
 * seeing it means something — a banner that is always there is furniture, and
 * furniture is not read.
 *
 * Two failures it must never blur together:
 *
 *   • forbidden   — the ops cookie lapsed. The tickets below are real but
 *                   frozen, and no amount of waiting fixes it.
 *   • unavailable — the API is unreachable. The tickets below are real but
 *                   stale, and waiting IS the fix.
 *
 * Neither blanks the board (see KitchenBoard): an empty kitchen screen reads
 * as "nothing to cook", which is the one thing a broken board must not say.
 */
export function BoardBanner({
  health,
  lastGoodAt,
  nowMs,
  dropped,
  note,
}: {
  health: BoardHealth;
  lastGoodAt: number | null;
  nowMs: number;
  /** Rows the server sent that could not be read as tickets. */
  dropped: number;
  /** A one-off message from the last Ready tap. */
  note: string | null;
}) {
  const alerts: string[] = [];

  if (health === "forbidden") {
    alerts.push(
      "Signed out — this board is frozen. Sign in to ops in another tab and it resumes on its own.",
    );
  } else if (health === "unavailable") {
    alerts.push(
      lastGoodAt === null
        ? "Can't reach the kitchen server. This is not an empty board — it's an unknown one."
        : `Not updating — last refreshed ${freshnessLabel(lastGoodAt, nowMs)}. Tickets below may be stale, and new ones are not arriving.`,
    );
  }

  if (dropped > 0) {
    // Said out loud rather than swallowed: a board quietly showing four of five
    // tickets is worse than one that admits it is showing four.
    alerts.push(
      `${dropped} order${dropped === 1 ? "" : "s"} on the server could not be read and ${dropped === 1 ? "is" : "are"} not shown here. Check ops.`,
    );
  }

  if (note) alerts.push(note);
  if (alerts.length === 0) return null;

  return (
    // `status`, not `alert`: this re-renders on every clock tick, and an
    // assertive region would re-announce the same sentence every few seconds.
    <div
      role="status"
      className="mb-4 rounded-xl border-2 border-[var(--danger)] bg-surface p-4"
    >
      {alerts.map((line) => (
        <p key={line} className="text-sm font-semibold text-[var(--danger)]">
          {line}
        </p>
      ))}
    </div>
  );
}
