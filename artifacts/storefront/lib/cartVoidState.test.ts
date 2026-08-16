import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Law 10 — no reachable state that is merely blank, and none that lies.
 *
 * CartProvider seeds EMPTY_CART and reads the stored cart in a post-mount
 * effect, so `cart.lines.length === 0` is not evidence of an empty cart until
 * `hydrated` is true. CartDrawer asserted emptiness without that guard, so a
 * customer with items in their cart could open the drawer and be told "Cart is
 * empty." — a void state that actively misinforms, which is worse than a blank
 * one. MiniCartBar already guarded on `hydrated`; its sibling did not.
 *
 * Parsed rather than rendered: these are client components behind "@/" aliases
 * and the storefront's node --test suite has no DOM.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CART = path.join(HERE, "..", "components", "cart");
const DRAWER = fs.readFileSync(path.join(CART, "CartDrawer.tsx"), "utf8");
const PROVIDER = fs.readFileSync(path.join(CART, "CartProvider.tsx"), "utf8");

test("the provider really does start empty before hydration", () => {
  // The premise of every other assertion here. If this stops being true the
  // guard below is unnecessary and this file should be revisited, not deleted.
  assert.match(PROVIDER, /useState<CartState>\(EMPTY_CART\)/);
  assert.match(PROVIDER, /setHydrated\(true\)/);
});

test("the drawer reads `hydrated`", () => {
  assert.match(DRAWER, /const \{[^}]*hydrated[^}]*\} = useCart\(\)/);
});

test("the empty-cart message is gated on hydration", () => {
  assert.match(
    DRAWER,
    /hydrated && cart\.lines\.length === 0/,
    '"Cart is empty." must not render before the stored cart has been read',
  );
});

test("the pre-hydration state is a placeholder, not a blank panel", () => {
  // Law 10's other half: replacing a lie with nothing at all is still a void.
  assert.match(DRAWER, /!hydrated &&/);
  assert.match(DRAWER, /animate-pulse/);
});

test("the loading placeholder is hidden from assistive tech", () => {
  // A skeleton announced to a screen reader is noise; the reader should hear
  // the resolved cart, not two decorative bars.
  assert.match(DRAWER, /data-screen-state="cart-loading"[\s\S]{0,120}aria-hidden/);
});
