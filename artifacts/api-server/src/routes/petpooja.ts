import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { menuItemsTable, ordersTable, ridersTable } from "@workspace/db/schema";
import { mapPetpoojaItem, serializeMenuToPetpooja, mapPetpoojaOrderToDb, mapPetpoojaStatus, type PetpoojaPushMenuPayload, type PetpoojaSaveOrderPayload, type PetpoojaCallbackPayload } from "../lib/petpooja";

const router = Router();

router.post("/integrations/petpooja/push-menu", async (req: Request, res: Response) => {
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

router.post("/integrations/petpooja/fetchmenu", async (req: Request, res: Response) => {
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
          .returning({ id: ridersTable.id });
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

export default router;
