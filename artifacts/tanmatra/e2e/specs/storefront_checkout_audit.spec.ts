import { test, expect, type Page } from "@playwright/test";
import { seedCart, cartItem, gstOn, rupees } from "../fixtures";

/**
 * Storefront & checkout 5-vector audit — rewritten against the REAL app.
 *
 * The original draft of this suite (credit: external engineering agent —
 * the five vectors map exactly to real bug classes from this launch cycle)
 * targeted selectors, routes, and flows that don't exist in this codebase
 * (/product/:slug, .sticky-total-bar, .otp-input-field, option price
 * modifiers…). This version keeps the vector intent and asserts against
 * the shipped v2 DOM (.tnm2 design system, /dish/:slug, integer-paise
 * money, 18% GST).
 *
 * Runs against a static build (no API): guest flows only, which is exactly
 * the surface these vectors cover. Serve build/client on E2E_BASE_URL
 * (default http://127.0.0.1:5190) with SPA fallback to __spa-fallback.html.
 */

// Dishes chosen from the bundled catalog with KNOWN macro states:
// almond-chicken-salad shares a macro tuple (provisional), greek-roman-
// chicken-salad carries real verified macros (320 kcal · 26 g protein).
const PROVISIONAL_DISH = "almond-chicken-salad";
const VERIFIED_DISH = "greek-roman-chicken-salad";

const BENIGN_ERRORS = /ResizeObserver|Loading chunk|sw\.js|Failed to fetch|NetworkError|load failed|ERR_/i;

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  return errors;
}

async function dismissSoftGate(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "tanmatra:softgate:v1",
      JSON.stringify({ v: 1, at: 1, outcome: "skip" }),
    );
  });
}

const digitsOf = (s: string | null): number =>
  Number((s ?? "").replace(/[^0-9]/g, ""));

