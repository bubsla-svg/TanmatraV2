import { test, expect, type Page } from "@playwright/test";
import { ORDERABLE_DISH } from "../../fixtures";
import { marker, evidenceShot } from "./support";

/**
 * Stitch runtime evidence — utility states (manifest 14.1 cart-empty,
 * 14.5 unserviceable-address). Role/name-first assertion, THEN the
 * data-screen-id/state marker, THEN the evidence screenshot.
 *
 * 14.1 — the empty-cart state lives in CartDrawer and only renders while the
 * drawer is open with zero lines. No always-on cart control exists at zero
 * items (MiniCartBar unmounts at count 0 and takes its drawer host with it),
 * so the real user path is the PDP: its buy ledger keeps the drawer mounted
 * at qty 0, so adding a dish, opening the drawer, and stepping the line down
 * to zero lands on the manifest's "Cart has zero items" condition for real.
 *
 * 14.5 — AddressForm's unserviceable panel renders only when the server
 * rejects a submit with 422 unserviceable_pincode (AddressManager maps the
 * code to the panel). Both /api/addresses legs are stubbed at the network
 * edge, mirroring active-address-serviceability.spec.ts: the list resolves so
 * the signed-in CRUD renders, and the PATCH answers 422 for the out-of-area
 * pincode — every line of component logic in between is the real one.
 */

const OUT_OF_ZONE = "400001"; // Mumbai — outside the Noida service area.

const HOME = {
  id: "a1",
  label: "Home",
  type: "home",
  line1: "A-1",
  line2: "Sector 54",
  city: "Noida",
  pincode: "201301",
  phone: "9800000000",
  isDefault: true,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

async function stubAddressSession(page: Page): Promise<void> {
  await page.route("**/api/addresses", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ addresses: [HOME] }),
    }),
  );
  await page.route(`**/api/addresses/${HOME.id}`, (route) =>
    route.fulfill({
      status: 422,
      contentType: "application/json",
      body: JSON.stringify({
        error: "We don't deliver to this pincode yet",
        code: "unserviceable_pincode",
      }),
    }),
  );
}

test.describe("stitch-runtime: utility states (14.x)", () => {
  test("14.1 empty cart drawer state is wired", async ({ page }) => {
    await page.goto(`/dish/${ORDERABLE_DISH.slug}`);
    // The PDP buy ledger adds the dish AND opens the cart drawer.
    await page.getByRole("button", { name: "Add to cart" }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByRole("heading", { name: "Your cart" })).toBeVisible();
    await expect(drawer.getByText(ORDERABLE_DISH.name)).toBeVisible();
    // Step the only line down to zero — the manifest's empty-data condition —
    // with the drawer still open on its now-empty list.
    await drawer.getByRole("button", { name: "Decrease", exact: true }).click();
    await expect(drawer.getByText("Cart is empty.")).toBeVisible();
    await expect(marker(page, "14.1", "cart-empty")).toBeVisible();
    await evidenceShot(page, "14.1");
  });

  test("14.5 unserviceable address notice is wired", async ({ page }) => {
    await stubAddressSession(page);
    await page.goto("/account/addresses");
    await expect(
      page.getByRole("heading", { name: "Your addresses", level: 1 }),
    ).toBeVisible();

    // Edit the saved address and resubmit it with an out-of-area pincode; the
    // stubbed server answers 422 unserviceable_pincode.
    await page.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByLabel("PIN code")).toBeVisible();
    await page.getByLabel("PIN code").fill(OUT_OF_ZONE);
    await page.getByRole("button", { name: "Update address" }).click();

    // The notice explains itself (why + where we do deliver) and offers the
    // change-address recovery action back to the still-populated form.
    await expect(page.getByText(new RegExp(`don.t deliver to ${OUT_OF_ZONE} yet`))).toBeVisible();
    await expect(page.getByText(/delivers across Noida only/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Change pincode" })).toBeVisible();
    await expect(marker(page, "14.5", "unserviceable-address")).toBeVisible();
    await evidenceShot(page, "14.5");
  });
});
