import { test, expect } from "@playwright/test";
import { collectErrors } from "../fixtures";

/**
 * The ambient delivery bar must not vouch for an address we cannot serve.
 *
 * `DeliveryAddressBar` announces "Delivering to: Work (Sector 62)" for
 * whichever saved address is active, and until now nothing re-ran the pincode
 * check when that address changed. A customer whose saved Work address sits
 * outside the Noida service area read an authoritative-looking bar saying we
 * deliver there, and only found out at checkout.
 *
 * Both dependencies are stubbed at the NETWORK EDGE — the same pattern
 * `out-of-zone-pivot.spec.ts` and `cuj-corporate-lunch-planner.spec.ts` use —
 * rather than faked in our own code. The PR-gate build serves the app with no
 * API behind it, so a real `/api/addresses` call never resolves and the bar
 * would fall back to `ServiceabilityBar` on every run, testing nothing. The
 * payloads below are byte-shaped like the server's, and every line of
 * component logic between them and the DOM is the real one.
 */

const SERVICEABLE = "201301"; // Noida — inside the service area.
const OUT_OF_ZONE = "400001"; // Mumbai — outside it.

function address(over: Record<string, unknown>): Record<string, unknown> {
  return {
    id: "a1",
    label: "Home",
    type: "home",
    line1: "A-1",
    line2: "Sector 54",
    city: "Noida",
    pincode: SERVICEABLE,
    phone: "9800000000",
    isDefault: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

const HOME = address({});
const WORK = address({
  id: "a2",
  label: "Work",
  type: "work",
  line1: "Tower B",
  line2: "Nariman Point",
  city: "Mumbai",
  pincode: OUT_OF_ZONE,
  isDefault: false,
});

/**
 * Serviceability is answered PER PINCODE from the URL, not with one fixed
 * verdict. A stub that always says "unserviceable" would pass this spec even
 * if the component ignored the active address entirely — which is the exact
 * bug under test.
 */
async function stubSession(page: import("@playwright/test").Page): Promise<void> {
  await page.route("**/api/addresses", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ addresses: [HOME, WORK] }),
    }),
  );
  await page.route("**/api/serviceability/*", (route) => {
    const pin = new URL(route.request().url()).pathname.split("/").pop() ?? "";
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        pin === SERVICEABLE ? { serviceable: true } : { serviceable: false, code: "unserviceable_pincode" },
      ),
    });
  });
}

/**
 * The bar ships in the server HTML before React hydrates, so an early click
 * lands on an unwired element and silently does nothing. Retried with its
 * assertion, and CHECK-THEN-ACT: re-clicking an already-open sheet would
 * close it, so the retry stops clicking once the dialog is up.
 */
async function openSwitcher(page: import("@playwright/test").Page): Promise<void> {
  const sheet = page.getByRole("dialog", { name: "Choose a delivery address" });
  await expect(async () => {
    if (!(await sheet.isVisible().catch(() => false))) {
      await page.getByRole("button", { name: /Delivering to:|Saved:/ }).click({ timeout: 2_000 });
    }
    await expect(sheet).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
}

test("a serviceable active address reads as delivering, with no warning", async ({ page }) => {
  const errors = collectErrors(page);
  await stubSession(page);
  await page.goto("/menu");

  const bar = page.getByRole("button", { name: /Delivering to:/ });
  await expect(bar).toBeVisible({ timeout: 15_000 });
  await expect(bar).toContainText("Home (Sector 54)");
  await expect(page.getByText("Not served")).toHaveCount(0);

  expect(errors).toEqual([]);
});

test("switching to an out-of-zone address stops claiming we deliver there", async ({ page }) => {
  await stubSession(page);
  await page.goto("/menu");
  await openSwitcher(page);

  await page.getByRole("button", { name: /Work/ }).click();

  // The verb changed: the bar no longer says we are delivering to it.
  const bar = page.getByRole("button", { name: /Saved:/ });
  await expect(bar).toBeVisible({ timeout: 10_000 });
  await expect(bar).toContainText("Work (Nariman Point)");
  await expect(bar).toContainText("Not served");
  await expect(page.getByRole("button", { name: /Delivering to:/ })).toHaveCount(0);
});

test("the out-of-zone address explains itself and offers a real way forward", async ({ page }) => {
  await stubSession(page);
  await page.goto("/menu");
  await openSwitcher(page);
  await page.getByRole("button", { name: /Work/ }).click();

  // Reopen: the header chip is too narrow to carry the explanation, so the
  // sheet it already opens is where the full message and the onward routes
  // live. A chip with no explanation anywhere would be its own dead end.
  await openSwitcher(page);
  const status = page.getByRole("status");
  await expect(status).toContainText(new RegExp(`not in ${OUT_OF_ZONE}`, "i"));

  // Route 1: another saved address is right there in the same sheet.
  await expect(page.getByRole("button", { name: /Home/ })).toBeVisible();

  // Route 2: the marketplace, and it must actually go somewhere — a CTA into
  // a 404 is the same dead end wearing a button.
  const marketplaceCta = status.getByRole("link", { name: /shop the marketplace/i });
  await expect(marketplaceCta).toBeVisible();
  await marketplaceCta.click();
  await expect(page).toHaveURL(/\/marketplace/);
  await expect(page.getByRole("heading", { name: /marketplace/i }).first()).toBeVisible();
});

/**
 * The inverted-fail-loud case. Everywhere else in the storefront a broken
 * dependency should fail LOUD; here the loud version is a FALSE CLAIM to a
 * customer we can serve, so a transport failure must stay silent.
 */
test("a failed serviceability check never renders as 'not served'", async ({ page }) => {
  await page.route("**/api/addresses", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ addresses: [HOME] }),
    }),
  );
  await page.route("**/api/serviceability/*", (route) => route.abort("failed"));

  await page.goto("/menu");
  await expect(page.getByRole("button", { name: /Delivering to:/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Not served")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Saved:/ })).toHaveCount(0);
});
