import { Router, type Request, type Response } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { menuItemsTable, ordersTable, ridersTable } from "@workspace/db/schema";
import { invalidateMenuCatalogCache } from "../lib/menuCatalogCache";
import { recordAdminAction } from "../lib/adminAudit";
import { mapPetpoojaItem, serializeMenuToPetpooja, mapPetpoojaOrderToDb, mapPetpoojaStatus, mapPetpoojaRiderStatus, classifyPosStatusTransition } from "../lib/petpooja";
import { petpoojaAuthOk, getStoreStatus, setStoreStatus } from "../lib/petpoojaClient";
import {
  petpoojaFetchMenuSchema,
  petpoojaPushMenuSchema,
  petpoojaSaveOrderSchema,
  petpoojaCallbackSchema,
  petpoojaUpdateOrderStatusSchema,
  petpoojaRiderInfoSchema,
  petpoojaItemStockSchema,
  petpoojaItemStockOffSchema,
  petpoojaGetStoreStatusSchema,
  petpoojaUpdateStoreStatusSchema,
} from "../lib/petpoojaSchemas";

const router = Router();

// 401 response in Petpooja's expected envelope.
function unauthorized(res: Response) {
  res.status(401).json({ success: "0", message: "unauthorized: invalid Petpooja credentials" });
}

// STRICT, and it must stay strict. This handler bulk-upserts `menu_items` —
// it is the single most dangerous inbound route in the service. It used to
// run "lenient", which at the time meant a request with no credentials at
// all was waved through. Do not relax it.
//
// TNM-ADM-01 ADM-28: it also used to write `price_paise` on every upsert,
// which made the catalog's operator-set price only as durable as the next
// PetPooja sync — a replayed or stale push would silently revert a manual
// price change with no record of it happening. The catalog (menu_items via
// lib/menu.ts::updatePrice) is now the sole price authority: an existing
// row's price is never touched here, and an inbound push that tries to
// change it is logged to the audit trail rather than applied. A brand-new
// item (no existing row) still gets its initial price from the payload —
// there is no operator price to protect yet, and PetPooja is the only
// source for a new item's starting price. lib/priceBands.ts's category-band
// guard deliberately does not run on this insert path; it exists to catch
// fat-fingered or malicious operator edits via updatePrice, not to validate
// a first-time POS import.
router.post("/integrations/petpooja/push-menu", async (req: Request, res: Response) => {
  if (!petpoojaAuthOk(req, req.log, "strict")) return unauthorized(res);
  const parsed = petpoojaPushMenuSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: "0", message: "invalid payload structure" });
    return;
  }
  const payload = parsed.data;

  const { items, categories, addongroups, attributes } = payload;

  try {
    req.log?.info({ itemCount: items.length }, "starting petpooja push-menu sync");

    // Process all items in a single transaction
    await db.transaction(async (tx) => {
      for (const rawItem of items) {
        const mapped = mapPetpoojaItem(
          rawItem,
          categories ?? [],
          addongroups ?? [],
          attributes ?? []
        );

        const [existing] = await tx
          .select({ pricePaise: menuItemsTable.pricePaise })
          .from(menuItemsTable)
          .where(eq(menuItemsTable.slug, mapped.slug))
          .limit(1);

        if (existing && existing.pricePaise !== mapped.pricePaise) {
          await recordAdminAction(
            {
              operatorId: "petpooja-sync",
              action: "menu.price_write_rejected",
              resourceType: "menu_item",
              resourceId: mapped.slug,
              beforeState: { pricePaise: existing.pricePaise },
              afterState: { attemptedPricePaise: mapped.pricePaise },
            },
            tx,
          );
        }

        await tx
          .insert(menuItemsTable)
          .values({
            ...mapped,
            contraindications: [], // default empty array
          })
          .onConflictDoUpdate({
            target: menuItemsTable.slug,
            set: {
              name: mapped.name,
              description: mapped.description,
              // pricePaise intentionally excluded — see the handler's doc
              // comment above. The catalog owns price, not PetPooja.
              category: mapped.category,
              isVeg: mapped.isVeg,
              isAvailable: mapped.isAvailable,
              imageUrl: mapped.imageUrl,
              tags: mapped.tags,
              allergens: mapped.allergens,
              cuisineTags: mapped.cuisineTags,
              macros: mapped.macros,
              customizations: mapped.customizations,
              updatedAt: new Date(),
            },
          });
      }
    });

    invalidateMenuCatalogCache();
    req.log?.info("petpooja push-menu sync completed successfully");
    res.status(200).json({ success: "1", message: "Menu synchronized successfully" });
  } catch (err: any) {
    req.log?.error({ err }, "failed to sync petpooja menu");
    res.status(500).json({ success: "0", message: `sync failed: ${err.message}` });
  }
});

