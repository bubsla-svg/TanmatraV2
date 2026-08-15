import { test, expect, type Page } from "@playwright/test";
import { evidenceShot } from "./support";
import { MenuPage } from "../../support/pages/MenuPage";

/**
 * TNM-MENU-01 M-5 §3.5 / §4 — dish image integrity, and the §5 flipbook
 * enumeration that captures it section by section, in both themes.
 *
 * WHY THIS SPEC IS NOT THEORETICAL. The platform serves no dish photography
 * at all: every `image` path in the catalog resolves to the legacy SPA shell
 * (HTTP 200, `content-type: text/html`), which the browser cannot decode and
 * reports as a load error. So the branded fallback tile is what essentially
 * every dish renders today, on every surface — and until this PR only the
 * menu CARD supplied one. The drawer that opens when you tap that card, the
 * meal-plan day cards, the protocol rail, the saved-dish vault and the
 * metabolic explorer all fell through to the generic broken-image glyph.
 * That is the regression these tests exist to keep fixed.
 *
 * §3.5 allows a dish image to be exactly one of: a real photo of THIS dish,
 * or the branded tile. The generic glyph is not one of them, which is what
 * the integrity test below asserts directly rather than by proxy.
 *
 * On the flipbook's stated review gate: the manual cites an "Experience
 * Contract — ten laws" document for this. It does not exist anywhere in this
 * repository (verified by exhaustive grep). These shots are therefore
 * evidence captured against this repo's actual verification pattern, not
 * claimed compliance with an absent document — same position
 * `menu-flipbook.spec.ts` takes and for the same reason.
 */

/** The neutral `ImageOff` glyph ImgWithFallback renders when NO branded
 *  fallback is supplied. Its presence on a dish surface is the defect. */
const GENERIC_GLYPH = "svg.lucide-image-off";

async function setTheme(page: Page, theme: "light" | "dark") {
  await page.evaluate((t) => {
    document.documentElement.setAttribute("data-theme", t);
    try {
      localStorage.setItem("theme", t);
    } catch {
      /* storage disabled — the attribute above is what paints */
    }
  }, theme);
  // Let the token swap land before the shot.
  await page.waitForTimeout(150);
}

test.describe("stitch-runtime: dish image integrity (M-5 §3.5)", () => {
  test("every dish image on /menu is a photo or the branded tile — never the generic glyph", async ({
    page,
  }) => {
    const menu = new MenuPage(page);
    await menu.goto();

    // Scroll the full grid so `content-visibility: auto` rows actually lay
    // out and their images attempt to load. Without this the assertion only
    // covers the first viewport and passes vacuously.
    await page.evaluate(async () => {
      const step = window.innerHeight;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(600);

    const cards = page.locator("article");
    expect(await cards.count()).toBeGreaterThan(0);

    // The defect, asserted directly: zero generic glyphs anywhere on the grid.
    expect(await page.locator(GENERIC_GLYPH).count()).toBe(0);

    // And the positive form — every card shows one of the two allowed states.
    // A card with neither would pass the negative assertion above while
    // rendering an empty box, so both directions are needed.
    const perCard = await cards.evaluateAll((els) =>
      els.map((el) => ({
        tile: el.querySelector('[data-testid="dish-fallback-tile"]') !== null,
        img: el.querySelector("img") !== null,
      })),
    );
    for (const c of perCard) expect(c.tile || c.img).toBe(true);
  });

  test("the dish drawer shows the same branded tile the card does", async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.goto();

    await page.locator('a[href^="/menu?dish="]').first().click();
    const drawer = page.locator('[data-screen-id="5.4"]');
    await expect(drawer).toBeVisible();
    await page.waitForTimeout(600); // let the drawer image resolve/fail

    // This is the exact inconsistency the PR fixes: card tile, drawer glyph.
    expect(await drawer.locator(GENERIC_GLYPH).count()).toBe(0);
    const hasTile = await drawer.locator('[data-testid="dish-fallback-tile"]').count();
    const hasImg = await drawer.locator("img").count();
    expect(hasTile + hasImg).toBeGreaterThan(0);

    await evidenceShot(page, "5.4-dish-drawer-image");
  });

  test("fallback tiles are deterministic — the same dish keeps its tile across reloads", async ({
    page,
  }) => {
    const menu = new MenuPage(page);
    await menu.goto();

    const read = async () =>
      page.locator('[data-testid="dish-fallback-tile"]').first().evaluate((el) => ({
        letter: el.textContent?.trim() ?? "",
        bg: getComputedStyle(el).backgroundImage,
      }));

    const before = await read();
    await page.reload();
    await expect(page.getByTestId("menu-section-heading").first()).toBeVisible();
    const after = await read();

    expect(after.letter).toBe(before.letter);
    expect(after.bg).toBe(before.bg);
    expect(before.letter).toMatch(/^[A-Z0-9T]$/);
  });
});

test.describe("stitch-runtime: menu flipbook — section enumeration (M-5 §5)", () => {
  // Pinned to ONE project on purpose. `evidenceShot` writes a fixed path per
  // id, and this spec runs under both `chromium` (1280x720) and `mobile`
  // (Pixel 7) — so without this the two projects race for the same 26
  // filenames and the committed artifact is whichever finished last. The
  // storefront is mobile-first (§4) and the wave gates run `mobile`, so
  // mobile is the canonical surface for the flipbook. The integrity tests
  // above still run on every project: those assert behaviour, which is worth
  // checking at both widths, rather than writing a file.
  for (const theme of ["dark", "light"] as const) {
    test(`every rendered section captured in ${theme}`, async ({ page }, testInfo) => {
      // Guard in the BODY, not as a describe-level condition: the
      // `({}, testInfo)` conditional form is not supported under the
      // strip-only type stripping Playwright loads these files with, and
      // fails at collection with "Cannot read properties of undefined".
      test.skip(
        testInfo.project.name !== "mobile",
        "flipbook artifacts are captured on the mobile project only",
      );
      const menu = new MenuPage(page);
      await menu.goto();
      await setTheme(page, theme);

      const headings = page.getByTestId("menu-section-heading");
      const count = await headings.count();
      expect(count).toBeGreaterThan(0);

      // One shot per section, framed on that section's heading. Named by
      // index rather than by section name so the filenames stay stable
      // whether the run sees the DB-governed catalog (real §5 names) or the
      // static fallback (one "More dishes" bucket) — the same dual-mode
      // reality menu-flipbook.spec.ts documents.
      for (let i = 0; i < count; i += 1) {
        const h = headings.nth(i);
        await h.scrollIntoViewIfNeeded();
        await page.waitForTimeout(220); // settle sticky offset + lazy rows
        await expect(h).toBeVisible();
        await evidenceShot(page, `5.5-section-${String(i + 1).padStart(2, "0")}`, theme);
      }

      // Whole-page state shot to close the set.
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(200);
      await evidenceShot(page, "5.5-grid-top", theme);
    });
  }
});
