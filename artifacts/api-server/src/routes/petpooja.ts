import { Router, type Request, type Response } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { menuItemsTable, ordersTable, ridersTable } from "@workspace/db/schema";
import { mapPetpoojaItem, serializeMenuToPetpooja, mapPetpoojaOrderToDb, mapPetpoojaStatus, mapPetpoojaRiderStatus, type PetpoojaPushMenuPayload, type PetpoojaSaveOrderPayload, type PetpoojaCallbackPayload, type PetpoojaUpdateOrderStatusPayload, type PetpoojaRiderInfoPayload } from "../lib/petpooja";
import { petpoojaAuthOk, getStoreStatus, setStoreStatus } from "../lib/petpoojaClient";

const router = Router();

// 401 response in Petpooja's expected envelope.
function unauthorized(res: Response) {
  res.status(401).json({ success: "0", message: "unauthorized: invalid Petpooja credentials" });
}

// STRICT, and it must stay strict. This handler bulk-upserts `menu_items`,
// `price_paise` included — it is the single most dangerous inbound route in the
// service. It used to run "lenient", which at the time meant a request with no
// credentials at all was waved through. Do not relax it.
router.post("/integrations/petpooja/push-menu", async (req: Request, res: Response) => {
  if (!petpoojaAuthOk(req, req.log, "strict")) return unauthorized(res);
  const payload = req.body as PetpoojaPushMenuPayload;

  if (!payload || !payload.items || !Array.isArray(payload.items)) {
    res.status(400).json({ success: "0", message: "invalid payload structure" });
    return;
  }

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
              pricePaise: mapped.pricePaise,
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
  const { restID } = req.body;

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

router.post("/integrations/petpooja/saveorder", async (req: Request, res: Response) => {
  if (!petpoojaAuthOk(req, req.log, "strict")) return unauthorized(res);
  const payload = req.body as PetpoojaSaveOrderPayload;

  if (!payload || !payload.orderinfo || !payload.orderinfo.OrderInfo) {
    res.status(400).json({ success: "0", message: "invalid order payload structure" });
    return;
  }

  try {
    const { Restaurant, Order } = payload.orderinfo.OrderInfo;
    req.log?.info(
      { clientOrderID: Order.details.orderID, restID: Restaurant.details.restID },
      "starting petpooja saveorder mapping"
    );

    const orderInsertData = await mapPetpoojaOrderToDb(payload, db);

    const [inserted] = await db
      .insert(ordersTable)
      .values(orderInsertData)
      .returning({ id: ordersTable.id });

    if (!inserted) {
      throw new Error("failed to insert order row");
    }

    req.log?.info(
      { orderID: inserted.id, clientOrderID: Order.details.orderID },
      "petpooja order saved successfully"
    );

    res.status(200).json({
      success: "1",
      message: "Your order is saved.",
      restID: Restaurant.details.restID,
      clientOrderID: Order.details.orderID,
      orderID: inserted.id.toString(),
    });
  } catch (err: any) {
    req.log?.error({ err }, "failed to save petpooja order");
    res.status(500).json({ success: "0", message: `save failed: ${err.message}` });
  }
});

router.post("/integrations/petpooja/callback", async (req: Request, res: Response) => {
  if (!petpoojaAuthOk(req, req.log, "lenient")) return unauthorized(res);
  const payload = req.body as PetpoojaCallbackPayload;

  if (!payload || !payload.orderID || !payload.status) {
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
    const updateFields: any = {
      status: mappedStatus,
      updatedAt: new Date(),
    };

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

      if (rider) {
        updateFields.riderId = rider.id;
      }
    }

    await db
      .update(ordersTable)
      .set(updateFields)
      .where(eq(ordersTable.id, order.id));

    req.log?.info(
      { orderID: order.id, externalOrderId: payload.orderID, status: mappedStatus },
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
  const payload = req.body as PetpoojaUpdateOrderStatusPayload;

  if (!payload || !payload.clientorderID || !payload.status) {
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
    const updateFields: any = {
      status: mappedStatus,
      updatedAt: new Date(),
    };

    // If cancelReason is provided, prepend it to deliveryInstructions or log it.
    if (payload.cancelReason && mappedStatus === "cancelled") {
      const currentInstructions = order.deliveryInstructions || "";
      updateFields.deliveryInstructions = `[Cancelled: ${payload.cancelReason}] ${currentInstructions}`.substring(0, 512);
    }

    await db
      .update(ordersTable)
      .set(updateFields)
      .where(eq(ordersTable.id, order.id));

    req.log?.info(
      { orderID: order.id, clientorderID: payload.clientorderID, status: mappedStatus },
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
  const payload = req.body as PetpoojaRiderInfoPayload;

  if (!payload || !payload.order_id || !payload.status) {
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
    const updateFields: any = {
      status: mappedStatus,
      updatedAt: new Date(),
    };

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

      if (rider) {
        updateFields.riderId = rider.id;
      }
    }

    await db
      .update(ordersTable)
      .set(updateFields)
      .where(eq(ordersTable.id, order.id));

    req.log?.info(
      { orderID: order.id, status: mappedStatus, riderId: updateFields.riderId },
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
  const { type, inStock, itemID, restID } = req.body;

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
  const { type, inStock, itemID, restID, autoTurnOnTime, customTurnOnTime } = req.body;

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
  const { restID } = req.body;

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
  const { restID, store_status, turn_on_time, reason } = req.body;

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