// Reads out the entire menu (every item, price and macro) in one response.
// It had no auth guard at all; an unauthenticated caller could dump the
// catalogue. Lenient, because Petpooja's menu-pull sender may omit app_key.
router.post("/integrations/petpooja/fetchmenu", async (req: Request, res: Response) => {
  if (!petpoojaAuthOk(req, req.log, "lenient")) return unauthorized(res);
  const parsed = petpoojaFetchMenuSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: "0", message: "restID is required" });
    return;
  }
  const { restID } = parsed.data;

  if (!restID) {
    res.status(400).json({ success: "0", message: "restID is required" });
    return;
  }

  try {
    req.log?.info({ restID }, "starting petpooja fetchmenu serialization");

    const dbItems = await db.select().from(menuItemsTable);
    const payload = serializeMenuToPetpooja(dbItems);

    res.status(200).json(payload);
  } catch (err: any) {
    req.log?.error({ err }, "failed to fetch and serialize petpooja menu");
    res.status(500).json({ success: "0", message: `fetch failed: ${err.message}` });
  }
});

/**
 * Order intake from the POS — and the one route where "at least once" has to
 * be turned into "exactly once".
 *
 * A webhook that is not acknowledged is a webhook that gets retried, and this
 * one used to fail both ways at once. An unmatched customer (the aggregator
 * case, `user_id = null`) slipped past `uniq_orders_user_external` because
 * Postgres treats NULLs as distinct, so a retry silently inserted a second
 * row: two KDS tickets, two dispatches, one meal. A matched customer hit the
 * constraint with no `onConflictDoNothing` to catch it, threw, and returned
 * 500 — which Petpooja reads as failure and retries, forever, never
 * succeeding. Opposite symptoms, one cause, one fix.
 *
 * The fix is in two halves and needs both. The index
 * `uniq_orders_external_pos` (migration 0014) is the guarantee — it holds even
 * against two retries landing in the same millisecond on different instances,
 * which no amount of application-level checking can. This handler is the
 * manners: it converts the resulting conflict into the same 200 the first call
 * got, so the retry loop terminates instead of hammering a route that keeps
 * refusing it.
 *
 * `onConflictDoNothing()` is deliberately untargeted so it covers both unique
 * indexes on `orders`, i.e. both of the failure modes above, without this
 * route having to know which one it tripped.
 */
