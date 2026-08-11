import { test, expect, type Page } from "@playwright/test";

/**
 * DEF-RECON-GROUPORDER-001: `/group/[code]` was a PlaceholderPage even though
 * the full lifecycle (create/get/add-item/remove-line/close) already existed
 * client+server and the join entry point (AddToCart.tsx's "Add to group",
 * covered elsewhere) was already live — a join link could be sent and acted
 * on with nowhere for the joiner, or the host, to actually land.
 *
 * Unlike the marketplace PDP (server-fetched, can't be page.route-stubbed),
 * GroupOrderView fetches client-side via lib/groupOrdersApi.ts, so the real
 * host/join/close UI is fully testable here with mocked API responses — no
 * E2E_FULL_STACK gate needed.
 */

const json = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

const GROUP = {
  id: 1,
  code: "ABC123",
  hostUserId: "host-1",
  hostName: "Riya",
  status: "open" as const,
  items: [
    // A real menu-catalog dish (id 98, @workspace/menu-catalog) — closeAndCheckout
    // looks it up via DISHES.find() to build the cart line, so an invented id
    // would silently no-op (skipped++) instead of exercising the transfer.
    {
      lineId: "l1",
      dishId: 98,
      name: "Quinoa Khichdi",
      image: "",
      unitPrice: 9900,
      quantity: 2,
      customizations: [],
      addedBy: "guest-1",
      addedByName: "Sam",
    },
  ],
  participants: [
    { id: "host-1", name: "Riya" },
    { id: "guest-1", name: "Sam" },
  ],
  createdAt: "2026-08-01T09:00:00.000Z",
  updatedAt: "2026-08-01T09:00:00.000Z",
  closedAt: null,
};

async function stubGroup(page: Page, userId: string | null) {
  await page.route("**/api/group-orders/ABC123", (route) => route.fulfill(json({ group: GROUP })));
  await page.route("**/api/auth/user", (route) =>
    route.fulfill(json({ user: userId ? { id: userId, phoneE164: null, email: null, firstName: null, lastName: null, profileImageUrl: null } : null })),
  );
}

test("a joiner sees the group's picks and an Add your items link, not a host control", async ({ page }) => {
  await stubGroup(page, "guest-1"); // signed in, but not the host

  await page.goto("/group/ABC123");
  await expect(page.getByRole("heading", { name: "Order together, pay once" })).toBeVisible();
  // "ABC123" also appears in the share-code copy below — scope to the code chip.
  await expect(page.getByText("ABC123").first()).toBeVisible();
  await expect(page.getByText(/Hosted by Riya/)).toBeVisible();
  await expect(page.getByText("Quinoa Khichdi")).toBeVisible();
  await expect(page.getByText(/Added by Sam/)).toBeVisible();

  await expect(page.getByRole("link", { name: "Add your items" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Close & checkout" })).toHaveCount(0);
});

test("the host sees Close & checkout, and closing merges the group into cart and routes to checkout", async ({ page }) => {
  await stubGroup(page, "host-1");
  await page.route("**/api/group-orders/ABC123/close", (route) =>
    route.fulfill(json({ group: { ...GROUP, status: "closed", closedAt: "2026-08-01T10:00:00.000Z" } })),
  );

  await page.goto("/group/ABC123");
  const closeButton = page.getByRole("button", { name: "Close & checkout" });
  await expect(closeButton).toBeVisible();
  await closeButton.click();
  await expect(page).toHaveURL(/\/checkout\?mode=alacarte$/);

  const cart = await page.evaluate(() => window.localStorage.getItem("storefront:cart:v1"));
  const parsed = JSON.parse(cart ?? "{}");
  expect(parsed.lines.some((l: { dishId: number; qty: number }) => l.dishId === 98 && l.qty === 2)).toBe(true);
});

test("an unknown code shows an honest not-found state, not a crash", async ({ page }) => {
  await page.route("**/api/group-orders/NOPE99", (route) =>
    route.fulfill(json({ error: "not found", code: "not_found" }, 404)),
  );
  await page.route("**/api/auth/user", (route) => route.fulfill(json({ user: null })));

  await page.goto("/group/NOPE99");
  await expect(page.getByText("Group NOPE99 was not found")).toBeVisible();
});
