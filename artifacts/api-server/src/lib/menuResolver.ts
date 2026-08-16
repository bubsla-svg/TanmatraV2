import {
  DISHES,
  type DishData,
  type DishCategory,
  type DishKitchen,
  type DishCustomGroup,
} from "@workspace/menu-catalog";
import { listMenuItems, type DbReadExecutor } from "./menu";
import { getSummariesForSlugs } from "./dishReviews";
import { getCachedOrFetch } from "./menuCatalogCache";
import { resolveAllergensReviewed } from "./allergenReview";
import {
  resolveMacrosEstimated,
  resolveMacrosProvisional,
} from "./macroProvenance";

const VALID_CATEGORIES = new Set<DishCategory>([
  "beverages",
  "breakfast",
  "salads",
  "soups",
  "pasta",
  "wraps",
  "bowls",
  "snacks",
  "mains",
]);
const VALID_KITCHENS = new Set<DishKitchen>([
  "continental",
  "indian",
  "asian",
  "mediterranean",
]);
const VALID_GI = new Set<DishData["glycaemicIndex"]>(["low", "medium", "high"]);

function coerceGi(v: string | null): DishData["glycaemicIndex"] | null {
  return v && VALID_GI.has(v as DishData["glycaemicIndex"])
    ? (v as DishData["glycaemicIndex"])
    : null;
}

const SYNTHETIC_ID_OFFSET = 100000;

export function syntheticIdFor(dbRowId: number): number {
  return SYNTHETIC_ID_OFFSET + dbRowId;
}

/** Build the merged DB-backed catalog: static DISHES with editable DB fields
 * (price, name, description, image, isAvailable, macros, etc.) overridden by
 * matching menu_items rows. CMS-only rows (no static counterpart) get
 * synthetic ids in the SYNTHETIC_ID_OFFSET+ range.
 *
 * Cached (30s TTL, single-flight) when called with no executor — the
 * overwhelming majority of call sites. A caller that passes a transaction
 * executor (e.g. loyaltyEngine.ts reading through `tx` for read-your-writes
 * consistency inside a transaction) bypasses the cache entirely, since that
 * usage is specifically about seeing uncommitted writes from earlier in the
 * same transaction — a cached snapshot would defeat the purpose. */
export async function getMergedCatalog(
  executor?: DbReadExecutor,
): Promise<DishData[]> {
  if (executor) return fetchMergedCatalog(executor);
  return getCachedOrFetch(() => fetchMergedCatalog());
}

