import { Router, type Request, type Response } from "express";
import { db, quotesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import crypto from "crypto";
import { makeBatchDishResolver } from "../lib/menuResolver";
import { calculateCartTotals } from "../lib/cartMath";

const router = Router();

const createQuoteSchema = z.object({
  items: z.array(z.object({
    dishId: z.number().int().positive(),
    qty: z.number().int().min(1)
  })).min(1)
});

router.post("/quotes", async (req: Request, res: Response) => {
  const parsed = createQuoteSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "invalid payload" }); return; }
  
  const resolver = await makeBatchDishResolver();
  const items = [];
  for (const item of parsed.data.items) {
    const dish = resolver.byId(item.dishId);
    if (!dish || !dish.isAvailable) { res.status(422).json({ error: "Item unavailable" }); return; }
    items.push({ id: dish.id, name: dish.name, qty: item.qty, price: dish.price });
  }
  
  const totals = calculateCartTotals(items.map(i => ({ unitPrice: i.price, quantity: i.qty })));
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
  const id = crypto.randomUUID();
  
  await db.insert(quotesTable).values({
    id,
    totalPaise: totals.total,
    items,
    expiresAt,
    status: "active"
  });
  
  res.status(201).json({
    id, status: "active", createdAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(), currency: "INR",
    totalPaise: totals.total, version: 1, items
  });
});

router.post("/quotes/:id/refresh", async (req: Request, res: Response) => {
  const oldQuoteId = req.params.id as string;
  if (!oldQuoteId) { res.status(400).json({ error: "missing id" }); return; }
  
  const rows = await db.select().from(quotesTable).where(eq(quotesTable.id, oldQuoteId)).limit(1);
  if (!rows.length) { res.status(404).json({ error: "not found" }); return; }
  const oldQuote = rows[0];
  
  // Supersede old quote
  await db.update(quotesTable).set({ status: "superseded" }).where(eq(quotesTable.id, oldQuoteId));
  
  const resolver = await makeBatchDishResolver();
  const newItems = [];
  let itemChanges = [];
  
  const oldItems = oldQuote.items as Array<{id: number, qty: number, price: number}>;
  for (const item of oldItems) {
    const dish = resolver.byId(item.id);
    if (!dish || !dish.isAvailable) {
      itemChanges.push({ lineId: String(item.id), label: "Item unavailable", previousAmountPaise: item.price, currentAmountPaise: 0, deltaPaise: -item.price, reason: "item_unavailable" });
      continue;
    }
    if (dish.price !== item.price) {
      itemChanges.push({ lineId: String(item.id), label: "Price changed", previousAmountPaise: item.price, currentAmountPaise: dish.price, deltaPaise: dish.price - item.price, reason: "price_changed" });
    }
    newItems.push({ id: dish.id, name: dish.name, qty: item.qty, price: dish.price });
  }
  
  const newTotals = calculateCartTotals(newItems.map(i => ({ unitPrice: i.price, quantity: i.qty })));
  const newId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  
  await db.insert(quotesTable).values({
    id: newId, totalPaise: newTotals.total, items: newItems, expiresAt, status: "active", version: oldQuote.version + 1
  });
  
  res.json({
    previousQuoteId: oldQuoteId,
    quote: { id: newId, status: "active", expiresAt: expiresAt.toISOString(), totalPaise: newTotals.total, items: newItems },
    difference: { totalDeltaPaise: newTotals.total - oldQuote.totalPaise, itemChanges },
    requiresAcceptance: itemChanges.length > 0
  });
});

export default router;
