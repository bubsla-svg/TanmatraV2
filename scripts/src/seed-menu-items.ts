import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { db, menuItemsTable } from "@workspace/db";
import { DISHES } from "@workspace/menu-catalog";
import { sql } from "drizzle-orm";

const APPLY = process.argv.includes("--apply");

// Sheet-only fields (goal tags, meal timing) come from the RD-verified master
// sheet — the catalog seed (DISHES) doesn't carry them. Joined by dish name.
interface SheetDish {
  name: string;
  goalTags: string[];
  mealTiming: string;
}
function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
/** Map the sheet's free-text meal timing onto the availability_window enum. */
function availabilityWindow(mealTiming: string): string[] | null {
  const t = (mealTiming || "").toLowerCase();
  if (t.includes("breakfast")) return ["breakfast"];
  if (t.includes("lunch") && t.includes("dinner")) return ["lunch", "dinner"];
  if (t.includes("lunch")) return ["lunch"];
  if (t.includes("dinner")) return ["dinner"];
  if (t.includes("snack") || t.includes("beverage") || t.includes("anytime"))
    return ["all_day"];
  return null;
}
const sheetByName: Map<string, SheetDish> = (() => {
  const path = resolve(process.cwd(), "data", "kitchen-data-collection.json");
  const parsed = JSON.parse(readFileSync(path, "utf8")) as { dishes: SheetDish[] };
  return new Map(parsed.dishes.map((d) => [normName(d.name), d]));
})();

async function main() {
  console.log(
    `Seeding ${DISHES.length} dishes into menu_items${APPLY ? "" : " (dry-run)"}...`,
  );

  let inserted = 0;
  let updated = 0;
  let taggedFromSheet = 0;

  for (const d of DISHES) {
    const sheet = sheetByName.get(normName(d.name));
    const tags = sheet && sheet.goalTags.length > 0 ? sheet.goalTags : null;
    const availWindow = sheet ? availabilityWindow(sheet.mealTiming) : null;
    if (tags) taggedFromSheet++;

    const values = {
      slug: d.slug,
      name: d.name,
      description: d.description,
      pricePaise: d.price,
      category: d.category,
      kitchenLocation: d.kitchen,
      isVeg: d.isVeg,
      isAvailable: d.isAvailable,
      imageUrl: d.image,
      longDescription: d.longDescription,
      allergens: d.allergens.length > 0 ? d.allergens : null,
      // Goal tags (LOW SODIUM, HIGH PROTEIN, LOW GI, …) and meal timing come
      // from the master sheet — the CMS panel exposes both as editable fields.
      tags,
      availabilityWindow: availWindow,
      macros: {
        kcal: d.macros.calories,
        proteinG: d.macros.protein,
        carbsG: d.macros.carbs,
        fatG: d.macros.fat,
        fiberG: d.macros.fiber,
      },
      macrosAreEstimate: false,
      rdVerified: d.rdVerified,
      rdNote: d.rdNote ?? null,
      prepTime: d.prepTime,
      glycaemicIndex: d.glycaemicIndex,
      sugarPerServing: d.sugarPerServing,
      ingredients: d.ingredients.length > 0 ? d.ingredients : null,
      customizations:
        d.customizations.length > 0 ? d.customizations : null,
      pairingSlug: d.pairingSlug ?? null,
      allergenReviewState: "reviewed",
    } as const;

    if (!APPLY) continue; // dry-run: build/validate values but write nothing

    const result = await db
      .insert(menuItemsTable)
      .values(values)
      .onConflictDoUpdate({
        target: menuItemsTable.slug,
        // Refresh fields that haven't been edited in CMS. We keep editor-managed
        // fields like name/description/price as-is on conflict, and only update
        // the static-only fields (kitchen, category, isVeg) plus macros if they
        // were never set by the editor (macrosAreEstimate=true means default).
        set: {
          category: sql`excluded.category`,
          kitchenLocation: sql`excluded.kitchen_location`,
          isVeg: sql`excluded.is_veg`,
          longDescription: sql`coalesce(${menuItemsTable.longDescription}, excluded.long_description)`,
          allergens: sql`coalesce(${menuItemsTable.allergens}, excluded.allergens)`,
          // Sheet-derived; fill only when the editor hasn't set them.
          tags: sql`coalesce(${menuItemsTable.tags}, excluded.tags)`,
          availabilityWindow: sql`coalesce(${menuItemsTable.availabilityWindow}, excluded.availability_window)`,
          imageUrl: sql`coalesce(${menuItemsTable.imageUrl}, excluded.image_url)`,
          rdVerified: sql`excluded.rd_verified`,
          rdNote: sql`coalesce(${menuItemsTable.rdNote}, excluded.rd_note)`,
          prepTime: sql`coalesce(${menuItemsTable.prepTime}, excluded.prep_time)`,
          glycaemicIndex: sql`coalesce(${menuItemsTable.glycaemicIndex}, excluded.glycaemic_index)`,
          sugarPerServing: sql`coalesce(${menuItemsTable.sugarPerServing}, excluded.sugar_per_serving)`,
          ingredients: sql`coalesce(${menuItemsTable.ingredients}, excluded.ingredients)`,
          customizations: sql`coalesce(${menuItemsTable.customizations}, excluded.customizations)`,
          pairingSlug: sql`coalesce(${menuItemsTable.pairingSlug}, excluded.pairing_slug)`,
          macros: sql`case when ${menuItemsTable.macros} is null then excluded.macros when (${menuItemsTable.macros} ? 'fiberG') then ${menuItemsTable.macros} else ${menuItemsTable.macros} || jsonb_build_object('fiberG', excluded.macros->'fiberG') end`,
          allergenReviewState: sql`excluded.allergen_review_state`,
        },
      })
      .returning({ id: menuItemsTable.id, createdAt: menuItemsTable.createdAt });

    const row = result[0];
    if (!row) continue;
    // Heuristic: if createdAt is recent (within last few seconds), it was just inserted.
    if (Date.now() - new Date(row.createdAt).getTime() < 5000) {
      inserted++;
    } else {
      updated++;
    }
  }

  if (!APPLY) {
    console.log(
      `Dry-run: ${DISHES.length} dishes prepared, ${taggedFromSheet} carry goal tags from the sheet. Pass --apply to write.`,
    );
    process.exit(0);
  }
  console.log(
    `Seed complete: ${inserted} inserted, ${updated} refreshed (${taggedFromSheet} tagged from sheet).`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