router.post("/integrations/petpooja/saveorder", async (req: Request, res: Response) => {
  if (!petpoojaAuthOk(req, req.log, "strict")) return unauthorized(res);
  const parsed = petpoojaSaveOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: "0", message: "invalid order payload structure" });
    return;
  }
  const payload = parsed.data;

  try {
    const { Restaurant, Order } = payload.orderinfo.OrderInfo;

    // An order id is not optional metadata here — it is the only handle the
    // system has on this row. Without it the order cannot be deduped, cannot
    // be found by /callback, /orderstatus or /rider-info (all three resolve on
    // external_order_id), and cannot be reconciled against the POS. Accepting
    // it would mean writing a ticket nobody can ever update or match. Better
    // to refuse it loudly at the door than to accumulate orphans quietly.
    const externalOrderId = (Order.details.orderID ?? "").trim();
    if (externalOrderId === "") {
      req.log?.warn(
        { restID: Restaurant.details.restID },
        "petpooja saveorder rejected — payload carries no orderID"
      );
      res.status(400).json({ success: "0", message: "missing orderID" });
      return;
    }

    req.log?.info(
      { clientOrderID: externalOrderId, restID: Restaurant.details.restID },
      "starting petpooja saveorder mapping"
    );

    const orderInsertData = await mapPetpoojaOrderToDb(payload, db);

    const [inserted] = await db
      .insert(ordersTable)
      .values(orderInsertData)
      .onConflictDoNothing()
      .returning({ id: ordersTable.id });

    let orderId: number;
    if (inserted) {
      orderId = inserted.id;
      req.log?.info(
        { orderID: orderId, clientOrderID: externalOrderId },
        "petpooja order saved successfully"
      );
    } else {
      // The value the mapper actually wrote, not the one parsed above, so the
      // two cannot drift into looking up a key we never stored.
      const dedupeKey = orderInsertData.externalOrderId;
      if (!dedupeKey) throw new Error("order mapper produced no external_order_id");

      // Resolved on external_order_id alone, matching how /callback,
      // /orderstatus and /rider-info find the same row. Keeping the four
      // lookups identical means they can only ever be wrong together, which is
      // a far easier property to reason about than four subtly different keys.
      // orderBy(id) only decides ties, which the unique index makes
      // unreachable for POS rows — it is there so behaviour stays defined if
      // that ever stops being true.
      const [existing] = await db
        .select({ id: ordersTable.id })
        .from(ordersTable)
        .where(eq(ordersTable.externalOrderId, dedupeKey))
        .orderBy(ordersTable.id)
        .limit(1);

      if (!existing) {
        // The insert was refused and yet nothing is there to have refused it.
        // Not a duplicate — something else is wrong, and pretending success
        // would tell Petpooja we hold an order we do not.
        throw new Error("insert conflicted but no existing order found");
      }

      orderId = existing.id;
      // warn, not info: a single duplicate is the guard working as designed,
      // but a stream of them means Petpooja is not accepting our 200s and
      // someone should look at why.
      req.log?.warn(
        { orderID: orderId, clientOrderID: externalOrderId },
        "petpooja saveorder was a duplicate — returning the existing order"
      );
    }

    // Byte-identical to the first call's response, on purpose. An idempotent
    // endpoint answers a repeat the same way it answered the original; a
    // different shape here would just be a new thing for the vendor's client
    // to mishandle.
    res.status(200).json({
      success: "1",
      message: "Your order is saved.",
      restID: Restaurant.details.restID,
      clientOrderID: externalOrderId,
      orderID: orderId.toString(),
    });
  } catch (err: any) {
    req.log?.error({ err }, "failed to save petpooja order");
    res.status(500).json({ success: "0", message: `save failed: ${err.message}` });
  }
});

/**
 * Status intake from the POS. The first of three routes that write
 * `orders.status` from a webhook, and the place to read about what they all now
 * refuse to do.
 *
 * All three used to write the incoming status unconditionally, which made an
 * order's state a function of webhook ARRIVAL order rather than of what
 * happened to the food. Webhook delivery is at-least-once and unordered, so
 * that is a bug with teeth: a retried `rider-assigned` landing after `pickedup`
 * walked a moving order back to `rider_assigned` — which is in dispatch.ts's
 * `partnerStatuses`, so an order that had already left the kitchen became
 * eligible to be batched onto a new one. A replayed accept walked a delivered
 * order back to `preparing` — which is on the KDS board, so a finished meal
 * reappeared as a ticket to cook.
 *
 * `classifyPosStatusTransition` (lib/petpooja.ts) answers advance / hold /
 * regress against the ladder in lib/db, and each of the three handlers acts on
 * that rather than on the raw mapped value.
 *
 * Two things about the response, both learned from the saveorder fix in the
 * commit before this one:
 *
 *   - A refused webhook still gets **200 with success:"1"**. The status is a
 *     4xx-shaped problem but a 4xx-shaped answer is the wrong medicine: the
 *     vendor reads non-2xx as "did not arrive" and retries, so refusing loudly
 *     would earn a retry storm for a webhook we are deliberately ignoring. The
 *     guard changes what we WRITE, not what we ANSWER. The message text says
 *     what actually happened, and the log line is where an operator looks.
 *   - A `hold` is not a no-op. It is how a rider REASSIGNMENT arrives — the
 *     same status twice, the second time with a different courier — so
 *     identity-like fields are still taken. What must not be re-applied on a
 *     hold is anything that accumulates; see the cancellation reason in
 *     /orderstatus, which a replay used to prepend to the delivery
 *     instructions a second time.
 */