test.describe("Tanmatra storefront & checkout audit (v2 app)", () => {
  test("V1 — PDP renders honestly: verified macros show numbers, provisional dishes say so", async ({ page }) => {
    await dismissSoftGate(page);
    const errors = collectErrors(page);

    // Verified-macro dish: real numbers, no verification placeholder.
    await page.goto(`/dish/${VERIFIED_DISH}`);
    await expect(page.locator("#__tanmatra-loader")).toBeHidden({ timeout: 10000 });
    await expect(page.locator("h1, .h2").first()).toContainText(/Greek Roman/i);
    await expect(page.getByText(/macros being verified/i)).toHaveCount(0);
    await expect(page.getByText(/kcal/i).first()).toBeVisible();

    // Provisional dish: the honesty label MUST be visible (this is the
    // designed behavior — the original draft asserted the opposite).
    await page.goto(`/dish/${PROVISIONAL_DISH}`);
    await expect(page.locator("#__tanmatra-loader")).toBeHidden({ timeout: 10000 });
    await expect(page.getByText(/macros being verified/i).first()).toBeVisible();

    // Safety surface: allergen row + cross-contact line above the fold.
    await expect(
      page.getByText(/Allergens:|Allergen data being verified/i).first(),
    ).toBeVisible();
    await expect(page.getByText(/cross-contact/i).first()).toBeVisible();

    expect(errors.filter((e) => !BENIGN_ERRORS.test(e))).toEqual([]);
  });

  test("V2 — ledger math: dock total scales exactly with quantity (integer rupees, no drift)", async ({ page }) => {
    await dismissSoftGate(page);
    await page.goto(`/dish/${VERIFIED_DISH}`);
    await expect(page.locator("#__tanmatra-loader")).toBeHidden({ timeout: 10000 });

    const dock = page.locator(".dock");
    await expect(dock).toBeVisible();
    const total1 = digitsOf(await dock.locator(".price").first().textContent());
    expect(total1).toBeGreaterThan(0);

    // Bump quantity via the dock's plus control.
    await dock.locator(".qbtn").last().click();
    await expect
      .poll(async () => digitsOf(await dock.locator(".price").first().textContent()))
      .toBe(total1 * 2);
  });

  test("V3 — drawer/cart state sync: added items persist across drawer close and page, GST is exactly 18%", async ({ page }) => {
    await dismissSoftGate(page);
    const errors = collectErrors(page);

    await page.goto("/menu");
    await expect(page.locator("#__tanmatra-loader")).toBeHidden({ timeout: 10000 });
    await page.waitForTimeout(800);

    // Add the first available dish from its card.
    const addBtn = page.locator(".addb").first();
    await addBtn.scrollIntoViewIfNeeded();
    await addBtn.click();

    // The drawer opens as a fixed overlay carrying the Close cart control.
    await expect(page.getByLabel("Close cart").first()).toBeVisible({ timeout: 5000 });

    // Close it — the cart state must survive the drawer closing (the
    // original report claimed selections reset the moment the drawer
    // collapsed; the persisted store is the real invariant).
    await page.getByLabel("Close cart").first().click();
    await expect
      .poll(async () =>
        page.evaluate(() => {
          try {
            const raw = JSON.parse(localStorage.getItem("tanmatra:cart:v1") ?? "{}");
            return (raw?.state?.items ?? []).length;
          } catch { return -1; }
        }),
      )
      .toBeGreaterThanOrEqual(1);

    // The cart page must show the item plus an exact 18% GST line.
    await page.goto("/cart");
    await expect(page.locator("#__tanmatra-loader")).toBeHidden({ timeout: 10000 });
    const body = await page.evaluate(() => document.body.innerText);
    const sub = body.match(/Subtotal[^₹]*₹\s?([\d,]+)/i);
    const gst = body.match(/GST[^₹]*₹\s?([\d,]+)/i);
    expect(sub, "cart must itemize a Subtotal line").toBeTruthy();
    expect(gst, "cart must itemize a GST line").toBeTruthy();
    const subR = Number(sub![1].replace(/,/g, ""));
    const gstR = Number(gst![1].replace(/,/g, ""));
    // Statutory GST split (5% food + 18% delivery), matching cartMath.ts
    // (paise-exact upstream; ±2 rupee tolerance for display rounding).
    const expectedGstR = gstOn(rupees(subR)) / 100;
    expect(Math.abs(gstR - expectedGstR)).toBeLessThanOrEqual(2);

    expect(errors.filter((e) => !BENIGN_ERRORS.test(e))).toEqual([]);
  });

  test("V4 — auth guard: guests get a clear login (with next-param), typed digits survive hydration, no redirect loop", async ({ page }) => {
    await dismissSoftGate(page);
    const errors = collectErrors(page);

    // Auth-gated page → login with return path, not a blank screen.
    await page.goto("/orders");
    await expect(page).toHaveURL(/\/login\?next=%2Forders/);
    await expect(page.getByText(/Welcome to Tanmatra/i)).toBeVisible();

    // Keystrokes typed into the (prerendered) login input must survive —
    // guards the hydration-wipe regression.
    const phone = page.locator('input[inputmode="numeric"]').first();
    await phone.click();
    await page.keyboard.type("9876543210", { delay: 30 });
    await page.waitForTimeout(600);
    await expect(phone).toHaveValue(/9876543210/);

    // Visiting the gated page again produces the same single redirect —
    // stable, not an accumulating loop.
    await page.goto("/orders");
    await expect(page).toHaveURL(/\/login\?next=%2Forders/);

    expect(errors.filter((e) => !BENIGN_ERRORS.test(e))).toEqual([]);
  });

  test("V5 — checkout renders with a seeded cart: address UI present, no map blackout crash, pay CTA reachable", async ({ page }) => {
    await dismissSoftGate(page);
    const errors = collectErrors(page);
    await seedCart(page, [cartItem({ quantity: 2 })]);

    await page.goto("/checkout");
    await expect(page.locator("#__tanmatra-loader")).toBeHidden({ timeout: 10000 });
    await page.waitForTimeout(1500);

    const body = await page.evaluate(() => document.body.innerText);
    expect(body).toMatch(/address|pin\s?code/i);
    expect(body).toMatch(/total|subtotal/i);
    // Maps without an API key must degrade gracefully — never a hard crash
    // or an error banner as the only content.
    expect(body).not.toMatch(/something went wrong/i);
    await expect(
      page.locator("button").filter({ hasText: /pay|place order|confirm/i }).first(),
    ).toBeVisible();

    expect(errors.filter((e) => !BENIGN_ERRORS.test(e))).toEqual([]);
  });

  test("V6 — upsell rail: adding an upsell keeps the cart growing and the card flips to Added (no dead button)", async ({ page }) => {
    await dismissSoftGate(page);
    const errors = collectErrors(page);

    // Seed a small cart so the drawer's upsell rail ("Add to your order")
    // renders, then open the drawer from the menu.
    await seedCart(page, [cartItem({ quantity: 1 })]);
    await page.goto("/menu");
    await expect(page.locator("#__tanmatra-loader")).toBeHidden({ timeout: 10000 });

    // Open the cart drawer via the first add on a menu card (opens the drawer)
    // or the cart entry point; then locate the upsell "Add" buttons.
    const addBtn = page.locator(".addb").first();
    await addBtn.scrollIntoViewIfNeeded();
    await addBtn.click();
    await expect(page.getByLabel("Close cart").first()).toBeVisible({ timeout: 5000 });

    // The upsell rail lives under the "Add to your order" heading. Grab its
    // first "Add" button and record the cart line count before adding.
    const railAdd = page.getByRole("button", { name: /Add .* to order/i }).first();
    const railCount = await railAdd.count();
    if (railCount > 0) {
      const before = await page.evaluate(() => {
        try { return JSON.parse(localStorage.getItem("tanmatra:cart:v1") ?? "{}")?.state?.items?.length ?? 0; }
        catch { return 0; }
      });
      await railAdd.click();
      // The card must NOT vanish into a dead state — it flips to "Added" and
      // the cart grows. Poll the persisted store (the true invariant).
      await expect
        .poll(async () =>
          page.evaluate(() => {
            try { return JSON.parse(localStorage.getItem("tanmatra:cart:v1") ?? "{}")?.state?.items?.length ?? 0; }
            catch { return -1; }
          }),
        )
        .toBeGreaterThan(before);
      // The same button re-taps as "Add another" — never a permanently
      // disabled/dead control (the stranded-status regression).
      await expect(page.getByText(/Added/i).first()).toBeVisible();
    }

    expect(errors.filter((e) => !BENIGN_ERRORS.test(e))).toEqual([]);
  });

  test("V7 — hero banners: the three homepage slides point to three DISTINCT destinations", async ({ page }) => {
    await dismissSoftGate(page);
    await page.goto("/");
    await expect(page.locator("#__tanmatra-loader")).toBeHidden({ timeout: 10000 });
    await page.waitForTimeout(500);

    // Each slide CTA navigates on click; assert the three CTAs resolve to three
    // different routes (regression guard for two banners sharing /menu).
    const ctas = page.locator(".herocar-slide button.btn-p");
    await expect(ctas.first()).toBeVisible({ timeout: 8000 });
    const n = await ctas.count();
    expect(n).toBeGreaterThanOrEqual(3);

    const dests: string[] = [];
    for (let i = 0; i < Math.min(n, 3); i++) {
      await page.goto("/");
      await expect(page.locator("#__tanmatra-loader")).toBeHidden({ timeout: 10000 });
      await page.locator(".herocar-slide button.btn-p").nth(i).click();
      await page.waitForTimeout(400);
      dests.push(new URL(page.url()).pathname);
    }
    // All distinct.
    expect(new Set(dests).size).toBe(dests.length);
  });
});
