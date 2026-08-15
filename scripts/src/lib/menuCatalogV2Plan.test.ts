/**
 * TNM-MENU-01 M-3 — plan-engine contract tests (pure; no DB, no filesystem).
 *
 * Pins the §8 availability mapping, Law-8 gating, payload-claim precedence
 * over the disable set, merge-source archival, the non-integer-price abort,
 * idempotency (a plan applied to its own post-state plans zero), and the
 * slugify lockstep with the petpooja mapper.
 *
 * Run with:
 *   node --test --import tsx ./src/lib/menuCatalogV2Plan.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildPlan,
  parseCsv,
  slugify,
  verifyPostState,
  type DbMenuRow,
  type PayloadRow,
  type Plan,
  type RationalizationRow,
  type SlugMapRow,
} from "./menuCatalogV2Plan";

// ---------------------------------------------------------------------------
// Fixtures — a miniature but structurally complete program input.

function payloadRow(overrides: Partial<PayloadRow>): PayloadRow {
  return {
    sectionOrder: 1,
    section: "High-Protein Meals",
    itemRank: 1,
    displayName: "Grilled Chicken with Veggies & Mash",
    mapsFrom: ["Grilled Chicken With Sautéed Vegetable And Mash Potato High Protein"],
    veg: "non-veg",
    priceInr: 299,
    badge: "Bestseller",
    flags: [],
    ...overrides,
  };
}

function dbRow(overrides: Partial<DbMenuRow> & { slug: string }): DbMenuRow {
  return {
    name: overrides.slug,
    pricePaise: 10_000,
    isVeg: true,
    isAvailable: true,
    archived: false,
    sectionOrder: null,
    sortRank: null,
    vegClass: null,
    badge: null,
    unavailableReason: null,
    hasMacros: true,
    ...overrides,
  };
}

const HERO = payloadRow({});
const HERO_SLUG = "grilled-chicken-sauteed-veg-mash-potato";

const BOWL = payloadRow({
  sectionOrder: 2,
  section: "Bowls",
  itemRank: 1,
  displayName: "Chicken Burrito Bowl — choose your sauce",
  mapsFrom: [
    "Barbeque Grilled Chicken Rice Bowl",
    "Chipotle Grilled Chicken Rice Bowl",
  ],
  veg: "non-veg",
  priceInr: 299,
  badge: null,
  flags: ["sauce-chooser"],
});
const BOWL_SLUG = "barbeque-grilled-chicken-rice-bowl";
const BOWL_MERGE_SOURCE = "chipotle-grilled-chicken-rice-bowl";

const WOK = payloadRow({
  sectionOrder: 13,
  section: "Off the Wok",
  itemRank: 1,
  displayName: "Chilli Paneer — Dry Tossed",
  mapsFrom: [],
  veg: "veg",
  priceInr: 199,
  badge: "New",
  flags: ["needs-macros", "needs-cogs", "no-plan-pool", "no-personalization-boost"],
});

const SLUG_MAP: SlugMapRow[] = [
  { section: HERO.section, displayName: HERO.displayName, liveSlug: HERO_SLUG, status: "MATCH" },
  { section: BOWL.section, displayName: BOWL.displayName, liveSlug: BOWL_SLUG, status: "MATCH" },
  { section: WOK.section, displayName: WOK.displayName, liveSlug: null, status: "NEW" },
];

const RATIONALIZATION: RationalizationRow[] = [
  // CUT, unclaimed → archived.
  { dish: "Cheesy Delight Nachos", action: "CUT", code: "OB" },
  // SEASONAL, unclaimed → unavailable, NOT archived.
  { dish: "Broccoli Almond Soup", action: "SEASONAL", code: "SE" },
  // SEASONAL but payload-claimed (via maps_from) → the payload wins, no action.
  { dish: "Chipotle Grilled Chicken Rice Bowl", action: "SEASONAL", code: "SE" },
  // KEEP not claimed by any payload row → stop-and-ask report, untouched.
  { dish: "Mushroom Omelette (2 Egg)", action: "KEEP-B", code: "B" },
  // CUT resolving to no DB row → informational.
  { dish: "Mutton Paya", action: "CUT", code: "CB" },
];

const DB: DbMenuRow[] = [
  dbRow({ slug: HERO_SLUG, name: "Grilled Chicken With Sautéed Vegetable And Mash Potato High Protein", pricePaise: 33_300, isVeg: false }),
  dbRow({ slug: BOWL_SLUG, name: "Barbeque Grilled Chicken Rice Bowl", pricePaise: 35_100, isVeg: false }),
  dbRow({ slug: BOWL_MERGE_SOURCE, name: "Chipotle Grilled Chicken Rice Bowl", pricePaise: 34_600, isVeg: false }),
  dbRow({ slug: "cheesy-delight-nachos", name: "Cheesy Delight Nachos" }),
  dbRow({ slug: "broccoli-almond-soup", name: "Broccoli Almond Soup" }),
  dbRow({ slug: "mushroom-omelette-2-egg", name: "Mushroom Omelette (2 Egg)" }),
];

function plan(overrides?: {
  payload?: PayloadRow[];
  dbRows?: DbMenuRow[];
  rationalization?: RationalizationRow[];
}): Plan {
  return buildPlan({
    payload: overrides?.payload ?? [HERO, BOWL, WOK],
    slugMap: SLUG_MAP,
    rationalization: overrides?.rationalization ?? RATIONALIZATION,
    dbRows: overrides?.dbRows ?? DB,
  });
}

/** Apply a plan to a row set in memory — the test's model of the CLI's
 * transaction, used to prove idempotency without a database. */