router.post("/integrations/petpooja/callback", async (req: Request, res: Response) => {
  if (!petpoojaAuthOk(req, req.log, "lenient")) return unauthorized(res);
  const parsed = petpoojaCallbackSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: "0", message: "invalid status callback payload" });
    return;
  }
  const payload = parsed.data;

  if (!payload.orderID || !payload.status) {
    res.status(400).json({ success: "0", message: "invalid status callback payload" });
    return;
  }

  try {
    req.log?.info(
      { externalOrderId: payload.orderID, petpoojaStatus: payload.status },
      "received petpooja status callback"
    );

    // Find the order by its externalOrderId
    const [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.externalOrderId, payload.orderID))
      .limit(1);

    if (!order) {
      res.status(404).json({ success: "0", message: `order with external ID ${payload.orderID} not found` });
      return;
    }
    // Petpooja is the kitchen POS — it only ever tracks meal orders. Guard
    // against its numeric orderID/externalOrderId lookups ever landing on a
    // marketplace row (e.g. an id collision) and overwriting its status with
    // a kitchen-prep status it has no business having.
    if (order.orderKind !== "meal") {
      res.status(404).json({ success: "0", message: `order with external ID ${payload.orderID} not found` });
      return;
    }

    const mappedStatus = mapPetpoojaStatus(payload.status);
    const transition = classifyPosStatusTransition(order.status, mappedStatus);

    // PAID-FULFILMENT INVARIANT (lib/paidGate.ts): for an own_app order,
    // "placed" means UNPAID — the placed→live edge is reserved for the
    // payment writers (routes/payments.ts, reconciliationScheduler, the
    // verified zero-charge finalize). The POS is the source of truth for
    // aggregator/pos channels, whose "placed" rows are already settled on
    // the aggregator's side — but it must never be the promoter of an
    // unpaid own_app order (the status webhook resolves by id, so a replayed or misdirected
    // event could otherwise name one). Acknowledge without applying, same
    // posture as the regress branch.
    if (
      order.orderChannel === "own_app" &&
      order.status === "placed" &&
      transition === "advance"
    ) {
      req.log?.warn(
        {
          orderID: order.id,
          currentStatus: order.status,
          rejectedStatus: mappedStatus,
        },
        "petpooja callback rejected — would promote an unpaid own_app order"
      );
      res.status(200).json({
        success: "1",
        message: `Order status acknowledged; not applied (order awaits payment).`,
      });
      return;
    }

    if (transition === "regress") {
      // Nothing is written, including the rider block below: the only evidence
      // of ordering we have is the ladder, and a webhook that contradicts it
      // cannot be trusted for its other fields either. A row assembled from two
      // different moments in time is harder to reason about than one that is
      // simply not updated.
      req.log?.warn(
        {
          orderID: order.id,
          externalOrderId: payload.orderID,
          currentStatus: order.status,
          rejectedStatus: mappedStatus,
          petpoojaStatus: payload.status,
        },
        "petpooja callback rejected — would move the order backwards"
      );
      res.status(200).json({
        success: "1",
        message: `Callback acknowledged; status not applied (order is already ${order.status}).`,
      });
      return;
    }

    const updateFields: Record<string, unknown> = {};
    if (transition === "advance") {
      updateFields.status = mappedStatus;
    }

    if (payload.rider_phone_number && payload.rider_name) {
      let [rider] = await db
        .select()
        .from(ridersTable)
        .where(eq(ridersTable.phone, payload.rider_phone_number))
        .limit(1);

      if (!rider) {
        [rider] = await db
          .insert(ridersTable)
          .values({
            name: payload.rider_name,
            phone: payload.rider_phone_number,
            zone: "default",
            status: "active",
          })
          .returning();
      }

      // Only when it actually differs, so a replayed webhook does not issue an
      // UPDATE that changes nothing and bumps `updated_at` for no reason.
      if (rider && rider.id !== order.riderId) {
        updateFields.riderId = rider.id;
      }
    }

    if (Object.keys(updateFields).length === 0) {
      // A `hold` with nothing new attached — the ordinary duplicate delivery.
      req.log?.info(
        { orderID: order.id, externalOrderId: payload.orderID, status: order.status },
        "petpooja callback was a duplicate — nothing to change"
      );
      res.status(200).json({ success: "1", message: "Callback processed successfully" });
      return;
    }

    await db
      .update(ordersTable)
      .set({ ...updateFields, updatedAt: new Date() })
      .where(eq(ordersTable.id, order.id));

    req.log?.info(
      {
        orderID: order.id,
        externalOrderId: payload.orderID,
        status: mappedStatus,
        transition,
        applied: Object.keys(updateFields),
      },
      "petpooja status callback processed successfully"
    );

    res.status(200).json({ success: "1", message: "Callback processed successfully" });
  } catch (err: any) {
    req.log?.error({ err }, "failed to process status callback");
    res.status(500).json({ success: "0", message: `callback processing failed: ${err.message}` });
  }
});

