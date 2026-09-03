import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { DISHES } from "@workspace/menu-catalog";
import { addLine, EMPTY_CART, parseStoredCart, type CartLine } from "./cartStore";
import { formatMacroLine, MACROS_PENDING_LABEL } from "./format";

/**
 * Law 8, carried the last two screens.
 *
 * The macro snapshot on a cart line is captured at add-time and never
 * re-derived — that is deliberate (the cart must not depend on a live catalog
 * fetch to render). The consequence is that anything the snapshot drops is
 * gone: the cart drawer and the checkout review have no way back to the dish
 * to ask again.
 *
 * `CartLineMacros` carried `estimated` but not `provisional`, so a dish whose
 * numbers the menu had already stopped asserting ("Nutrition being verified")
 * re-acquired confident figures the moment it entered the cart — and kept them
 * through the checkout review, the screen immediately before payment.
 *
 * Three links have to hold for the flag to reach the reader, and none of them
 * is type-checked: the capture sites must record it, storage must round-trip
 * it, and the render sites must forward it. Both `formatMacroLine` provenance
 * params are optional booleans, so dropping one compiles clean.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COMPONENTS = path.join(HERE, "..", "components");

function provisionalDish() {
  const dish = DISHES.find((d) => d.macrosProvisional);
  assert.ok(dish, "no provisional dish in the catalog to exercise the cart path with");
  return dish;
}

test("a provisional line renders the pending label, not its snapshot numbers", () => {
  const dish = provisionalDish();
  const line: Omit<CartLine, "qty"> = {
    dishId: 1,
    kind: "dish",
    slug: dish.slug,
    name: dish.name,
    pricePaise: dish.price,
    macros: {
      calories: dish.macros.calories,
      protein: dish.macros.protein,
      estimated: dish.macrosEstimated,
      provisional: dish.macrosProvisional,
    },
  };
  const cart = addLine(EMPTY_CART, line);
  const stored = cart.lines[0];
  assert.ok(stored?.macros);
  const rendered = formatMacroLine(stored.macros, stored.macros.estimated, stored.macros.provisional);
  assert.equal(rendered, MACROS_PENDING_LABEL);
  assert.doesNotMatch(rendered, /\d/, "no placeholder figure may survive into the cart");
});

test("provenance survives the storage round-trip", () => {
  // The cart persists across navigation and reload (STORAGE_KEY
  // "storefront:cart:v1"). A flag that is captured but not re-parsed is the
  // same bug one refresh later, and harder to see.
  const cart = {
    lines: [
      {
        dishId: 1,
        kind: "dish" as const,
        slug: "x",
        name: "X",
        pricePaise: 100,
        qty: 1,
        macros: { calories: 240, protein: 4, provisional: true },
      },
    ],
  };
  const reloaded = parseStoredCart(JSON.stringify(cart));
  assert.equal(reloaded.lines.length, 1);
  assert.equal(reloaded.lines[0]?.macros?.provisional, true);
});

test("a cart written before the field existed still parses", () => {
  const legacy = JSON.stringify({
    lines: [
      {
        dishId: 1,
        kind: "dish",
        slug: "x",
        name: "X",
        pricePaise: 100,
        qty: 1,
        macros: { calories: 686, protein: 42, estimated: true },
      },
    ],
  });
  const reloaded = parseStoredCart(legacy);
  assert.equal(reloaded.lines.length, 1, "an older stored cart must not be discarded");
  assert.equal(reloaded.lines[0]?.macros?.provisional, undefined);
});

test("a malformed provisional flag is refused, not coerced", () => {
  // Matches the existing policy for `estimated`: present-but-wrong is
  // rejected. Coercing a string would make provenance depend on truthiness.
  const raw = JSON.stringify({
    lines: [
      {
        dishId: 1,
        kind: "dish",
        slug: "x",
        name: "X",
        pricePaise: 100,
        qty: 1,
        macros: { calories: 240, protein: 4, provisional: "yes" },
      },
    ],
  });
  assert.equal(parseStoredCart(raw).lines.length, 0);
});

test("the add-to-cart snapshots capture provenance", () => {
  const capture = [
    path.join("cart", "AddToCart.tsx"),
    path.join("menu", "PdpBuyLedger.tsx"),
  ];
  for (const rel of capture) {
    const src = fs.readFileSync(path.join(COMPONENTS, rel), "utf8");
    assert.match(
      src,
      /provisional:\s*dish\.macrosProvisional/,
      `${rel} must capture macrosProvisional into the cart line`,
    );
  }
});

test("the cart and checkout-review surfaces forward provenance", () => {
  // The checkout's line rows moved into the collapsible order summary (T-09);
  // the provenance flag travels with them.
  const render = [
    path.join("cart", "CartDrawer.tsx"),
    path.join("checkout", "AlacarteOrderSummary.tsx"),
  ];
  for (const rel of render) {
    const src = fs.readFileSync(path.join(COMPONENTS, rel), "utf8");
    assert.match(
      src,
      /formatMacroLine\([^)]*\.provisional/,
      `${rel} must forward the line's provisional flag`,
    );
  }
});
