import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  marketplaceItemsTable,
  marketplaceBatchesTable,
  ordersTable,
  type MarketplaceItem,
  type MarketplaceOrderLine,
} from "@workspace/db";
import { idempotencyMiddleware } from "../middlewares/idempotency";
import { incMarketplaceCheckoutRollback } from "../lib/saga-metrics";
import { getDecryptedPreferences } from "../lib/userPreferences";
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { randomUUID } from "node:crypto";
import { evaluateDishForPreferences } from "@workspace/preferences-match";
import { emitServerEvent } from "../lib/serverEvents";
import { executeNightlyExpirySweep, getActiveLiquidationDeals } from "../lib/wmsFefoEngine";

const router: IRouter = Router();

const SEED_ITEMS: Array<Omit<MarketplaceItem, "id" | "createdAt" | "updatedAt">> = [
  {
    slug: "cold-pressed-evoo",
    name: "Cold-Pressed Extra Virgin Olive Oil",
    description: "First-press Spanish EVOO, RD-curated for everyday cooking.",
    longDescription:
      "First-press Spanish EVOO from Picual olives. Polyphenol-rich, low acidity. Use raw on salads or finish hot dishes — keeps smoke-point safe up to 190°C.",
    category: "oils",
    pricePaise: 89900,
    weightLabel: "500ml",
    supplierName: "Olivar de la Luz",
    image:
      "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=600&q=80",
    badges: ["RD-curated", "Single-origin"],
    rdVerified: true,
    stockQty: 80,
    isActive: true,
  },
  {
    slug: "schezwan-hot-sauce",
    name: "Small-Batch Schezwan Sauce",
    description: "Roasted byadgi chillies, garlic, soy. No preservatives.",
    longDescription:
      "Made in micro-batches with byadgi chillies, garlic, fermented black bean and aged soy. Heat: 7/10. 12-month shelf life unopened.",
    category: "sauces",
    pricePaise: 32900,
    weightLabel: "240g",
    supplierName: "Tanmatra Pantry",
    image:
      "https://images.unsplash.com/photo-1599050751795-6cdaafbc2319?w=600&q=80",
    badges: ["Small-batch"],
    rdVerified: false,
    stockQty: 120,
    isActive: true,
  },
  {
    slug: "vitamin-d3-k2",
    name: "Vitamin D3 + K2 (60 softgels)",
    description: "5000 IU D3 with 100mcg K2-MK7. 2-month supply.",
    longDescription:
      "Clinically-formulated D3+K2 stack — 5000 IU vitamin D3 paired with 100mcg K2 (MK-7) for calcium routing. Third-party tested for purity. 2-month supply at 1/day.",
    category: "supplements",
    pricePaise: 79900,
    weightLabel: "60 softgels",
    supplierName: "Tanmatra Wellness",
    image:
      "https://images.unsplash.com/photo-1550572017-edd951b55104?w=600&q=80",
    badges: ["Third-party tested", "RD-curated"],
    rdVerified: true,
    stockQty: 60,
    isActive: true,
  },
  {
    slug: "raw-honey-coorg",
    name: "Raw Coorg Forest Honey",
    description: "Single-origin, unprocessed, dark amber.",
    longDescription:
      "Wild-harvested from Coorg's coffee-blossom forests. Unfiltered, unpasteurised — natural granulation is normal and safe.",
    category: "pantry",
    pricePaise: 54900,
    weightLabel: "350g",
    supplierName: "Last Forest",
    image:
      "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=600&q=80",
    badges: ["Single-origin", "Unfiltered"],
    rdVerified: true,
    stockQty: 40,
    isActive: true,
  },
  {
    slug: "tamari-gluten-free",
    name: "Aged Tamari (Gluten-Free)",
    description: "18-month barrel-aged Japanese tamari. Wheat-free.",
    longDescription:
      "18-month barrel-aged in Japan. Pure soybean fermentation — no wheat. Deeper umami than regular soy sauce; perfect for marinades and dipping.",
    category: "sauces",
    pricePaise: 49900,
    weightLabel: "250ml",
    supplierName: "Yamasa",
    image:
      "https://images.unsplash.com/photo-1607301406259-dfb186e15de8?w=600&q=80",
    badges: ["Gluten-free"],
    rdVerified: false,
    stockQty: 70,
    isActive: true,
  },
  {
    slug: "almond-protein-mix",
    name: "Roasted Almond + Seed Mix",
    description: "Almonds, pumpkin & sunflower seeds. 8g protein/serving.",
    longDescription:
      "Slow-roasted in batches with sea salt and rosemary. 8g plant protein and 4g fiber per 30g serving. Resealable pouch.",
    category: "snacks",
    pricePaise: 39900,
    weightLabel: "200g",
    supplierName: "Tanmatra Pantry",
    image:
      "https://images.unsplash.com/photo-1502741338009-cac2772e18bc?w=600&q=80",
    badges: ["High-protein"],
    rdVerified: true,
    stockQty: 90,
    isActive: true,
  },
];

