import { test, expect, type Page } from "@playwright/test";
import { marker, evidenceShot } from "./support";

/**
 * Stitch-runtime evidence — manifest §9 (meal planner / subscriptions) and
 * §10 (account hub sections). Every test asserts the surface by role/name
 * FIRST, then the production diagnostic marker (data-screen-id/-state), then
 * captures the deterministic evidence screenshot for that promptId.
 *
 * Session strategy mirrors the cuj-account specs (cuj-account-hub /
 * -addresses / -subscriptions / -orders): every account island is
 * session-gated and renders a graceful inline sign-in state on a 401. The
 * deployed specs reach that 401 via the real api-server; the local PR-gate
 * build has no /api proxy, so here the 401 is fulfilled deterministically
 * with page.route — same honest signed-out screens, runnable anywhere.
 * 9.2 alone needs authed data (a delivery list with a live "Manage" button),
 * so that test layers 200 stubs on top; routes registered later win.
 */

const json = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

/** Default every /api call to the session-gate 401 (bare {error, code} — the
 *  shape lib/apiClient.ts throws as ApiError, which each island branches on). */
async function stubSignedOut(page: Page) {
  await page.route("**/api/**", (route) =>
    route.fulfill(json({ error: "Sign in required", code: "unauthorized" }, 401)),
  );
}

test.beforeEach(async ({ page }) => {
  await stubSignedOut(page);
});

// ── §9 — meal planner & subscription management ─────────────────────────────

