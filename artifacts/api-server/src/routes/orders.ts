import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  deliveryEventsTable,
  deliverySlotsTable,
  ordersTable,
  rdUsersTable,
  refundRequestsTable,
  slotReservationsTable,
  teamProfilesTable,
} from "@workspace/db";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { emitDeliveryEvent } from "../lib/realtime";

const router: IRouter = Router();

const cancelBody = z.object({
  reason: z.string().min(1).max(120),
  priority: z.enum(["stat", "routine"]).default("routine"),
});

/**
 * Returns true iff the signed-in user has a row in `rd_users` for any RD
 * slug — i.e. they are an authenticated clinician (Registered Dietitian).
 * Clinicians are allowed to cancel patient orders on the patient's behalf
 * (STAT cancel from RdConsole). For non-clinician callers we fall back to
 * "patient owns the order" auth.
 */
async function isClinician(userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: rdUsersTable.id })
    .from(rdUsersTable)
    .where(eq(rdUsersTable.userId, userId))
    .limit(1);
  return rows.length > 0;
}

/**
 * Best-effort lookup of a human-readable clinician name for the cancelling
 * user. Joins rd_users → team_profiles by slug. Returns null when the
 * caller is not a clinician or has no team profile yet.
 */
async function lookupClinicianName(userId: string): Promise<string | null> {
  const rows = await db
    .select({ name: teamProfilesTable.name, title: teamProfilesTable.title })
    .from(rdUsersTable)
    .innerJoin(teamProfilesTable, eq(teamProfilesTable.slug, rdUsersTable.rdSlug))
    .where(eq(rdUsersTable.userId, userId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return row.title ? `${row.name}, ${row.title}` : row.name;
}

const ACTIVE_STATUSES = ["placed", "preparing", "ready", "out_for_delivery"];

/**
 * GET /api/orders/active
 *
 * Server-sourced active patient orders feed. Clinicians (anyone with a row
 * in `rd_users`) see every active order across patients — this is what the
 * RdConsole "Active patient orders" panel renders so STAT cancel is wired
 * to the canonical server list, not a localStorage cache. Non-clinicians
 * only see their own active orders.
 */
router.get("/orders/active", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const callerIsClinician = await isClinician(req.user.id);
  // This is a clinical patient-order feed (STAT cancel from RdConsole) —
  // marketplace rows have no clinical/delivery-slot meaning and shouldn't
  // appear next to real patient meal orders here.
  // ...and an aggregator's order is not a patient order at all. A Petpooja
  // push whose customer email happens to match a registered user would
  // otherwise land in this feed wearing that patient's name, offering a
  // clinician a STAT-cancel button for an order we cannot cancel, on food we
  // did not compose against their chart. `own_app` is the honest predicate:
  // this panel lists the orders we are actually answerable for.
  const baseWhere = and(
    inArray(ordersTable.status, ACTIVE_STATUSES),
    eq(ordersTable.orderKind, "meal"),
    eq(ordersTable.orderChannel, "own_app"),
  );
  const where = callerIsClinician
    ? baseWhere
    : and(baseWhere, eq(ordersTable.userId, req.user.id));

  const rows = await db
    .select({
      id: ordersTable.id,
      externalOrderId: ordersTable.externalOrderId,
      status: ordersTable.status,
      totalPaise: ordersTable.totalPaise,
      addressLabel: ordersTable.addressLabel,
      createdAt: ordersTable.createdAt,
      userId: ordersTable.userId,
    })
    .from(ordersTable)
    .where(where)
    .orderBy(desc(ordersTable.createdAt))
    .limit(100);

  res.json({
    callerIsClinician,
    orders: rows.map((r) => ({
      serverOrderId: r.id,
      externalOrderId: r.externalOrderId,
      status: r.status,
      totalPaise: r.totalPaise,
      addressLabel: r.addressLabel,
      createdAt: r.createdAt,
      patientUserId: r.userId,
    })),
  });
});

/**
 * GET /api/orders/mine
 *
 * The signed-in user's own orders across ALL statuses (meal kind), most recent
 * first — the storefront's order-history surface (SF-09). Personal only: unlike
 * /orders/active this never widens to the clinician cross-patient feed. Read
 * only; no money movement.
 */
router.get("/orders/mine", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const rows = await db
    .select({
      id: ordersTable.id,
      externalOrderId: ordersTable.externalOrderId,
      status: ordersTable.status,
      totalPaise: ordersTable.totalPaise,
      addressLabel: ordersTable.addressLabel,
      createdAt: ordersTable.createdAt,
      items: ordersTable.items,
    })
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.userId, req.user.id),
        eq(ordersTable.orderKind, "meal"),
        // An order this user placed on Zomato is theirs, but it is not ours to
        // show here: the storefront renders every row in this list with our
        // tracker and a reorder CTA, and both are lies about an aggregator
        // order. The reorder seed is the sharper edge — it replays `items`
        // into our cart, and a Petpooja row's `items` carry that POS's ids and
        // prices, not our menu's.
        eq(ordersTable.orderChannel, "own_app"),
      ),
    )
    .orderBy(desc(ordersTable.createdAt))
    .limit(100);
  res.json({
    orders: rows.map((r) => ({
      serverOrderId: r.id,
      externalOrderId: r.externalOrderId,
      status: r.status,
      totalPaise: r.totalPaise,
      addressLabel: r.addressLabel,
      createdAt: r.createdAt,
      // orderKind is filtered to "meal" AND orderChannel to "own_app" above,
      // so these are always the {id,name,qty,price} meal lines *our* checkout
      // wrote — the storefront's reorder seed (SF-09 tail / CUJ-09). Both
      // filters are what makes the ids in here safe to replay into our cart.
      // Read-only exposure of the caller's own rows.
      items: r.items,
    })),
  });
});