let marketplaceSeeded = false;
async function ensureMarketplaceSeeded() {
  if (marketplaceSeeded) return;
  for (const it of SEED_ITEMS) {
    await db
      .insert(marketplaceItemsTable)
      .values(it)
      .onConflictDoNothing({ target: marketplaceItemsTable.slug });
  }
  marketplaceSeeded = true;
}

router.get("/marketplace/items", async (req: Request, res: Response) => {
  await ensureMarketplaceSeeded();
  const category = String(req.query.category ?? "").trim();
  const rows = await db
    .select()
    .from(marketplaceItemsTable)
    .where(eq(marketplaceItemsTable.isActive, true))
    .orderBy(desc(marketplaceItemsTable.createdAt));
  const filtered =
    category && category !== "all"
      ? rows.filter((r) => r.category === category)
      : rows;
  res.json({ items: filtered });
});

router.get("/marketplace/items/:slug", async (req: Request, res: Response) => {
  await ensureMarketplaceSeeded();
  const slug = String(req.params.slug ?? "");
  const [row] = await db
    .select()
    .from(marketplaceItemsTable)
    .where(eq(marketplaceItemsTable.slug, slug))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json({ item: row });
});

router.get("/marketplace/items/:slug/availability", async (req: Request, res: Response) => {
  const slug = String(req.params.slug ?? "");
  const [item] = await db
    .select()
    .from(marketplaceItemsTable)
    .where(eq(marketplaceItemsTable.slug, slug))
    .limit(1);
  if (!item) {
    res.status(404).json({ error: "not found" });
    return;
  }
  const now = new Date();
  const batches = await db
    .select()
    .from(marketplaceBatchesTable)
    .where(
      and(
        eq(marketplaceBatchesTable.inventoryItemId, item.id),
        gt(marketplaceBatchesTable.currentQty, 0),
        gt(marketplaceBatchesTable.expiryDate, now),
      ),
    );
  const totalAvailableQty = batches.reduce((acc, b) => acc + b.currentQty, 0);
  const inStock = totalAvailableQty > 0 || item.stockQty > 0;
  res.json({
    itemId: item.id,
    slug: item.slug,
    totalAvailableQty: totalAvailableQty > 0 ? totalAvailableQty : item.stockQty,
    inStock,
    nextExpiryDate: batches.length ? batches[0]!.expiryDate.toISOString().slice(0, 10) : null,
  });
});

router.get("/marketplace/liquidation-deals", async (_req: Request, res: Response) => {
  let deals = getActiveLiquidationDeals();
  if (deals.length === 0) {
    deals = await executeNightlyExpirySweep();
  }
  res.json({ deals });
});

const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.number().int().positive(),
        qty: z.number().int().positive().max(20),
      }),
    )
    .min(1),
  deliveryMode: z.enum(["ship", "bundle_with_meal"]).default("ship"),
  bundleWithOrderId: z.number().int().positive().optional().nullable(),
  address: z
    .object({
      label: z.string().max(64).optional(),
      line: z.string().max(256).optional(),
      city: z.string().max(64).optional(),
      pincode: z.string().max(16).optional(),
      phone: z.string().max(32).optional(),
    })
    .optional(),
});

