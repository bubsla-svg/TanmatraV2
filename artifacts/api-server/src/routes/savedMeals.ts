import { Router, type IRouter, type Request, type Response } from "express";
import { requireAuthUser as requireAuth } from "../middlewares/requireAuth";
import { eq, and } from "drizzle-orm";
import { z } from "zod/v4";
import { db, savedMealsTable } from "@workspace/db";

const router: IRouter = Router();

const SaveMealSchema = z.object({
  dishSlug: z.string().trim().min(1).max(128),
  dishName: z.string().trim().min(1).max(256),
  notes: z.string().max(1000).optional().default(""),
  tags: z.array(z.string().trim().max(64)).max(10).optional().default([]),
});

router.get("/saved-meals", async (req: Request, res: Response) => {
  const userId = await requireAuth(req, res);
  if (!userId) return;

  try {
    const rows = await db
      .select()
      .from(savedMealsTable)
      .where(eq(savedMealsTable.userId, userId));
    res.json(rows);
  } catch (e) {
    console.error("Failed to fetch saved meals:", e);
    res.status(500).json({ error: "Failed to fetch saved meals" });
  }
});

router.post("/saved-meals", async (req: Request, res: Response) => {
  const userId = await requireAuth(req, res);
  if (!userId) return;

  const parsed = SaveMealSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Malformed saved meal request body" });
    return;
  }

  const { dishSlug, dishName, notes, tags } = parsed.data;

  try {
    const existing = await db
      .select()
      .from(savedMealsTable)
      .where(and(eq(savedMealsTable.userId, userId), eq(savedMealsTable.dishSlug, dishSlug)));

    if (existing.length > 0) {
      const [updated] = await db
        .update(savedMealsTable)
        .set({ dishName, notes, tags })
        .where(and(eq(savedMealsTable.userId, userId), eq(savedMealsTable.dishSlug, dishSlug)))
        .returning();
      res.status(200).json(updated);
    } else {
      const [inserted] = await db
        .insert(savedMealsTable)
        .values({
          userId,
          dishSlug,
          dishName,
          notes,
          tags,
        })
        .returning();
      res.status(201).json(inserted);
    }
  } catch (e) {
    console.error("Failed to save meal to protocol vault:", e);
    res.status(500).json({ error: "Failed to save meal" });
  }
});

router.delete("/saved-meals/:slug", async (req: Request, res: Response) => {
  const userId = await requireAuth(req, res);
  if (!userId) return;

  const rawSlug = req.params.slug;
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : (rawSlug as string | undefined);
  if (!slug) {
    res.status(400).json({ error: "Missing dish slug in path" });
    return;
  }

  try {
    const deleted = await db
      .delete(savedMealsTable)
      .where(and(eq(savedMealsTable.userId, userId), eq(savedMealsTable.dishSlug, slug)))
      .returning();

    if (deleted.length === 0) {
      res.status(404).json({ error: "Saved meal not found in your protocol vault" });
      return;
    }

    res.status(200).json({ success: true });
  } catch (e) {
    console.error("Failed to delete saved meal:", e);
    res.status(500).json({ error: "Failed to delete saved meal" });
  }
});

export default router;