router.post("/integrations/petpooja/orderstatus", async (req: Request, res: Response) => {
  if (!petpoojaAuthOk(req, req.log, "strict")) return unauthorized(res);
  const parsed = petpoojaUpdateOrderStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: "0", message: "clientorderID and status are required" });
    return;
  }
  const payload = parsed.data;

  if (!payload.clientorderID || !payload.status) {
    res.status(400).json({ success: "0", message: "clientorderID and status are required" });
    return;
  }

  try {
    req.log?.info(
      { clientorderID: payload.clientorderID, status: payload.status },
      "received petpooja order status update request"
    );

    // Look up the order in database. First by local orderID if provided, otherwise by clientorderID (externalOrderId)
    let order: any = null;
    if (payload.orderID && payload.orderID.trim() !== "") {
      const orderIdInt = parseInt(payload.orderID);
      if (!isNaN(orderIdInt)) {
        [order] = await db
          .select()
          .from(ordersTable)
          .where(eq(ordersTable.id, orderIdInt))
          .limit(1);
      }
    }

    if (!order) {
      [order] = await db
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.externalOrderId, payload.clientorderID))
        .limit(1);
    }

    if (!order) {
      res.status(404).json({ success: "0", message: `order with external ID ${payload.clientorderID} not found` });
      return;
    }
    if (order.orderKind !== "meal") {
      res.status(404).json({ success: "0", message: `order with external ID ${payload.clientorderID} not found` });
      return;
    }

    const mappedStatus = mapPetpoojaStatus(payload.status);
    const transition = classifyPosStatusTransition(order.status, mappedStatus);

    // PAID-FULFILMENT INVARIANT (lib/paidGate.ts): for an own_app order,
    // "placed" means UNPAID — the placed→live edge is reserved for the
    // payment writers (routes/payments.ts, reconciliationScheduler, the
    // verified zero-charge finalize). The POS is the source of truth for
    // aggregator/pos channels, whose "placed" rows are already settled on
    // the aggregator's side — but it must never be the promoter of an
    // unpaid own_app order (orderstatus resolves by id, so a replayed or misdirected
    // event could otherwise name one). Acknowledge without applying, same
    // posture as the regress branch.
    if (
      order.orderChannel === "own_app" &&
      order.status === "placed" &&
      transition === "advance"
    ) {
      req.log?.warn(
        {
          orderID: order.id,
          currentStatus: order.status,
          rejectedStatus: mappedStatus,
        },
        "petpooja orderstatus rejected — would promote an unpaid own_app order"
      );
      res.status(200).json({
        success: "1",
        status: payload.status,
        message: `Order status acknowledged; not applied (order awaits payment).`,
      });
      return;
    }

    if (transition === "regress") {
      req.log?.warn(
        {
          orderID: order.id,
          clientorderID: payload.clientorderID,
          currentStatus: order.status,
          rejectedStatus: mappedStatus,
          petpoojaStatus: payload.status,
        },
        "petpooja orderstatus rejected — would move the order backwards"
      );
      // 200 and success:"1" on purpose — see the note above /callback. `status`
      // still echoes what they sent rather than what we hold, because that
      // field is contract shape and a client may well be matching on it; the
      // message is where the truth goes.
      res.status(200).json({
        success: "1",
        message: `Status not applied; order is already ${order.status}.`,
        restID: payload.restID,
        orderID: order.id.toString(),
        status: payload.status,
      });
      return;
    }

    const updateFields: Record<string, unknown> = {};
    if (transition === "advance") {
      updateFields.status = mappedStatus;

      // Deliberately inside the `advance` branch. The reason belongs to the
      // cancellation EVENT, not to the cancelled state, and this write is not
      // idempotent — it prepends to whatever is already there. Applying it on a
      // `hold` meant a replayed cancellation produced
      // "[Cancelled: X] [Cancelled: X] …", eating the customer's real delivery
      // instructions 512 characters at a time.
      if (payload.cancelReason && mappedStatus === "cancelled") {
        const currentInstructions = order.deliveryInstructions || "";
        updateFields.deliveryInstructions = `[Cancelled: ${payload.cancelReason}] ${currentInstructions}`.substring(0, 512);
      }
    }

    if (Object.keys(updateFields).length === 0) {
      req.log?.info(
        { orderID: order.id, clientorderID: payload.clientorderID, status: order.status },
        "petpooja orderstatus was a duplicate — nothing to change"
      );
      res.status(200).json({
        success: "1",
        message: "Order status already up to date.",
        restID: payload.restID,
        orderID: order.id.toString(),
        status: payload.status,
      });
      return;
    }

    await db
      .update(ordersTable)
      .set({ ...updateFields, updatedAt: new Date() })
      .where(eq(ordersTable.id, order.id));

    req.log?.info(
      { orderID: order.id, clientorderID: payload.clientorderID, status: mappedStatus, transition },
      "order status updated successfully"
    );

    res.status(200).json({
      success: "1",
      message: "Order status updated successfully.",
      restID: payload.restID,
      orderID: order.id.toString(),
      status: payload.status,
    });
  } catch (err: any) {
    req.log?.error({ err }, "failed to update order status");
    res.status(500).json({ success: "0", message: `status update failed: ${err.message}` });
  }
});

