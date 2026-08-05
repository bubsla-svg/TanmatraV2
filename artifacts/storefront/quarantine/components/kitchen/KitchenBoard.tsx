"use client";
// Client: the board is a polling island. State and the Ready rules live in
// useKitchenBoard; this file only renders them. The /kitchen page stays RSC.

import { freshnessLabel } from "@/lib/kds";
import { BoardBanner } from "./BoardBanner";
import { TicketCard } from "./TicketCard";
import { useKitchenBoard } from "./useKitchenBoard";

export function KitchenBoard() {
  const {
    tickets,
    health,
    dropped,
    lastGoodAt,
    nowMs,
    boardNowMs,
    busyIds,
    note,
    markTicketReady,
  } = useKitchenBoard();

  if (tickets === null && health === "loading") {
    return <div aria-hidden className="h-32 animate-pulse rounded-xl bg-surface-raised" />;
  }

  const board = tickets ?? [];

  return (
    <div>
      <p className="tabular mb-3 text-xs text-ink-faint">
        {board.length} on the board · updated {freshnessLabel(lastGoodAt, nowMs)}
      </p>
      <BoardBanner
        health={health}
        lastGoodAt={lastGoodAt}
        nowMs={nowMs}
        dropped={dropped}
        note={note}
      />
      {board.length === 0 && health === "ok" ? (
        // Only reachable when the server actually returned zero tickets. An
        // empty board for any other reason falls through to the list below,
        // where the banner is the thing that speaks.
        <p
          role="status"
          className="rounded-xl border border-line bg-surface p-6 text-center text-base text-ink-muted"
        >
          Nothing to cook. The board is live and empty.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {board.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              nowMs={boardNowMs}
              busy={busyIds.includes(ticket.id)}
              onReady={markTicketReady}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