test.describe("stitch-runtime §9 — meal planner & subscriptions", () => {
  test("9.1 meal planner schedule is wired", async ({ page }) => {
    await page.goto("/meal-planner");
    await expect(page.getByRole("heading", { level: 1, name: "Weekly meal planner" })).toBeVisible();
    await expect(page.getByText("Sign in to plan and edit your week.")).toBeVisible();
    await expect(marker(page, "9.1", "default")).toBeVisible();
    await evidenceShot(page, "9.1");
  });

  test("9.2 manage delivery sheet is wired", async ({ page }) => {
    // Authed stubs, layered over the beforeEach 401 catch-all (later routes
    // take precedence): one active weekly subscription whose detail carries an
    // upcoming delivery >24h out, so DeliveryList renders "Manage" enabled.
    const scheduledFor = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const subscription = {
      id: 7,
      status: "active",
      cadence: "weekly",
      mealsPerDelivery: 2,
      deliveryWindow: "12:30–14:00",
      startDate: "2026-08-01",
      nextDeliveryAt: scheduledFor,
      pausedAt: null,
      addressLabel: "Home",
      addressLine: "12 Lakeview Road",
      city: "Indore",
      pincode: "452001",
      pricePerDeliveryPaise: 49800,
      notes: null,
      createdAt: "2026-08-01T09:00:00.000Z",
    };
    await page.route("**/api/subscriptions", (route) =>
      route.fulfill(json({ subscriptions: [subscription] })),
    );
    await page.route("**/api/meal-credits", (route) =>
      route.fulfill(json({ credits: [], balance: 0 })),
    );
    await page.route("**/api/subscriptions/7", (route) =>
      route.fulfill(
        json({
          subscription,
          members: [],
          deliveries: [
            {
              id: 71,
              subscriptionId: 7,
              scheduledFor,
              status: "upcoming",
              deliveryWindow: "12:30–14:00",
              items: [
                {
                  slug: "quinoa-khichdi",
                  name: "Quinoa Khichdi",
                  image: "",
                  quantity: 1,
                  unitPricePaise: 24900,
                  memberId: null,
                },
              ],
            },
          ],
          mandate: null,
        }),
      ),
    );

    await page.goto("/account/subscriptions");
    await expect(page.getByRole("heading", { level: 1, name: "Your plans" })).toBeVisible();

    // delivery-list source state → trigger (accessible name "Manage").
    await page.getByRole("button", { name: "Deliveries", exact: true }).click();
    const manage = page.getByRole("button", { name: "Manage", exact: true });
    await expect(manage).toBeEnabled();
    await manage.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Manage delivery" })).toBeVisible();
    await expect(marker(page, "9.2", "manage-delivery-open")).toBeVisible();
    // Shot BEFORE closing — the evidence for 9.2 is the open sheet state.
    await evidenceShot(page, "9.2");

    // Close restores the delivery list underneath (manifest close behavior).
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(marker(page, "9.2")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Manage", exact: true })).toBeVisible();
  });

  test("9.3 subscriptions manager is wired", async ({ page }) => {
    await page.goto("/account/subscriptions");
    await expect(page.getByRole("heading", { level: 1, name: "Your plans" })).toBeVisible();
    await expect(page.getByText("Sign in to view and manage your plans.")).toBeVisible();
    await expect(marker(page, "9.3", "default")).toBeVisible();
    await evidenceShot(page, "9.3");
  });
});

// ── §10 — account hub sections ──────────────────────────────────────────────

test.describe("stitch-runtime §10 — account hub sections", () => {
  test("10.1 account hub is wired", async ({ page }) => {
    await page.goto("/account");
    await expect(page.getByRole("heading", { level: 1, name: "Account" })).toBeVisible();
    await expect(page.getByText("Sign in to see your orders, plans and addresses.")).toBeVisible();
    await expect(marker(page, "10.1", "default")).toBeVisible();
    await evidenceShot(page, "10.1");
  });

  test("10.2 order history is wired", async ({ page }) => {
    await page.goto("/account/orders");
    await expect(page.getByRole("heading", { level: 1, name: "Orders" })).toBeVisible();
    await expect(page.getByText("Sign in to view your order history.")).toBeVisible();
    await expect(marker(page, "10.2", "default")).toBeVisible();
    await evidenceShot(page, "10.2");
  });

  test("10.3 saved addresses is wired", async ({ page }) => {
    await page.goto("/account/addresses");
    await expect(page.getByRole("heading", { level: 1, name: "Your addresses" })).toBeVisible();
    await expect(page.getByText("Sign in to view and manage your saved addresses.")).toBeVisible();
    await expect(marker(page, "10.3", "default")).toBeVisible();
    await evidenceShot(page, "10.3");
  });

  test("10.4 preferences is wired", async ({ page }) => {
    await page.goto("/account/preferences");
    await expect(page.getByRole("heading", { level: 1, name: "Preferences" })).toBeVisible();
    await expect(page.getByText("Sign in to set your food preferences.")).toBeVisible();
    await expect(marker(page, "10.4", "default")).toBeVisible();
    await evidenceShot(page, "10.4");
  });

  test("10.5 wellness studio is wired", async ({ page }) => {
    await page.goto("/account/wellness");
    await expect(
      page.getByRole("heading", { level: 1, name: "Nutrition & Health Studio" }),
    ).toBeVisible();
    // The studio island is client-local (no session gate) — its default tab
    // proves the hub mounted.
    await expect(page.getByRole("button", { name: "ICMR Precision Planner" })).toBeVisible();
    await expect(marker(page, "10.5", "default")).toBeVisible();
    await evidenceShot(page, "10.5");
  });

  // DEF-RECON-PANTRY-001 (docs/reconciliation/defects.md): the pantry scanner's
  // "Add to Subscription" button rendered with no onClick at all — a dead CTA.
  // The suggestions it lists are catalogue dishes (pantryVisionScanner.ts on
  // the server slices them straight off the menu), not a subscription add-on,
  // so the fix wires it to the same cart mechanism the menu/PDP already use
  // and relabels it "Add to cart" to match what it actually does.
  test("10.5 pantry scan suggestion Add to cart adds a real cart line", async ({ page }) => {
    // Layered over the beforeEach 401 catch-all (later routes take
    // precedence) — the scan endpoint itself needs no session.
    await page.route("**/api/wellness/pantry-scan", (route) =>
      route.fulfill(
        json({
          scanResult: {
            detectedIngredients: [{ name: "Paneer", category: "dairy", confidenceScore: 0.92 }],
            suggestedRecipes: [],
            suggestedTanmatraAddOns: [
              {
                id: 501,
                slug: "high-protein-thali",
                name: "High-Protein Thali",
                category: "thali",
                pricePaise: 24900,
                rationale: "Pairs with the paneer we spotted in your fridge.",
              },
            ],
          },
        }),
      ),
    );

    await page.goto("/account/wellness");
    await page.getByRole("button", { name: "Pantry Vision Scanner" }).click();

    await page
      .locator('input[type="file"]')
      .setInputFiles({ name: "fridge.jpg", mimeType: "image/jpeg", buffer: Buffer.from("fake") });

    const addButton = page.getByRole("button", { name: "Add to cart" });
    await expect(addButton).toBeVisible();
    await addButton.click();
    await expect(page.getByRole("button", { name: "Added to cart" })).toBeVisible();

    const cart = await page.evaluate(() => window.localStorage.getItem("storefront:cart:v1"));
    expect(JSON.parse(cart ?? "{}")).toMatchObject({
      lines: [{ dishId: 501, kind: "dish", slug: "high-protein-thali", pricePaise: 24900, qty: 1 }],
    });
  });

  test("10.6 consumption history is wired", async ({ page }) => {
    await page.goto("/account/history");
    await expect(
      page.getByRole("heading", { level: 1, name: "Meal History Dashboard" }),
    ).toBeVisible();
    await expect(page.getByText("Sign in to inspect your verified macro adherence logs.")).toBeVisible();
    await expect(marker(page, "10.6", "default")).toBeVisible();
    await evidenceShot(page, "10.6");
  });

  test("10.7 symptom tracker is wired", async ({ page }) => {
    await page.goto("/account/symptoms");
    await expect(
      page.getByRole("heading", { level: 1, name: "Health Symptom & Reaction Tracker" }),
    ).toBeVisible();
    await expect(page.getByText("Sign in to log and view your symptom history.")).toBeVisible();
    await expect(marker(page, "10.7", "default")).toBeVisible();
    await evidenceShot(page, "10.7");
  });

  test("10.8 health connections is wired", async ({ page }) => {
    await page.goto("/account/connections");
    await expect(
      page.getByRole("heading", { level: 1, name: "Connected Health Data" }),
    ).toBeVisible();
    // WearablesHub is client-local; Apple Health starts connected, so its
    // action button proves the island mounted.
    await expect(
      page.getByRole("button", { name: "Disconnect Provider" }).first(),
    ).toBeVisible();
    await expect(marker(page, "10.8", "default")).toBeVisible();
    await evidenceShot(page, "10.8");
  });
});