router.post("/integrations/petpooja/rider-info", async (req: Request, res: Response) => {
  if (!petpoojaAuthOk(req, req.log, "strict")) return unauthorized(res);
  const parsed = petpoojaRiderInfoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: "fail", message: "order_id and status are required" });
    return;
  }
  const payload = parsed.data;

  if (!payload.order_id || !payload.status) {
    res.status(400).json({ success: "fail", message: "order_id and status are required" });
    return;
  }

  try {
    req.log?.info(
      { order_id: payload.order_id, status: payload.status, rider_data: payload.rider_data },
      "received petpooja rider status webhook"
    );

    let order: any = null;
    const orderIdStr = payload.order_id.toString();
    const orderIdInt = parseInt(orderIdStr);

    if (!isNaN(orderIdInt)) {
      [order] = await db
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.id, orderIdInt))
        .limit(1);
    }

    if (!order) {
      [order] = await db
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.externalOrderId, orderIdStr))
        .limit(1);
    }

    if (!order) {
      res.status(404).json({ success: "fail", message: `order with ID ${orderIdStr} not found` });
      return;
    }
    if (order.orderKind !== "meal") {
      res.status(404).json({ success: "fail", message: `order with ID ${orderIdStr} not found` });
      return;
    }

    const mappedStatus = mapPetpoojaRiderStatus(payload.status);
    const transition = classifyPosStatusTransition(order.status, mappedStatus);

    // PAID-FULFILMENT INVARIANT (lib/paidGate.ts): for an own_app order,
    // "placed" means UNPAID — the placed→live edge is reserved for the
    // payment writers (routes/payments.ts, reconciliationScheduler, the
    // verified zero-charge finalize). The POS is the source of truth for
    // aggregator/pos channels, whose "placed" rows are already settled on
    // the aggregator's side — but it must never be the promoter of an
    // unpaid own_app order (rider webhook resolves by id, so a replayed or misdirected
    // event could otherwise name one). Acknowledge without applying, same
    // posture as the regress branch.
    if (
      order.orderChannel === "own_app" &&
      order.status === "placed" &&
      transition === "advance"
    ) {
      req.log?.warn(
        {
          orderID: order.id,
          currentStatus: order.status,
          rejectedStatus: mappedStatus,
        },
        "petpooja rider webhook rejected — would promote an unpaid own_app order"
      );
      res.status(200).json({
        code: "200",
        message: `Rider status acknowledged; not applied (order awaits payment).`,
        success: "success",
      });
      return;
    }

    if (transition === "regress") {
      req.log?.warn(
        {
          orderID: order.id,
          currentStatus: order.status,
          rejectedStatus: mappedStatus,
          petpoojaStatus: payload.status,
        },
        "petpooja rider webhook rejected — would move the order backwards"
      );
      res.status(200).json({
        code: "200",
        message: `Rider status acknowledged; not applied (order is already ${order.status}).`,
        success: "success",
      });
      return;
    }

    const updateFields: Record<string, unknown> = {};
    if (transition === "advance") {
      updateFields.status = mappedStatus;
    }

    if (payload.rider_data && payload.rider_data.rider_name && payload.rider_data.rider_phone_number) {
      let [rider] = await db
        .select()
        .from(ridersTable)
        .where(eq(ridersTable.phone, payload.rider_data.rider_phone_number))
        .limit(1);

      if (!rider) {
        [rider] = await db
          .insert(ridersTable)
          .values({
            name: payload.rider_data.rider_name,
            phone: payload.rider_data.rider_phone_number,
            zone: "default",
            status: "active",
          })
          .returning();
      }

      // This is the reason `hold` exists as a separate outcome from `regress`.
      // A reassignment arrives as a second `rider-assigned` for an order
      // already in `rider_assigned` — no ladder movement, but a genuinely
      // different courier, and dropping it would leave dispatch pointing at
      // someone who is no longer carrying the food.
      if (rider && rider.id !== order.riderId) {
        updateFields.riderId = rider.id;
      }
    }

    if (Object.keys(updateFields).length === 0) {
      req.log?.info(
        { orderID: order.id, status: order.status },
        "petpooja rider webhook was a duplicate — nothing to change"
      );
      res.status(200).json({
        code: "200",
        message: "Rider status already up to date.",
        success: "success",
      });
      return;
    }

    await db
      .update(ordersTable)
      .set({ ...updateFields, updatedAt: new Date() })
      .where(eq(ordersTable.id, order.id));

    req.log?.info(
      { orderID: order.id, status: mappedStatus, transition, riderId: updateFields.riderId },
      "rider webhook status processed successfully"
    );

    res.status(200).json({
      code: "200",
      message: "Rider status saved successfully.",
      success: "success",
    });
  } catch (err: any) {
    req.log?.error({ err }, "failed to process rider status webhook");
    res.status(500).json({ success: "fail", message: `rider status update failed: ${err.message}` });
  }
});