/**
 * POST /api/orders/:externalOrderId/cancel
 *
 * Cancels an order. Authorisation:
 *
 *   - The signed-in user owns the order (patient cancel), OR
 *   - The signed-in user is a clinician (RD) cancelling on a patient's
 *     behalf from RdConsole.
 *
 * The numeric DB id is never trusted from the client (prevents IDOR). The
 * row is resolved purely from `externalOrderId` and then the caller's
 * authority is checked against the resolved row's owner.
 *
 * Response semantics matter for the optimistic client:
 *
 *   - 200  → resolved + cancelled in the DB and broadcast over the socket.
 *            Client keeps its optimistic update.
 *   - 404  → no DB row matches `externalOrderId`. Client whose order has a
 *            `serverOrderId` treats this as a real failure and rolls back;
 *            client whose order is local-only (no `serverOrderId`) treats
 *            it as acceptable best-effort and keeps the local cancel.
 *   - 403  → caller is neither the order owner nor a clinician. Client
 *            rolls back.
 */
router.post(
  "/orders/:externalOrderId/cancel",
  async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const externalOrderId = String(req.params.externalOrderId ?? "").trim();
    if (!externalOrderId) {
      res.status(400).json({ error: "missing order id" });
      return;
    }
    const parsed = cancelBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid payload" });
      return;
    }
    const { reason, priority } = parsed.data;

    const rows = await db
      .select({
        id: ordersTable.id,
        userId: ordersTable.userId,
        status: ordersTable.status,
        deliverySlotId: ordersTable.deliverySlotId,
        razorpayOrderId: ordersTable.razorpayOrderId,
        razorpayPaymentId: ordersTable.razorpayPaymentId,
        chargePaise: ordersTable.chargePaise,
        totalPaise: ordersTable.totalPaise,
      })
      .from(ordersTable)
      .where(eq(ordersTable.externalOrderId, externalOrderId))
      .limit(1);
    const row = rows[0];

    if (!row) {
      // No DB row for this order. The order may have been client-only
      // (loyalty checkout never persisted to DB). The patient client will
      // accept this 404 as best-effort, but a clinician operating from
      // RdConsole will see it as a real failure and roll back.
      req.log.info(
        { externalOrderId, callerId: req.user.id },
        "cancel requested for unresolved order",
      );
      res
        .status(404)
        .json({ ok: false, cancelled: false, persisted: false, reason: "not_found" });
      return;
    }

    const isOwner = row.userId === req.user.id;
    const callerIsClinician = isOwner ? false : await isClinician(req.user.id);
    if (!isOwner && !callerIsClinician) {
      res.status(403).json({ error: "forbidden" });
      return;
    }

    // State machine: an order already handed to the rider or completed cannot
    // be cancelled here. Cancellable window = placed | preparing | ready.
    if (row.status === "cancelled") {
      // Idempotent — a re-issued cancel is a no-op success.
      res.json({ ok: true, cancelled: true, persisted: true, priority, reason, orderId: row.id, alreadyCancelled: true });
      return;
    }
    const CANCELLABLE = new Set(["placed", "preparing", "ready"]);
    if (!CANCELLABLE.has(row.status)) {
      res.status(409).json({
        ok: false,
        cancelled: false,
        error: "order can no longer be cancelled",
        status: row.status,
      });
      return;
    }

    const verifiedByName = callerIsClinician
      ? await lookupClinicianName(req.user.id)
      : null;

    // A paid order (money captured before cancel) needs a refund; we flag it
    // for ops rather than firing an irreversible gateway refund automatically.
    const refundRequired = Boolean(row.razorpayOrderId) && row.status !== "placed";

    await db.transaction(async (tx) => {
      await tx
        .update(ordersTable)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(ordersTable.id, row.id),
            // Defence in depth: scope the UPDATE to the row we just read so
            // we never accidentally update a different row even if a race
            // changed it.
            eq(ordersTable.externalOrderId, externalOrderId),
          ),
        );

      // Release the held delivery-slot capacity so an abandoned/cancelled
      // order stops consuming a seat (previously a permanent capacity leak).
      if (row.deliverySlotId) {
        const removed = await tx
          .delete(slotReservationsTable)
          .where(and(eq(slotReservationsTable.orderId, row.id), eq(slotReservationsTable.kind, "order")))
          .returning({ id: slotReservationsTable.id });
        if (removed.length > 0) {
          await tx
            .update(deliverySlotsTable)
            .set({ reservedCount: sql`greatest(0, ${deliverySlotsTable.reservedCount} - 1)` })
            .where(eq(deliverySlotsTable.id, row.deliverySlotId));
        }
      }

      // Raise a PENDING refund request for a paid order — an operator approves
      // it before any money is returned (never an automatic gateway refund).
      // Idempotent: one request per order.
      if (refundRequired) {
        await tx
          .insert(refundRequestsTable)
          .values({
            orderId: row.id,
            externalOrderId,
            amountPaise: row.chargePaise ?? row.totalPaise,
            status: "pending",
            reason,
            razorpayPaymentId: row.razorpayPaymentId ?? null,
            requestedBy: req.user.id,
          })
          .onConflictDoNothing({ target: refundRequestsTable.orderId });
      }
    });

    const meta = {
      reason,
      priority,
      externalOrderId,
      cancelledByUserId: req.user.id,
      cancelledByRole: callerIsClinician ? "clinician" : "patient",
      ...(refundRequired ? { refundRequired: true } : {}),
      ...(verifiedByName ? { verifiedByName } : {}),
    } as const;
    await db.insert(deliveryEventsTable).values({
      orderId: row.id,
      event: "order_cancelled",
      meta,
    });
    emitDeliveryEvent(row.id, { event: "order_cancelled", meta });

    req.log.info(
      {
        externalOrderId,
        resolvedId: row.id,
        priority,
        reason,
        cancelledByRole: meta.cancelledByRole,
      },
      "order cancelled",
    );
    res.json({
      ok: true,
      cancelled: true,
      persisted: true,
      priority,
      reason,
      orderId: row.id,
      cancelledByRole: meta.cancelledByRole,
      refundRequired,
    });
  },
);

export default router;