function applyInMemory(p: Plan, rows: DbMenuRow[]): DbMenuRow[] {
  const bySlug = new Map(rows.map((r) => [r.slug, { ...r }]));
  for (const a of p.actions) {
    if (a.kind === "create") {
      bySlug.set(a.slug, {
        slug: a.slug,
        name: a.values.name,
        pricePaise: a.values.pricePaise,
        isVeg: a.values.isVeg,
        isAvailable: a.values.isAvailable,
        archived: false,
        sectionOrder: a.values.sectionOrder,
        sortRank: a.values.sortRank,
        vegClass: a.values.vegClass,
        badge: a.values.badge,
        unavailableReason: a.values.unavailableReason,
        hasMacros: false,
      });
    } else if (a.kind === "update") {
      Object.assign(bySlug.get(a.slug)!, a.diff);
    } else if (a.kind === "archive") {
      Object.assign(bySlug.get(a.slug)!, {
        archived: true,
        isAvailable: false,
        unavailableReason: a.note,
      });
    } else {
      Object.assign(bySlug.get(a.slug)!, {
        isAvailable: false,
        unavailableReason: a.note,
      });
    }
  }
  return [...bySlug.values()];
}

// ---------------------------------------------------------------------------

test("slugify stays in lockstep with the petpooja mapper", () => {
  // Pinned pairs produced by artifacts/api-server/src/lib/petpooja.ts::slugify.
  assert.equal(slugify("Boiled Chicken Breast [Single Serve]"), "boiled-chicken-breast-single-serve");
  assert.equal(slugify("Boiled 3 Egg With Sautéed Veggies"), "boiled-3-egg-with-saut-ed-veggies");
  assert.equal(slugify("Hot N Sour Soup (Veg)"), "hot-n-sour-soup-veg");
});

test("a MATCH row plans rename, reprice (integer paise), section, rank, veg class and badge", () => {
  const p = plan();
  const update = p.actions.find((a) => a.kind === "update" && a.slug === HERO_SLUG);
  assert.ok(update && update.kind === "update");
  assert.equal(update.diff.name, HERO.displayName);
  assert.equal(update.diff.pricePaise, 29_900);
  assert.equal(update.diff.sectionOrder, 1);
  assert.equal(update.diff.sortRank, 1);
  assert.equal(update.diff.vegClass, "non-veg");
  assert.equal(update.diff.badge, "Bestseller");
  // isVeg was already false — the diff must not carry an unchanged field.
  assert.ok(!("isVeg" in update.diff), "unchanged fields stay out of the diff");
  assert.equal(p.blockers.length, 0);
});

test("a NEW row plans a create that is Law-8 gated (unavailable until M-6)", () => {
  const p = plan();
  const create = p.actions.find((a) => a.kind === "create");
  assert.ok(create && create.kind === "create");
  assert.equal(create.slug, "chilli-paneer-dry-tossed");
  assert.equal(create.values.pricePaise, 19_900);
  assert.equal(create.values.isAvailable, false);
  assert.match(create.values.unavailableReason, /M-6/);
});

test("a needs-macros flag gates an existing row even when the DB row has macros", () => {
  const gated = payloadRow({ flags: ["needs-macros"] });
  const p = plan({ payload: [gated, BOWL, WOK] });
  const update = p.actions.find((a) => a.kind === "update" && a.slug === HERO_SLUG);
  assert.ok(update && update.kind === "update");
  assert.equal(update.diff.isAvailable, false);
});