router.post("/integrations/petpooja/item_stock", async (req: Request, res: Response) => {
  if (!petpoojaAuthOk(req, req.log, "lenient")) return unauthorized(res);
  const parsed = petpoojaItemStockSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ code: 400, status: "fail", message: "type, inStock, and itemID array are required" });
    return;
  }
  const { type, inStock, itemID, restID } = parsed.data;

  if (type === undefined || inStock === undefined || !itemID || !Array.isArray(itemID)) {
    res.status(400).json({ code: 400, status: "fail", message: "type, inStock, and itemID array are required" });
    return;
  }

  try {
    req.log?.info(
      { type, inStock, itemID, restID },
      "received petpooja item stock status update webhook"
    );

    if (type === "item") {
      for (const id of itemID) {
        await db
          .update(menuItemsTable)
          .set({ isAvailable: inStock, updatedAt: new Date() })
          .where(
            sql`${menuItemsTable.tags} @> ${JSON.stringify([`petpooja:${id}`])}::jsonb`
          );
      }
      invalidateMenuCatalogCache();
      req.log?.info({ itemID, inStock }, "successfully updated item stock status");
    } else {
      req.log?.warn(
        { type, itemID },
        "received stock update for unsupported type (addon option updates are ignored)"
      );
    }

    res.status(200).json({
      code: 200,
      status: "success",
      message: "Stock status updated successfully",
    });
  } catch (err: any) {
    req.log?.error({ err }, "failed to update item stock status");
    res.status(500).json({ code: 500, status: "error", message: `failed to update stock: ${err.message}` });
  }
});

