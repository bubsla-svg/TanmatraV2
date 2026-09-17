import { test, expect } from "@playwright/test";
import { collectErrors, ORDERABLE_DISH } from "../fixtures";
import { MenuPage } from "../support/pages/MenuPage";

/**
 * T5 — location first (CRO handoff 2026-09-17). The ask comes before the
 * food: a PIN (or GPS) on the first browsing screen, stored in a cookie, and
 * honoured everywhere — the header line, every Add button, the cart's
 * Checkout. The ticket's acceptance line is that an unserviceable PIN never
 * reaches POST /orders; here that is proven at the source (no add, no
 * checkout link) rather than at the server.
 *
 * The PR-gate build has no api-server, so GET /api/serviceability/:pin and
 * GET /api/delivery/slots are stubbed per test.
 */

const SERVICEABLE = "201301";
const UNSERVICEABLE = "110001";

async function stubServiceability(page: import("@playwright/test").Page): Promise<void> {
  await page.route("**/api/serviceability/*", (route) => {
    const pin = route.request().url().split("/").pop() ?? "";
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(pin === SERVICEABLE ? { serviceable: true } : { serviceable: false, code: "unserviceable_pincode" }),
    });
  });
}

function todaySlot(): Record<string, unknown> {
  // A window that is still open "today" in the kitchen's zone, whatever the
  // runner's clock: starts one hour from now, ends two hours from now.
  const start = new Date(Date.now() + 60 * 60_000);
  const end = new Date(Date.now() + 2 * 60 * 60_000);
  const slotDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(start);
  return { id: 1, slotDate, startsAt: start.toISOString(), endsAt: end.toISOString(), zone: "noida", capacity: 10, reservedCount: 0, remaining: 10, full: false };
}

test("first visit to /menu asks for a PIN before the food, and a served PIN becomes the header's delivery line", async ({ page }) => {
  const errors = collectErrors(page);
  await stubServiceability(page);
  await page.route("**/api/delivery/slots*", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ slots: [todaySlot()] }) }),
  );
  await page.goto("/menu");
  const ask = page.getByRole("region", { name: /where should we deliver/i });
  await expect(ask).toBeVisible();
  await ask.getByLabel("Delivery PIN code").fill(SERVICEABLE);
  await ask.getByRole("button", { name: "Confirm" }).click();
  await expect(ask).toHaveCount(0);
  // The header pill: "Delivering to 201301 · today 7–8 pm" (window from the stubbed slot).
  const pill = page.getByRole("button", { name: /delivering to 201301/i });
  await expect(pill).toBeVisible();
  await expect(pill).toHaveAccessibleName(/today \d/);
  // The verdict is a cookie now, so a server render can read it.
  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === "tnm_pin")?.value).toBe(SERVICEABLE);
  expect(cookies.find((c) => c.name === "tnm_pin_ok")?.value).toBe("1");
  expect(errors).toEqual([]);
});

test("an unserviceable PIN turns the ask into the waitlist, disables every Add, and the cart offers no Checkout", async ({ page }) => {
  await stubServiceability(page);
  let orders = 0;
  await page.route("**/api/orders", (route) => {
    orders += 1;
    route.fulfill({ status: 500, body: "must never be called" });
  });
  await page.goto("/menu");
  const ask = page.getByRole("region", { name: /where should we deliver/i });
  await ask.getByLabel("Delivery PIN code").fill(UNSERVICEABLE);
  await ask.getByRole("button", { name: "Confirm" }).click();
  // The ask stands down; the header's own bar carries the ONE waitlist form.
  await expect(ask).toHaveCount(0);
  await expect(page.getByText(/not in 110001/i)).toHaveCount(1);
  await expect(page.getByRole("button", { name: /notify me/i })).toHaveCount(1);
  // Every Add stands down.
  const menu = new MenuPage(page);
  const add = menu.card(ORDERABLE_DISH.name).getByRole("button", { name: /not in your area/i });
  await expect(add).toBeVisible();
  await expect(add).toBeDisabled();
  await expect(page.getByRole("button", { name: "Add", exact: true })).toHaveCount(0);
  // A cart built BEFORE the verdict (or on another device) gets no Checkout.
  await page.evaluate(() => {
    localStorage.setItem("storefront:cart:v1", JSON.stringify({ lines: [{ dishId: 1, kind: "dish", slug: "x", name: "X", pricePaise: 100, qty: 1 }] }));
  });
  await page.reload();
  await page.getByRole("button", { name: "View cart" }).click();
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByRole("status")).toContainText(/don.t deliver to 110001/i);
  await expect(drawer.getByRole("link", { name: "Checkout" })).toHaveCount(0);
  expect(orders).toBe(0);
});

test("'Browse first' dismisses the ask for the session and the header pill still offers it", async ({ page }) => {
  await page.goto("/menu");
  const ask = page.getByRole("region", { name: /where should we deliver/i });
  await ask.getByRole("button", { name: /browse first/i }).click();
  await expect(ask).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("region", { name: /where should we deliver/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /set location|select your location/i })).toBeVisible();
});
