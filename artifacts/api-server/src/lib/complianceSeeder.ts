import { db, complianceLogsTable } from "@workspace/db";
import { logger } from "./logger";
import { sql } from "drizzle-orm";

export async function seedComplianceLogsIfEmpty(): Promise<void> {
  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(complianceLogsTable);

    if (count > 0) {
      return;
    }

    logger.info("compliance_logs table is empty. Seeding 30 days of compliance audit data...");

    const batchTemplates = [
      { product: "Spinach", farmOrigin: "Nandi Hills Organic Farm", prefix: "BATCH-SPN" },
      { product: "Beetroot", farmOrigin: "Malleswaram Green Cooperative", prefix: "BATCH-BET" },
      { product: "Cucumbers", farmOrigin: "Kanakapura Hydroponics Hub", prefix: "BATCH-CUC" },
      { product: "Hung Curd", farmOrigin: "Nandini Dairy Plant #3", prefix: "BATCH-CRD" },
      { product: "Almonds", farmOrigin: "Kashmir Dryfruit Packers", prefix: "BATCH-ALM" },
      { product: "Whole Wheat Wraps", farmOrigin: "Tanmatra Bakeries", prefix: "BATCH-WRP" },
    ];

    const today = new Date();
    const rows = [];

    for (let i = 29; i >= 0; i--) {
      const dateVal = new Date(today);
      dateVal.setUTCDate(today.getUTCDate() - i);
      const logDate = dateVal.toISOString().split("T")[0];

      // Random temperature between 1.5°C and 4.2°C (perfect cold storage compliance range)
      const coldStorageTempCelsius = Math.round((1.5 + Math.random() * 2.7) * 10) / 10;

      // Select 2-3 random batch deliveries for this day
      const dailyDeliveries = [];
      const numDeliveries = 2 + Math.floor(Math.random() * 2); // 2 or 3
      const shuffled = [...batchTemplates].sort(() => 0.5 - Math.random());
      
      for (let j = 0; j < numDeliveries; j++) {
        const t = shuffled[j];
        if (!t) continue;
        const harvestDateVal = new Date(dateVal);
        harvestDateVal.setUTCDate(dateVal.getUTCDate() - 1 - Math.floor(Math.random() * 2));
        
        dailyDeliveries.push({
          product: t.product,
          farmOrigin: t.farmOrigin,
          batchCode: `${t.prefix}-${logDate.replace(/-/g, "")}-${100 + Math.floor(Math.random() * 900)}`,
          harvestDate: harvestDateVal.toISOString().split("T")[0],
        });
      }

      rows.push({
        logDate,
        coldStorageTempCelsius,
        hygieneConfirmed: true,
        deliveryBatches: dailyDeliveries,
      });
    }

    await db.insert(complianceLogsTable).values(rows);
    logger.info("Successfully seeded 30 days of compliance logs!");
  } catch (err) {
    logger.error({ err }, "seedComplianceLogsIfEmpty failed");
  }
}
