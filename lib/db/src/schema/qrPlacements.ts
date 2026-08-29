import {
  pgTable,
  serial,
  varchar,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Printed-code acquisition (QR funnel).
 *
 * A poster, a box sticker and a gym standee each carry their OWN short code
 * (`/q/box`, `/q/gym12`), and the code is the ONLY thing that gets printed.
 * The destination is a column, so a placement can be repointed — a new offer,
 * a seasonal landing, a retired campaign — without reprinting anything that is
 * already stuck to a wall.
 *
 * `code` is stored lowercase and is matched lowercase. The QR itself encodes
 * the all-uppercase form (HTTPS://TANMATRA.FOOD/Q/BOX) because uppercase fits
 * QR alphanumeric mode, which yields a lower-density symbol that scans smaller
 * and from farther away. URL paths are case-SENSITIVE by spec, so the case fold
 * has to happen deliberately on our side — see the storefront's middleware and
 * `app/q/[src]/route.ts`.
 */
export const qrPlacementsTable = pgTable(
  "qr_placements",
  {
    id: serial("id").primaryKey(),
    /** Lowercase short code as printed, e.g. "box", "gym12". */
    code: varchar("code", { length: 64 }).notNull(),
    /** Human label for the scoreboard ("Delivery box sticker — Aug"). */
    label: varchar("label", { length: 128 }).notNull(),
    /** App-relative landing path. Validated as a same-origin path before use. */
    destination: varchar("destination", { length: 256 }).notNull(),
    /** Retired placements resolve to the generic landing, never to a 404. */
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
  },
  (table) => [uniqueIndex("uniq_qr_placements_code").on(table.code)],
);

/**
 * One row per scan, written server-side by the `/q/:src` redirect handler.
 *
 * This is the DENOMINATOR of the whole placement scoreboard: without it,
 * "scans → paid %" cannot be computed at all, because a scan that bounces off
 * the landing leaves no other trace anywhere. Every later step of the funnel is
 * a `funnel_events` row carrying the same `src`, so the join is on that column.
 *
 * Deliberately PII-free — no IP, no user agent, no phone. A scan is an
 * anonymous event and there is nothing here worth re-identifying a person with;
 * `sessionId` is the storefront's own opaque per-visit id, which is what stitches
 * a scan to the funnel rows that follow it.
 */
export const qrScansTable = pgTable(
  "qr_scans",
  {
    id: serial("id").primaryKey(),
    /** The code as requested, lowercased. Kept even when unknown — an unknown
     *  code is usually a misprint or a retired placement still in the wild, and
     *  that is exactly the thing worth seeing in the data. */
    code: varchar("code", { length: 64 }).notNull(),
    /** False when no placement matched (misprint, retired, typo). */
    known: boolean("known").notNull(),
    /** Referral code riding along on the scan, when the poster carried one. */
    ref: varchar("ref", { length: 64 }),
    /** Opaque per-visit id, so scan → pincode → phone → paid can be stitched. */
    sessionId: varchar("session_id", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_qr_scans_code_time").on(table.code, table.createdAt),
    index("idx_qr_scans_session").on(table.sessionId),
  ],
);

export type QrPlacement = typeof qrPlacementsTable.$inferSelect;
export type QrScan = typeof qrScansTable.$inferSelect;
