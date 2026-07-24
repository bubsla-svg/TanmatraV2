import { test, expect } from "@playwright/test";

/**
 * CUJ-09 — Reorder, verified against the DEPLOYED bundle. Real sign-in needs
 * a live phone OTP no CI runner can receive, so the session boundary is the
 * ONE thing stubbed: /api/orders/mine is fulfilled with a fixture order whose
 * lines reference REAL dishes read from the live /api/menu/public moments
 * earlier. Everything else is genuine — the shipped JS, the live menu through
 * the proxy, reorderIntoCart's repricing/drop logic, the cart store, and the
 * mini-bar on /menu after navigation. A ghost line (id 999999) asserts the
 * honest-drop path ("No longer on the menu: …") alongside the happy path.
 * Deployed-only (E2E_LIVE_CHECKOUT=1): the PR-gate build has no /api proxy.
 */
const deployedLive = process.env["E2E_LIVE_CHECKOUT"] === "1" ? test : test.skip;

interface LiveDish {
  id: number;
  name: string;
  price: number;
  isAvailable?: boolean;
}

deployedLive("reorder re-seeds the cart from a past order against the live menu", async ({ page }) => {
  // Ground the fixture in the CURRENT live menu — no hardcoded dish ids.
  const menuRes = await page.request.get("/api/menu/public");
  expect(menuRes.ok()).toBeTruthy();
  const { dishes } = (await menuRes.json()) as { dishes: LiveDish[] };
  const dish = dishes.find((d) => d.isAvailable !== false);
  expect(dish, "live menu has at least one available dish").toBeTruthy();

  const order = {
    serverOrderId: 990001,
    externalOrderId: "e2e-reorder-1",
    status: "delivered",
    totalPaise: dish!.price * 2 + 100,
    addressLabel: "Home",
    createdAt: "2026-07-20T10:00:00Z",
    items: [
      { id: dish!.id, name: dish!.name, qty: 2, price: dish!.price },
      { id: 999999, name: "Ghost Dish", qty: 1, price: 100 },
    ],
  };
  await page.route("**/api/orders/mine", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ orders: [order] }) }),
  );

  await page.goto("/account/orders");
  await expect(page.getByText("Delivered")).toBeVisible();

  // The real deployed bundle fetches the real live menu and re-seeds the cart.
  await page.getByRole("button", { name: "Reorder" }).click();
  await expect(page.getByText(/Added 1 item to your cart/)).toBeVisible();
  await expect(page.getByText(/No longer on the menu: Ghost Dish/)).toBeVisible();

  // The seeded cart is real client state: the /menu mini-bar shows qty 2.
  await page.goto("/menu");
  await expect(page.getByText("2 items")).toBeVisible();
});
