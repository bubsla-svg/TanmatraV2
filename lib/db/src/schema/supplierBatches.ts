import {
  date,
  index,
  numeric,
  pgTable,
  serial,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

// Traceability record for a physical supplier delivery crate. Written when a
// vendor logs a delivery batch (/ops/supplier/deliver) and later updated to
// `received` when the receiving clerk scans the crate in (/ops/supplier/intake).
// Persists the ISO audit-trail fields (farm origin, harvest date, batch code)
// that were previously only echoed back to the client and dropped on intake.
export const supplierBatchesTable = pgTable(
  "supplier_batches",
  {
    id: serial("id").primaryKey(),
    product: varchar("product", { length: 256 }).notNull(),
    farmOrigin: varchar("farm_origin", { length: 512 }).notNull(),
    harvestDate: date("harvest_date").notNull(),
    batchCode: varchar("batch_code", { length: 128 }).notNull(),
    quantity: numeric("quantity", {
      precision: 12,
      scale: 3,
      mode: "number",
    }).notNull(),
    barcodeToken: varchar("barcode_token", { length: 128 }).notNull().unique(),
    status: varchar("status", { length: 32 }).notNull().default("delivered"),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_supplier_batches_status").on(table.status),
    index("idx_supplier_batches_created").on(table.createdAt),
  ],
);

export type SupplierBatch = typeof supplierBatchesTable.$inferSelect;
export type InsertSupplierBatch = typeof supplierBatchesTable.$inferInsert;
