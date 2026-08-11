/**
 * Unpause the entire menu — owner directive 2026-08-11.
 *
 * Production had 76 of 145 menu_items rows with is_available = false (52% of
 * the catalogue unbuyable, every card reading "Back soon — kitchen has paused
 * this dish"), all with unavailable_reason NULL — i.e. no operator recorded a
 * reason; the flags were left behind by POS stock-sync webhooks
 * (integrations/petpooja item_stock / item_stock_off) with no auto-turn-on
 * ever applied.
 *
 * Sets is_available = true and clears unavailable_reason / unavailable_until
 * on every paused row. Dry-run by default; pass --apply to write. The
 * api-server's merged-catalog cache (30s TTL) picks the change up on its own.
 *
 * Run:  DATABASE_URL=... pnpm --filter @workspace/scripts run unpause-menu [--apply]
 * Or:   the "Unpause Menu" workflow (.github/workflows/unpause-menu.yml).
 */
import { db, menuItemsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const APPLY = process.argv.includes("--apply");

async function main() {
  const paused = await db
    .select({
      slug: menuItemsTable.slug,
      name: menuItemsTable.name,
      unavailableReason: menuItemsTable.unavailableReason,
    })
    .from(menuItemsTable)
    .where(eq(menuItemsTable.isAvailable, false));

  const total = (await db.select({ slug: menuItemsTable.slug }).from(menuItemsTable)).length;
  console.log(`menu_items: ${total} rows, ${paused.length} paused${APPLY ? "" : " (dry-run — pass --apply to write)"}`);

  if (paused.length === 0) {
    console.log("Nothing to unpause.");
    return;
  }

  for (const p of paused) {
    console.log(`  paused: ${p.slug}${p.unavailableReason ? ` (reason: ${p.unavailableReason})` : ""}`);
  }

  if (!APPLY) return;

  await db
    .update(menuItemsTable)
    .set({
      isAvailable: true,
      unavailableReason: null,
      unavailableUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(menuItemsTable.isAvailable, false));

  console.log(`Unpaused ${paused.length} dishes. The api-server's 30s catalog cache refreshes itself.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("unpause-menu failed:", (err as Error).message);
    process.exit(1);
  });
