import { test, expect } from "@playwright/test";
import { evidenceShot } from "./support";
import { MenuPage } from "../../support/pages/MenuPage";

/**
 * TNM-MENU-01 M-5 §4 — display-integrity rules, asserted against whatever
 * catalog the run is pointed at (local prod build or the deployed service).
 *
 * These are the rules the directive states as testable, restricted to the
 * ones this branch is responsible for. Two of §4's six are deliberately NOT
 * here and are called out in the PR body instead:
 *
 *  - §4.1 (rendered order equals payload sort_rank) and §4.6 (section 13
 *    present and last) cannot be asserted against production today, because
 *    NO live dish carries `section_order` — M-3 has never been applied to
 *    the production database, so every dish falls into the ungoverned "More
 *    dishes" bucket by design. `lib/menuSections.test.ts` pins the grouping
 *    and ordering logic itself; asserting it end-to-end has to wait for the
 *    data. Claiming otherwise here would be a green test that proves nothing.
 *
 *  - §4.4 (price traces to server paise) and §4.5 (token lint) are already
 *    enforced upstream — by the money-path suites and by `lint:tokens` in
 *    CI — so duplicating them as browser assertions would add flake, not
 *    coverage.
 */

test.describe("stitch-runtime: menu display integrity (M-5 §4)", () => {
  test("§4.3 every card carries an FSSAI-style mark — audited at 100%, not sampled", async ({
    page,
  }) => {
    const menu = new MenuPage(page);
    await menu.goto();

    const cards = page.locator("article");
    const cardCount = await cards.count();
    expect(cardCount, "menu rendered no cards at all").toBeGreaterThan(0);

    // One mark per card, and every mark is one of the three legal states.
    const marks = page.locator('article [data-testid="veg-mark"]');
    expect(await marks.count(), "a card is missing its veg mark").toBe(cardCount);

    const classes = await marks.evaluateAll((els) =>
      els.map((e) => e.getAttribute("data-veg-class")),
    );
    for (const c of classes) {
      expect(["veg", "non-veg", "egg"]).toContain(c);
    }

    // The mark must carry SHAPE, not colour alone — it is an <svg> with a
    // square outline plus an inner shape, which is what makes it legible to
    // a colourblind customer. A bare tinted dot would pass a "has a mark"
    // check and fail the actual requirement.
    const tag = await marks.first().evaluate((e) => e.tagName.toLowerCase());
    expect(tag).toBe("svg");
    const innerShapes = await marks
      .first()
      .evaluate((e) => e.querySelectorAll("circle, path").length);
    expect(innerShapes, "mark has no inner shape — colour would be doing all the work").toBeGreaterThan(0);

    await evidenceShot(page, "5.2-fssai-marks");
  });

  test("§4.2 no card renders the placeholder stub signature", async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.goto();
    await expect(page.locator("article").first()).toBeVisible();

    const body = (await page.locator("main").innerText()).toLowerCase();

    // The seed placeholder descriptor must never reach the customer.
    expect(body, 'the "fresh ingredients" stub descriptor leaked onto the menu').not.toContain(
      "fresh ingredients",
    );

    // …and the placeholder macro bucket must not render as fact. 16 live
    // dishes carry exactly 460 kcal / 18 g P; the gate replaces those
    // numbers with an honest "being verified" chip.
    const stubMacroPattern = /460\s*kcal\s*·\s*≈?\s*18\s*g\s*P/i;
    expect(body.replace(/ /g, " ")).not.toMatch(stubMacroPattern);
  });

  test("§4.2 no duplicate dish names on the page", async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.goto();

    const names = await page
      .locator("article h3")
      .evaluateAll((els) => els.map((e) => (e.textContent ?? "").trim()).filter(Boolean));
    expect(names.length).toBeGreaterThan(0);

    const seen = new Map<string, number>();
    for (const n of names) seen.set(n, (seen.get(n) ?? 0) + 1);
    const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([name, n]) => `${name} ×${n}`);

    expect(dupes, `duplicate dish cards: ${dupes.join(", ")}`).toEqual([]);

    // SCOPE, STATED HONESTLY: this asserts §4.2 as literally written —
    // duplicate *names*. It passes against production, and that pass does
    // NOT mean defect S-9 is closed. S-9 is a SEMANTIC duplicate: the live
    // catalog carries "Aglio Olio Pasta V" (a stub row) alongside the real
    // "Aglio Olio - Veg" (finding F9). Two rows, one dish, two different
    // names — so a name-equality check cannot see it, and no render-side
    // check reliably can. Only M-3's archive set removes it. Recorded here
    // so a future reader does not mistake this green for coverage it
    // doesn't provide.
  });

  test("the ≈ marker is explained exactly once when it appears", async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.goto();
    await expect(page.locator("article").first()).toBeVisible();

    const legend = page.getByTestId("macro-legend");
    const anyApprox = (await page.locator("main").innerText()).includes("≈");

    if (anyApprox) {
      await expect(legend, "≈ renders on the menu with nothing explaining it").toBeVisible();
      expect(await legend.count(), "the legend must appear once, not per card").toBe(1);
    } else {
      // No estimated dish visible → no orphan explanation either.
      expect(await legend.count()).toBe(0);
    }

    await evidenceShot(page, "5.2-macro-legend");
  });

  test("§3.7 the trust strip claims only what the payload supports", async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.goto();

    const strip = page.getByTestId("menu-trust-strip");
    await expect(strip).toBeVisible();
    const text = await strip.innerText();

    // Always-true clauses survive — the strip never goes empty (Law 10).
    expect(text).toMatch(/\d+\s+dish(es)?/);
    expect(text).toContain("order today");

    // "verified macros" may only appear when every rendered dish has
    // trustworthy macros, which the stub-macro rows currently prevent.
    if (text.includes("verified macros")) {
      const body = (await page.locator("main").innerText()).replace(/ /g, " ");
      expect(
        body,
        'strip claims "verified macros" while a card admits its macros are unverified',
      ).not.toContain("Macros being verified");
    }
  });
});
