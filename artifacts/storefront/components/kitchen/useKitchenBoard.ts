"use client";
// Kitchen board lifecycle: poll, tick the age clock, hold the last good board
// across an outage, and own the optimistic Ready tap. Kept in a hook so
// KitchenBoard.tsx stays thin — and so the three rules below live in one place
// instead of tangled through JSX.
import { useCallback, useEffect, useRef, useState } from "react";
import { readyOutcome, sortBoard, ticketLabel, type KdsTicket } from "@/lib/kds";
import { fetchBoard, markReady } from "@/lib/kdsApi";

// Tighter than the customer tracker's 20s: a ticket the kitchen hasn't seen is
// a ticket nobody is cooking, and the endpoint is one indexed read.
const POLL_MS = 15_000;
// The age readout advances between polls, so a card crosses onto the next rung
// when it actually does rather than a whole poll interval later.
const TICK_MS = 5_000;

export type BoardHealth = "loading" | "ok" | "forbidden" | "unavailable";

export interface UseKitchenBoard {
  /** Null until the first poll resolves. Never emptied by a failure. */
  tickets: KdsTicket[] | null;
  health: BoardHealth;
  dropped: number;
  lastGoodAt: number | null;
  /** Device clock, ticked. */
  nowMs: number;
  /** Server-corrected clock — what every ticket age is measured against. */
  boardNowMs: number;
  busyIds: readonly number[];
  note: string | null;
  markTicketReady: (id: number) => Promise<void>;
}

export function useKitchenBoard(): UseKitchenBoard {
  const [tickets, setTickets] = useState<KdsTicket[] | null>(null);
  const [health, setHealth] = useState<BoardHealth>("loading");
  const [dropped, setDropped] = useState(0);
  const [offsetMs, setOffsetMs] = useState(0);
  const [lastGoodAt, setLastGoodAt] = useState<number | null>(null);
  const [busyIds, setBusyIds] = useState<readonly number[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(0);
  // The same ids as `busyIds`, kept in a ref because the poll closure is built
  // once and never re-created. A poll landing mid-tap still lists the ticket
  // being advanced; without this the card flickers back and vanishes again.
  //
  // A SET, not one id: marks are independent, and serialising them would
  // silently swallow a second tap during the first one's flight — exactly the
  // dead-tap failure this screen exists to stop.
  const pending = useRef<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const result = await fetchBoard(Date.now());
      if (cancelled) return;
      if (result.kind === "ok") {
        setTickets(sortBoard(result.tickets).filter((t) => !pending.current.has(t.id)));
        setDropped(result.dropped);
        setOffsetMs(result.serverOffsetMs);
        setLastGoodAt(Date.now());
      }
      // Note what is NOT here: on forbidden or unavailable the last good board
      // stays exactly where it is and only `health` changes. Blanking it would
      // tell a kitchen there is nothing to cook — see the header of lib/kdsApi.
      setHealth(result.kind);
    };
    void poll();
    const id = setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    // Set on mount rather than at useState time: this island is server-rendered
    // too, and a clock read during render is a hydration mismatch waiting.
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const markTicketReady = useCallback(
    async (id: number) => {
      if (pending.current.has(id)) return;
      const target = (tickets ?? []).find((t) => t.id === id);
      if (!target) return;
      pending.current.add(id);
      setBusyIds((prev) => [...prev, id]);
      setNote(null);
      // Optimistic: the card leaves the moment it is tapped, so two cooks can't
      // both plate it while the request is in flight.
      setTickets((prev) => (prev ?? []).filter((t) => t.id !== id));

      const outcome = readyOutcome((await markReady(id)).kind, ticketLabel(target));
      pending.current.delete(id);
      setBusyIds((prev) => prev.filter((b) => b !== id));
      setNote(outcome.note);
      if (outcome.restore) {
        // Re-insert unless a poll already brought it back, and re-sort so it
        // lands in its arrival position rather than at the end of the board.
        setTickets((prev) =>
          (prev ?? []).some((t) => t.id === id)
            ? prev
            : sortBoard([...(prev ?? []), target]),
        );
      }
    },
    [tickets],
  );

  return {
    tickets,
    health,
    dropped,
    lastGoodAt,
    nowMs,
    boardNowMs: nowMs + offsetMs,
    busyIds,
    note,
    markTicketReady,
  };
}
