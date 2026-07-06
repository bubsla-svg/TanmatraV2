import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { menuItemsTable } from "@workspace/db/schema";
import { mapPetpoojaItem, type PetpoojaPushMenuPayload } from "../lib/petpooja";

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

export default router;
