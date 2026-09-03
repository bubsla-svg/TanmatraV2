/**
 * Delivery-window model for the à-la-carte checkout (T-08).
 *
 * Pure and DOM-free: the picker is a client island, but WHICH windows a buyer
 * may choose, how a day is named and how a window is written are data
 * questions, so they live here where `node --test` can pin them. Every slot
 * comes from GET /delivery/slots — the client never invents a window, only
 * groups and labels what the server offered.
 *
 * NO "@/" ALIAS IMPORTS (storefront lib rule).
 */

/** The kitchen's clock. Slots are booked in Noida whatever the phone says. */
export const DELIVERY_TZ = "Asia/Kolkata";

/** One row of GET /delivery/slots, as the server sends it. */
export interface DeliverySlot {
  id: number;
  /** YYYY-MM-DD in the kitchen's zone. */
  slotDate: string;
  startsAt: string;
  endsAt: string;
  zone: string;
  capacity: number;
  reservedCount: number;
  remaining: number;
  full: boolean;
}

export type DayChoice = "today" | "tomorrow" | "later";

export interface SlotDay {
  /** YYYY-MM-DD */
  date: string;
  slots: DeliverySlot[];
}

export interface GroupedSlots {
  today: DeliverySlot[];
  tomorrow: DeliverySlot[];
  /** Every bookable day after tomorrow, ascending. */
  later: SlotDay[];
}

/** A window is bookable while it has not ended and still has a seat. */
export function isSlotBookable(slot: Pick<DeliverySlot, "endsAt" | "full">, now: Date): boolean {
  const ends = Date.parse(slot.endsAt);
  return Number.isFinite(ends) && ends > now.getTime() && !slot.full;
}

/** YYYY-MM-DD for an instant, in the kitchen's zone. */
export function dateKeyInZone(instant: Date, timeZone = DELIVERY_TZ): string {
  // en-CA renders ISO order (YYYY-MM-DD) natively — no manual padding.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const t = Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days);
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * Split the server's list into today / tomorrow / later, dropping anything
 * that has already closed or filled. `now` is injected so the boundary is
 * testable and so a stale tab re-groups honestly on re-render.
 */
export function groupSlots(slots: readonly DeliverySlot[], now: Date): GroupedSlots {
  const todayKey = dateKeyInZone(now);
  const tomorrowKey = addDays(todayKey, 1);
  const open = slots
    .filter((s) => isSlotBookable(s, now))
    .slice()
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const later = new Map<string, DeliverySlot[]>();
  const out: GroupedSlots = { today: [], tomorrow: [], later: [] };
  for (const s of open) {
    if (s.slotDate === todayKey) out.today.push(s);
    else if (s.slotDate === tomorrowKey) out.tomorrow.push(s);
    else if (s.slotDate > tomorrowKey) {
      const bucket = later.get(s.slotDate) ?? [];
      bucket.push(s);
      later.set(s.slotDate, bucket);
    }
  }
  out.later = [...later.entries()].map(([date, daySlots]) => ({ date, slots: daySlots }));
  return out;
}

function clockPart(instant: Date, timeZone: string): { time: string; meridiem: string } {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(instant);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "";
  const meridiem = (parts.find((p) => p.type === "dayPeriod")?.value ?? "").toLowerCase();
  return { time: `${hour}:${minute}`, meridiem };
}

/**
 * "12:30–1:30 pm" — the meridiem is written once, on the end, unless the
 * window crosses noon ("11:30 am–12:30 pm"). En dash, never a hyphen.
 */
export function slotWindowLabel(
  slot: Pick<DeliverySlot, "startsAt" | "endsAt">,
  timeZone = DELIVERY_TZ,
): string {
  const a = clockPart(new Date(slot.startsAt), timeZone);
  const b = clockPart(new Date(slot.endsAt), timeZone);
  const start = a.meridiem === b.meridiem ? a.time : `${a.time} ${a.meridiem}`;
  return `${start}–${b.time} ${b.meridiem}`.trim();
}

/** "Today", "Tomorrow", else "Mon 7 Sep". */
export function dayLabel(dateKey: string, now: Date, timeZone = DELIVERY_TZ): string {
  const todayKey = dateKeyInZone(now, timeZone);
  if (dateKey === todayKey) return "Today";
  if (dateKey === addDays(todayKey, 1)) return "Tomorrow";
  const [y, m, d] = dateKey.split("-").map(Number);
  // en-IN writes "Mon, 7 Sept"; the comma is dropped so the label reads as
  // one phrase beside the window ("Mon 7 Sept · 12:30–1:30 pm").
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  })
    .format(new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)))
    .replace(",", "");
}

/** "Tomorrow · 12:30–1:30 pm" — what the pay bar restates beside the amount. */
export function slotSummary(slot: DeliverySlot, now: Date): string {
  return `${dayLabel(slot.slotDate, now)} · ${slotWindowLabel(slot)}`;
}

/**
 * System status for the picker, derived rather than typed: says that today
 * has closed only when it actually has, and names the next real day.
 */
export function cutoffNotice(groups: GroupedSlots, now: Date): string | null {
  if (groups.today.length > 0) return null;
  if (groups.tomorrow.length > 0) return "Today's windows have closed — next delivery is tomorrow.";
  const next = groups.later[0];
  if (next) return `Today's windows have closed — next delivery is ${dayLabel(next.date, now)}.`;
  return null;
}

/** The earliest day a buyer can pick, so the picker's default is never a dead choice. */
export function defaultDayChoice(groups: GroupedSlots): DayChoice | null {
  if (groups.today.length > 0) return "today";
  if (groups.tomorrow.length > 0) return "tomorrow";
  if (groups.later.length > 0) return "later";
  return null;
}
