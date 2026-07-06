import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { menuItemsTable, ordersTable } from "@workspace/db/schema";
import { mapPetpoojaItem, serializeMenuToPetpooja, mapPetpoojaOrderToDb, type PetpoojaPushMenuPayload, type PetpoojaSaveOrderPayload } from "../lib/petpooja";

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

export default router;