async function fetchMergedCatalog(
  executor?: DbReadExecutor,
): Promise<DishData[]> {
  const dbRows = await listMenuItems({}, executor);
  const dbBySlug = new Map(dbRows.map((r) => [r.slug, r]));
  const allSlugs = Array.from(
    new Set([...DISHES.map((d) => d.slug), ...dbRows.map((r) => r.slug)]),
  );
  const summaries = await getSummariesForSlugs(allSlugs);
  const enrich = (dish: DishData): DishData => {
    const s = summaries.get(dish.slug);
    if (!s) return dish;
    return {
      ...dish,
      averageRating: s.averageRating / 10,
      reviewCount: s.sampleSize,
    };
  };
  const merged: DishData[] = [];
  const usedSlugs = new Set<string>();

  for (const stat of DISHES) {
    const row = dbBySlug.get(stat.slug);
    usedSlugs.add(stat.slug);
    if (!row) {
      merged.push(stat);
      continue;
    }
    const gi = coerceGi(row.glycaemicIndex);
    const reviewState = coerceReviewState(row.allergenReviewState);
    merged.push({
      ...stat,
      name: row.name || stat.name,
      description: row.description || stat.description,
      longDescription: row.longDescription ?? stat.longDescription,
      image: row.imageUrl ?? stat.image,
      price: row.pricePaise,
      isAvailable: row.isAvailable,
      isVeg: row.isVeg,
      category: VALID_CATEGORIES.has(row.category as DishCategory)
        ? (row.category as DishCategory)
        : stat.category,
      kitchen: VALID_KITCHENS.has(row.kitchenLocation as DishKitchen)
        ? (row.kitchenLocation as DishKitchen)
        : stat.kitchen,
      allergens: row.allergens ?? stat.allergens,
      contraindications: row.contraindications ?? stat.contraindications ?? [],
      macros: row.macros
        ? {
            calories: row.macros.kcal,
            protein: row.macros.proteinG,
            carbs: row.macros.carbsG,
            fat: row.macros.fatG,
            fiber: row.macros.fiberG ?? stat.macros.fiber,
          }
        : stat.macros,
      // A MACRO AND ITS TRUST FLAG MUST TRAVEL TOGETHER (flipbook F-1).
      //
      // `...stat` above carries the static catalog's `macrosEstimated` —
      // which describes the STATIC numbers. When the DB row supplies its own
      // macros they win the line above, and without this the payload shipped
      // the DB's number wearing the static catalog's flag. Two ways that goes
      // wrong, both live:
      //
      //   - Static `diet-coke-can` is 0/0/0/0 (correct — it is a zero-calorie
      //     soda) and `macrosEstimated: true`. The DB row supplies 140 kcal /
      //     3 g P, so the card rendered "≈140 kcal · ≈3 g P": a fabricated
      //     number carrying a marker that claims we computed it from THIS
      //     dish's recipe.
      //   - 11 static dishes carry curated distinct macros and therefore
      //     `macrosEstimated: false`. A DB row with a placeholder macro on
      //     one of those renders the placeholder as PLAIN FACT, with no
      //     marker at all — the "Boiled Egg, 460 kcal · 28 g P, unflagged"
      //     case the review found most alarming.
      //
      // So when the row owns the numbers it owns the claim: `macros_are_estimate`
      // (schema default TRUE, i.e. fail-soft toward "estimated") decides.
      macrosEstimated: resolveMacrosEstimated({
        rowHasMacros: row.macros != null,
        rowMacrosAreEstimate: row.macrosAreEstimate,
        staticMacrosEstimated: stat.macrosEstimated,
      }),
      // Deliberately NOT re-derived from the row: there is no DB column for
      // it, and `macrosProvisional` is the strongest gate (renders no numbers
      // at all). Inheriting the static value keeps it sticky — a DB row can
      // never LOOSEN a gate the catalog already applied.
      macrosProvisional: resolveMacrosProvisional(stat.macrosProvisional),
      rdVerified: row.rdVerified,
      ...(row.rdNote ? { rdNote: row.rdNote } : {}),
      prepTime: row.prepTime ?? "",
      glycaemicIndex: gi ?? "medium",
      sugarPerServing: row.sugarPerServing ?? "",
      ingredients: row.ingredients ?? [],
      customizations:
        (row.customizations as DishCustomGroup[] | null) ?? [],
      ...(row.pairingSlug ? { pairingSlug: row.pairingSlug } : {}),
      rdReviewState: reviewState,
      // The DB review state is the RD's explicit verdict on this dish's
      // allergen disclosure, so a "reviewed" row must supersede the static
      // seed's fail-closed `allergensReviewed: false` (stamped by
      // _deriveAllergens when the seed had no curated list and an ingredient
      // it couldn't classify). Without this override the strict checkout gate
      // 422s `unchecked_allergens` on dishes the RD has already cleared —
      // the "Safety block / Retry pricing" dead-end on /checkout.
      allergensReviewed: resolveAllergensReviewed(
        stat.allergensReviewed,
        reviewState,
      ),
      ...(row.sectionOrder != null ? { sectionOrder: row.sectionOrder } : {}),
      ...(row.sortRank != null ? { sortRank: row.sortRank } : {}),
      ...(row.vegClass ? { vegClass: row.vegClass } : {}),
      ...(row.badge ? { badge: row.badge } : {}),
      archived: row.archived,
    });
  }

  for (const row of dbRows) {
    if (usedSlugs.has(row.slug)) continue;
    const cat = VALID_CATEGORIES.has(row.category as DishCategory)
      ? (row.category as DishCategory)
      : "mains";
    const kit = VALID_KITCHENS.has(row.kitchenLocation as DishKitchen)
      ? (row.kitchenLocation as DishKitchen)
      : "continental";
    const gi = coerceGi(row.glycaemicIndex);
    merged.push({
      id: syntheticIdFor(row.id),
      slug: row.slug,
      name: row.name,
      description: row.description ?? "",
      longDescription: row.longDescription ?? "",
      image:
        row.imageUrl ??
        "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80",
      price: row.pricePaise,
      kitchen: kit,
      category: cat,
      isVeg: row.isVeg,
      rdVerified: row.rdVerified,
      ...(row.rdNote ? { rdNote: row.rdNote } : {}),
      prepTime: row.prepTime ?? "—",
      macros: row.macros
        ? {
            calories: row.macros.kcal,
            protein: row.macros.proteinG,
            carbs: row.macros.carbsG,
            fat: row.macros.fatG,
            fiber: row.macros.fiberG ?? 0,
          }
        : { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      // Same rule as the merge branch above, and it matters MORE here: this
      // is a dish with no static counterpart (a Petpooja import or a CMS
      // creation), so there is no curated macro anywhere behind it. Without
      // this the field was simply absent — falsy — and the card rendered a
      // POS-supplied macro as plain unqualified fact. The all-zero fallback
      // below is already gated downstream (`macroTrust` treats 0 kcal as
      // unverified), so this is specifically about rows that DO carry numbers.
      macrosEstimated: resolveMacrosEstimated({
        rowHasMacros: row.macros != null,
        rowMacrosAreEstimate: row.macrosAreEstimate,
        staticMacrosEstimated: undefined,
      }),
      ingredients: row.ingredients ?? [],
      allergens: row.allergens ?? [],
      contraindications: row.contraindications ?? [],
      glycaemicIndex: gi ?? "medium",
      sugarPerServing: row.sugarPerServing ?? "—",
      customizations:
        (row.customizations as DishCustomGroup[] | null) ?? [],
      ...(row.pairingSlug ? { pairingSlug: row.pairingSlug } : {}),
      isAvailable: row.isAvailable,
      rdReviewState: coerceReviewState(row.allergenReviewState),
      ...(row.sectionOrder != null ? { sectionOrder: row.sectionOrder } : {}),
      ...(row.sortRank != null ? { sortRank: row.sortRank } : {}),
      ...(row.vegClass ? { vegClass: row.vegClass } : {}),
      ...(row.badge ? { badge: row.badge } : {}),
      archived: row.archived,
    });
  }
  // Archived rows (M-3 CUT/MERGE/DELIST) stay in the merged catalog here —
  // this function backs checkout, subscriptions, meal planning and loyalty
  // in addition to menu display, and those need to keep resolving dishes a
  // customer already committed to. Customer-facing menu LISTINGS exclude
  // `archived` at the route layer instead (see /menu/public, /menu/ranked).
  return merged.map(enrich);
}

const REVIEW_STATES = new Set(["pending_review", "reviewed", "blocked"]);
/**
 * Map a raw `allergen_review_state` value to a known state. Unknown or
 * malformed values fail CLOSED to `pending_review` — never silently
 * fall through to `reviewed`. The DB CHECK constraint should make this
 * unreachable in production, but the coercion is the defense-in-depth
 * layer.
 */
function coerceReviewState(
  v: string | null | undefined,
): "pending_review" | "reviewed" | "blocked" {
  return v && REVIEW_STATES.has(v)
    ? (v as "pending_review" | "reviewed" | "blocked")
    : "pending_review";
}

/** Lookup a dish by its catalog id (static id 1..N or synthetic id 100000+).
 * Always reflects current DB state. */
export async function resolveDishById(
  id: number,
): Promise<DishData | undefined> {
  const merged = await getMergedCatalog();
  return merged.find((d) => d.id === id);
}

/** Lookup a dish by slug. Always reflects current DB state. */
export async function resolveDishBySlug(
  slug: string,
): Promise<DishData | undefined> {
  const merged = await getMergedCatalog();
  return merged.find((d) => d.slug === slug);
}

/** Build a single-shot resolver that fetches the merged catalog once and
 * answers many lookups against the in-memory snapshot. Use this in any
 * server flow that needs to resolve multiple dishes in a tight loop
 * (e.g. checkout finalize, bundle expansion) to avoid N round-trips. */
export async function makeBatchDishResolver(
  executor?: DbReadExecutor,
): Promise<{
  byId: (id: number) => DishData | undefined;
  bySlug: (slug: string) => DishData | undefined;
  all: DishData[];
}> {
  const merged = await getMergedCatalog(executor);
  const byIdMap = new Map(merged.map((d) => [d.id, d]));
  const bySlugMap = new Map(merged.map((d) => [d.slug, d]));
  return {
    byId: (id) => byIdMap.get(id),
    bySlug: (slug) => bySlugMap.get(slug),
    all: merged,
  };
}