test("a macro-less existing row plans to unavailable (Law 8), not to available", () => {
  const db = DB.map((r) => (r.slug === HERO_SLUG ? { ...r, hasMacros: false } : r));
  const p = plan({ dbRows: db });
  const update = p.actions.find((a) => a.kind === "update" && a.slug === HERO_SLUG);
  assert.ok(update && update.kind === "update");
  assert.equal(update.diff.isAvailable, false);
  assert.match(String(update.diff.unavailableReason), /M-6/);
});

test("non-target maps_from identities are archived as merge-sources", () => {
  const p = plan();
  const archive = p.actions.find(
    (a) => a.kind === "archive" && a.slug === BOWL_MERGE_SOURCE,
  );
  assert.ok(archive && archive.kind === "archive");
  assert.equal(archive.reason, "merge-source");
  assert.equal(archive.into, BOWL_SLUG);
});

test("the disable set archives unclaimed CUT rows, parks SEASONAL without archiving, and defers to the payload on claimed rows", () => {
  const p = plan();
  const cut = p.actions.find((a) => a.kind === "archive" && a.slug === "cheesy-delight-nachos");
  assert.ok(cut, "unclaimed CUT row must archive");

  const seasonal = p.actions.find((a) => a.kind === "seasonal" && a.slug === "broccoli-almond-soup");
  assert.ok(seasonal, "unclaimed SEASONAL row must park, not archive");

  // Chipotle bowl is SEASONAL-coded in the fixture but payload-claimed via
  // maps_from — the only action on it must be the merge-source archive, not a
  // rationalization action.
  const rationalized = p.actions.filter(
    (a) => a.kind === "archive" && a.slug === BOWL_MERGE_SOURCE && a.reason === "rationalized",
  );
  assert.equal(rationalized.length, 0);

  assert.deepEqual(p.reports.unresolvedRationalization, ["Mutton Paya [CUT]"]);
});

test("KEEP rows the payload does not claim are reported as stop-and-ask and left untouched", () => {
  const p = plan();
  assert.deepEqual(p.reports.ungovernedKeeps, ["Mushroom Omelette (2 Egg) [KEEP-B]"]);
  assert.ok(!p.actions.some((a) => a.slug === "mushroom-omelette-2-egg"));
});

test("a non-integer rupee price is a blocker", () => {
  const bad = payloadRow({ priceInr: 298.5 });
  const p = plan({ payload: [bad, BOWL, WOK] });
  assert.ok(p.blockers.some((b) => b.includes("not a positive integer")));
});

test("a MATCH row missing from the DB is a blocker, never an improvised create", () => {
  const db = DB.filter((r) => r.slug !== HERO_SLUG);
  const p = plan({ dbRows: db });
  assert.ok(p.reports.missingExpected.some((m) => m.includes(HERO_SLUG)));
  assert.ok(p.blockers.some((b) => b.includes("missing from the database")));
  assert.ok(!p.actions.some((a) => a.kind === "create" && a.slug === HERO_SLUG));
});

test("idempotency: the plan applied to its own post-state plans zero actions", () => {
  const first = plan();
  assert.equal(first.blockers.length, 0);
  const post = applyInMemory(first, DB);
  const second = plan({ dbRows: post });
  assert.deepEqual(
    second.actions,
    [],
    `second plan must be empty, got: ${second.actions.map((a) => `${a.kind}:${a.slug}`).join(", ")}`,
  );
  assert.equal(second.expectedChecksum, first.expectedChecksum);
});

test("§7 verification catches fried-set names, Detox, internal tags and Law-8 breaches on active rows only", () => {
  const rows: DbMenuRow[] = [
    dbRow({ slug: "veg-manchurian", name: "Veg Manchurian Gravy" }), // active fried
    dbRow({ slug: "chia-detox", name: "Chia Lemonade Detox" }), // active detox
    dbRow({ slug: "tagged", name: "Plain Omelette (O)" }), // internal tag
    dbRow({ slug: "no-macros", name: "Fine Dish", hasMacros: false }), // Law 8
    dbRow({ slug: "parked-fried", name: "Chicken 65", isAvailable: false, archived: true }), // inactive → ignored
  ];
  const v = verifyPostState(rows);
  assert.equal(v.ok, false);
  assert.equal(v.violations.length, 4);
  assert.ok(!v.violations.some((x) => x.includes("parked-fried")));
});

test("CSV parser handles quoted fields with embedded commas and doubled quotes", () => {
  const rows = parseCsv('a,b,c\r\n1,"x, y","he said ""hi"""\n');
  assert.deepEqual(rows, [
    ["a", "b", "c"],
    ["1", "x, y", 'he said "hi"'],
  ]);
});
