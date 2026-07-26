"use client";
// Client: the Ready action lives here, and the age re-renders on the clock the
// board ticks. Everything else on this card is derived, never stateful.

import { Button } from "@/components/ui/button";
import {
  ticketAgeMinutes,
  ticketLabel,
  ticketLines,
  totalPortions,
  urgencyOf,
  type KdsTicket,
  type Urgency,
} from "@/lib/kds";

/**
 * The ladder's paint.
 *
 * The MINUTE COUNT and the tier word carry the signal; colour only reinforces
 * it. That ordering is deliberate twice over. This palette has no red/amber/
 * green ladder to borrow — gold is the sole action colour and destructive is
 * errors-only (globals.css §3.1/§3.2) — and a board read through a service
 * window, on a washed-out tablet, by whoever is nearest, has to survive colour
 * being the least reliable channel in the room.
 */
const TIER: Record<Urgency, { word: string; frame: string; stamp: string }> = {
  fresh: { word: "New", frame: "border-line", stamp: "text-ink-muted" },
  due: { word: "Due now", frame: "border-gold", stamp: "text-gold-text" },
  late: { word: "LATE", frame: "border-destructive", stamp: "text-destructive" },
};

export function TicketCard({
  ticket,
  nowMs,
  busy,
  onReady,
}: {
  ticket: KdsTicket;
  /** Server-corrected clock, ticked by the board. */
  nowMs: number;
  busy: boolean;
  onReady: (id: number) => void | Promise<void>;
}) {
  const age = ticketAgeMinutes(ticket.createdAt, nowMs);
  const tier = TIER[urgencyOf(age)];
  const lines = ticketLines(ticket.items);
  const label = ticketLabel(ticket);
  const portions = totalPortions(lines);
  // Distinct from "an array of junk", which still yields lines. There is no
  // line list at all here, and a ticket rendered with nothing on it looks like
  // a ticket already plated.
  const unreadable = !Array.isArray(ticket.items);

  return (
    <li className={`rounded-xl border-2 bg-surface p-4 ${tier.frame}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="tabular text-lg font-semibold text-ink">{label}</span>
        <span className={`tabular text-sm font-semibold ${tier.stamp}`}>
          {age === null ? "age unknown" : `${age} min`} · {tier.word}
        </span>
      </div>

      {unreadable ? (
        <p className="mt-3 text-sm font-semibold text-destructive">
          This ticket&rsquo;s items could not be read. Check the order in ops
          before cooking it.
        </p>
      ) : (
        <ul className="mt-3 space-y-1">
          {lines.map((line, i) => (
            <li key={`${i}-${line.name}`} className="flex items-baseline gap-2">
              <span className="tabular w-10 shrink-0 text-base font-semibold text-ink">
                ×{line.qty}
              </span>
              <span
                className={`text-base ${line.suspect ? "text-destructive" : "text-ink"}`}
              >
                {line.name}
              </span>
              {line.suspect && (
                <span className="text-xs font-semibold uppercase text-destructive">
                  check
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="tabular text-xs text-ink-faint">
          {portions} portion{portions === 1 ? "" : "s"} · {ticket.status}
        </span>
        <Button
          size="lg"
          disabled={busy}
          onClick={() => onReady(ticket.id)}
          aria-label={`Mark ${label} ready`}
        >
          {busy ? "Marking…" : "Ready"}
        </Button>
      </div>
    </li>
  );
}