router.post("/marketplace/checkout", idempotencyMiddleware, async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid payload" });
    return;
  }
  const data = parsed.data;
  const userId = req.user.id;

  // Decrypt-on-read: clinical arrays are envelope-encrypted at rest; the
  // contraindication/allergen matching below must run on plaintext.
  const prefRow = await getDecryptedPreferences(userId);

  // Reserve-and-create saga (Task #6). All stock decrements and the
  // order row insert happen inside a single Postgres transaction so a
  // mid-flow connection drop can never leave stock consumed without a
  // matching order. Each per-item decrement uses an atomic predicate
  // (`set stock_qty = stock_qty - qty where stock_qty >= qty`) so two
  // concurrent buyers cannot oversell. If any item runs out mid-tx
  // the whole transaction rolls back — no partial reservation.
  try {
    const result = await db.transaction(async (tx) => {
      // Read prices/names/active flag inside the tx so the catalog
      // snapshot we use to compute totals matches what we actually
      // decrement against. We deliberately do NOT trust stockQty from
      // this read for the capacity check — that's enforced atomically
      // in the UPDATE below.
      const items = await tx
        .select()
        .from(marketplaceItemsTable)
        .where(inArray(marketplaceItemsTable.id, data.items.map((i) => i.itemId)));
      const itemMap = new Map(items.map((i) => [i.id, i]));

      const lines: MarketplaceOrderLine[] = [];
      let totalPaise = 0;
      for (const it of data.items) {
        const item = itemMap.get(it.itemId);
        if (!item || !item.isActive) {
          throw new MarketplaceCheckoutError(400, `item ${it.itemId} unavailable`);
        }
        if (prefRow) {
          const itemText = `${item.name} ${item.description} ${item.longDescription} ${item.category} ${(item.badges ?? []).join(" ")}`.toLowerCase();

          const isHighSugarOrGi =
            (item.category === "pantry" && itemText.includes("honey")) ||
            itemText.includes("sugar") ||
            itemText.includes("sweet") ||
            itemText.includes("honey") ||
            itemText.includes("jaggery") ||
            itemText.includes("syrup") ||
            itemText.includes("caramel") ||
            itemText.includes("high gi") ||
            itemText.includes("high glycaemic");

          const glycaemicIndex = isHighSugarOrGi ? "high" : "low";
          const sugarPerServing = isHighSugarOrGi ? "20g" : "2g";

          const isHighSodium =
            item.category === "sauces" ||
            itemText.includes("salt") ||
            itemText.includes("sodium") ||
            itemText.includes("soy sauce") ||
            itemText.includes("tamari") ||
            itemText.includes("schezwan") ||
            itemText.includes("pickle") ||
            itemText.includes("high sodium");

          const sodiumMg = isHighSodium ? 850 : 100;

          const contraindications: string[] = [];
          if (isHighSugarOrGi) {
            contraindications.push("diabetes");
          }
          if (isHighSodium) {
            contraindications.push("hypertension", "high_blood_pressure", "kidney_disease");
          }
          if (itemText.includes("gluten") || itemText.includes("wheat") || itemText.includes("flour") || itemText.includes("barley")) {
            contraindications.push("celiac");
          }
          for (const c of prefRow.medicalConditions ?? []) {
            const lowerC = c.toLowerCase();
            if (itemText.includes(lowerC) && !contraindications.includes(lowerC)) {
              contraindications.push(lowerC);
            }
          }

          const allergens: string[] = [];
          for (const a of prefRow.allergens ?? []) {
            const lowerA = a.toLowerCase();
            if (itemText.includes(lowerA)) {
              allergens.push(a);
            } else if (lowerA === "dairy" && (itemText.includes("milk") || itemText.includes("butter") || itemText.includes("cheese") || itemText.includes("ghee") || itemText.includes("cream") || itemText.includes("whey"))) {
              allergens.push(a);
            } else if ((lowerA === "tree nut" || lowerA === "tree nuts" || lowerA === "nuts") && (itemText.includes("almond") || itemText.includes("cashew") || itemText.includes("walnut") || itemText.includes("pistachio") || itemText.includes("pecan") || itemText.includes("nut"))) {
              allergens.push(a);
            } else if (lowerA === "soy" && (itemText.includes("soy") || itemText.includes("tamari") || itemText.includes("tofu") || itemText.includes("edamame"))) {
              allergens.push(a);
            } else if (lowerA === "gluten" && (itemText.includes("wheat") || itemText.includes("barley") || itemText.includes("rye") || itemText.includes("flour") || (!itemText.includes("tamari") && itemText.includes("soy sauce")))) {
              allergens.push(a);
            }
          }

          const syntheticDish: any = {
            id: item.id,
            slug: item.slug,
            name: item.name,
            category: item.category as any,
            price: item.pricePaise,
            image: item.image ?? "",
            description: item.description,
            isAvailable: item.isActive,
            glycaemicIndex,
            sugarPerServing,
            sodiumMg,
            allergens,
            ingredients: [item.name, item.description, item.longDescription, item.category, ...(item.badges ?? [])],
            contraindications,
            rdReviewState: item.rdVerified ? "reviewed" : "unreviewed",
            macros: { calories: 0, protein: 0, carbs: 0, fat: 0 },
          };
          const prefsMatchObj: any = {
            allergens: prefRow.allergens ?? [],
            dislikedIngredients: prefRow.dislikedIngredients ?? [],
            medicalConditions: prefRow.medicalConditions ?? [],
            cuisines: [],
            dietaryStyle: "omnivore",
          };
          const match = evaluateDishForPreferences(syntheticDish, prefsMatchObj, { strict: true });
          if (match.blocked) {
            throw new MarketplaceCheckoutError(
              422,
              `Safety block: ${item.name} conflicts with your dietary or allergen profile`,
              { code: "safety_block", blocked: true, reasons: match.blockReasons },
            );
          }
        }
        const isFirstParty = item.supplierName?.startsWith("Tanmatra") ?? false;
        const lineTotal = item.pricePaise * it.qty;
        const commissionPaise = isFirstParty ? 0 : Math.round((lineTotal * 15) / 100);
        const vendorPayoutPaise = lineTotal - commissionPaise;

        lines.push({
          itemId: item.id,
          slug: item.slug,
          name: item.name,
          qty: it.qty,
          unitPricePaise: item.pricePaise,
          supplierName: item.supplierName || "Unknown",
          commissionPaise,
          vendorPayoutPaise,
        });
        totalPaise += lineTotal;
      }

      let bundleWithOrderId: number | null = null;
      if (data.deliveryMode === "bundle_with_meal") {
        if (!data.bundleWithOrderId) {
          throw new MarketplaceCheckoutError(
            400,
            "bundleWithOrderId required for bundle_with_meal",
          );
        }
        const [order] = await tx
          .select({ id: ordersTable.id })
          .from(ordersTable)
          .where(
            and(
              eq(ordersTable.id, data.bundleWithOrderId),
              eq(ordersTable.userId, userId),
            ),
          )
          .limit(1);
        if (!order) {
          throw new MarketplaceCheckoutError(404, "bundle target order not found");
        }
        bundleWithOrderId = order.id;
      }

      // Atomic decrement per line. The `stock_qty >= qty` predicate is
      // what makes this race-free: two concurrent transactions that both
      // see (e.g.) stock=1 will serialize at the row lock, and the loser
      // will see zero rows updated and throw — rolling back any prior
      // decrements made inside the same tx.
      for (const line of lines) {
        const dec = await tx
          .update(marketplaceItemsTable)
          .set({ stockQty: sql`${marketplaceItemsTable.stockQty} - ${line.qty}` })
          .where(
            and(
              eq(marketplaceItemsTable.id, line.itemId),
              sql`${marketplaceItemsTable.stockQty} >= ${line.qty}`,
            ),
          )
          .returning({ id: marketplaceItemsTable.id });
        if (dec.length === 0) {
          throw new MarketplaceCheckoutError(409, `${line.name} out of stock`);
        }
      }

      // Fold marketplace orders into ordersTable (orderKind = 'marketplace')
      // so payments.ts's hardened Razorpay create/webhook/capture logic —
      // which reads/writes ordersTable exclusively, keyed on
      // externalOrderId/razorpayOrderId — works on them unchanged. `items`
      // carries the full MarketplaceOrderLine shape (vendor payout /
      // commission split included) that used to live only in the
      // now-retired marketplace_orders table.
      const externalOrderId = `mkt-${randomUUID()}`;
      const [created] = await tx
        .insert(ordersTable)
        .values({
          userId,
          orderKind: "marketplace",
          // Orthogonal to orderKind: a marketplace order is still one of ours.
          orderChannel: "own_app",
          externalOrderId,
          status: "placed",
          totalPaise,
          // No GST/delivery-fee layer for marketplace goods today — the
          // meal-order chargePaise (post-discount + GST + delivery fee)
          // concept doesn't apply, so leave chargePaise null and let
          // payments.ts fall back to totalPaise (its documented behavior).
          items: lines,
          marketplaceDeliveryMode: data.deliveryMode,
          bundleWithOrderId,
          addressLabel: data.address?.label,
          addressLine: data.address?.line,
          city: data.address?.city,
          pincode: data.address?.pincode,
          phone: data.address?.phone,
        })
        .returning();

      return created;
    });
    // Part 8 A4 — server-truth order_created (marketplace kind). chargePaise
    // is null for marketplace orders; payments.ts bills totalPaise instead
    // (documented fallback), so report the same number here. Fire-and-forget.
    void emitServerEvent(
      "order_created",
      {
        order_kind: "marketplace",
        charge_paise: result.chargePaise ?? result.totalPaise,
      },
      userId,
    );
    res.status(201).json({ order: result });
  } catch (err) {
    if (err instanceof MarketplaceCheckoutError) {
      // Counts every saga rollback (out-of-stock, bundle target missing,
      // item inactive). Useful for spotting catalog/seed bugs.
      incMarketplaceCheckoutRollback();
      res
        .status(err.status)
        .json(
          err.payload
            ? { error: err.message, ...err.payload }
            : { error: err.message },
        );
      return;
    }
    incMarketplaceCheckoutRollback();
    throw err;
  }
});

class MarketplaceCheckoutError extends Error {
  constructor(
    public status: number,
    msg: string,
    public payload?: any,
  ) {
    super(msg);
  }
}

router.get("/marketplace/orders", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const rows = await db
    .select()
    .from(ordersTable)
    .where(and(eq(ordersTable.userId, req.user.id), eq(ordersTable.orderKind, "marketplace")))
    .orderBy(desc(ordersTable.createdAt));
  res.json({ orders: rows });
});

export default router;