router.post("/integrations/petpooja/item_stock_off", async (req: Request, res: Response) => {
  if (!petpoojaAuthOk(req, req.log, "lenient")) return unauthorized(res);
  const parsed = petpoojaItemStockOffSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ code: 400, status: "fail", message: "type, inStock, and itemID array are required" });
    return;
  }
  const { type, inStock, itemID, restID, autoTurnOnTime, customTurnOnTime } = parsed.data;

  if (type === undefined || inStock === undefined || !itemID || !Array.isArray(itemID)) {
    res.status(400).json({ code: 400, status: "fail", message: "type, inStock, and itemID array are required" });
    return;
  }

  try {
    req.log?.info(
      { type, inStock, itemID, restID, autoTurnOnTime, customTurnOnTime },
      "received petpooja item stock off update webhook"
    );

    if (type === "item") {
      for (const id of itemID) {
        await db
          .update(menuItemsTable)
          .set({ isAvailable: inStock, updatedAt: new Date() })
          .where(
            sql`${menuItemsTable.tags} @> ${JSON.stringify([`petpooja:${id}`])}::jsonb`
          );
      }
      invalidateMenuCatalogCache();
      req.log?.info(
        { itemID, inStock, autoTurnOnTime, customTurnOnTime },
        "successfully marked items as out-of-stock"
      );
    } else {
      req.log?.warn(
        { type, itemID },
        "received stock off update for unsupported type (addon option updates are ignored)"
      );
    }

    res.status(200).json({
      code: 200,
      status: "success",
      message: "Stock status updated successfully",
    });
  } catch (err: any) {
    req.log?.error({ err }, "failed to update item stock off status");
    res.status(500).json({ code: 500, status: "error", message: `failed to update stock: ${err.message}` });
  }
});

router.post("/integrations/petpooja/get_store_status", async (req: Request, res: Response) => {
  if (!petpoojaAuthOk(req, req.log, "lenient")) return unauthorized(res);
  const parsed = petpoojaGetStoreStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ http_code: 400, status: "fail", message: "restID is required" });
    return;
  }
  const { restID } = parsed.data;

  if (!restID) {
    res.status(400).json({ http_code: 400, status: "fail", message: "restID is required" });
    return;
  }

  req.log?.info({ restID }, "received petpooja get_store_status request");

  const current = getStoreStatus();
  res.status(200).json({
    http_code: 200,
    status: "success",
    store_status: current.status,
    message: "Store Delivery Status fetched successfully",
  });
});

router.post("/integrations/petpooja/update_store_status", async (req: Request, res: Response) => {
  if (!petpoojaAuthOk(req, req.log, "lenient")) return unauthorized(res);
  const parsed = petpoojaUpdateStoreStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ http_code: 400, status: "fail", message: "restID, store_status, and turn_on_time are required" });
    return;
  }
  const { restID, store_status, turn_on_time, reason } = parsed.data;

  if (!restID || store_status === undefined || !turn_on_time) {
    res.status(400).json({ http_code: 400, status: "fail", message: "restID, store_status, and turn_on_time are required" });
    return;
  }

  try {
    req.log?.info(
      { restID, store_status, turn_on_time, reason },
      "received petpooja update_store_status webhook request"
    );

    // Persist so get_store_status reflects the latest (in-instance; see
    // setStoreStatus note re: multi-instance durability).
    setStoreStatus(String(store_status) === "1" ? "1" : "0", turn_on_time ?? null, reason ?? null);

    res.status(200).json({
      http_code: 200,
      status: "success",
      message: `Store Status updated successfully for store ${restID}`,
    });
  } catch (err: any) {
    req.log?.error({ err }, "failed to process update_store_status webhook");
    res.status(500).json({ http_code: 500, status: "error", message: `update failed: ${err.message}` });
  }
});

export default router;
