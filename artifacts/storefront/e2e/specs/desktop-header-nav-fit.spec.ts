import { test, expect } from "@playwright/test";

/**
 * TopNav's `centerContent` gets its own CSS grid track
 * (`grid-template-columns: 1fr auto 1fr`), so PrimaryNav's links can never
 * literally overlap the end cluster the way they could when both lived in a
 * flex `startContent` cluster fighting `endContent`'s flex-shrink:0. But the
 * heading's own column is a `1fr` track with `min-width: 0`, so IT can still
 * collapse to zero width and let its flex-shrink:0 child (the wordmark)
 * paint outside its box — straight on top of the center column's first
 * link — if total demand ever again exceeds the header's max-w-5xl (1024px)
 * budget. That's exactly what happened once already (see lib/nav.ts's
 * PRIMARY_NAV comment): TypeScript and the unit suite were both green for
 * it, because "two interactive elements silently overlap at a specific
 * viewport width" isn't a type error or a pure-function assertion — only a
 * real layout read catches it. Hence this file.
 */

const WIDTHS = [1024, 1280, 1440, 1920];

for (const width of WIDTHS) {
  test(`heading, primary nav, and end cluster stay non-overlapping at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");

    const heading = page.getByRole("link", { name: "Tanmatra home" });
    const headingBox = await heading.boundingBox();
    expect(headingBox, "heading link has no box").not.toBeNull();

    const primaryNav = page.getByLabel("Primary navigation", { exact: true });
    const links = primaryNav.getByRole("link", { name: /^(Menu|Plans|Metabolic|Corporate)$/ });
    await expect(links).toHaveCount(4);

    let centerLeft = Infinity;
    let centerRight = -Infinity;
    const heights = new Set<number>();
    for (const box of await Promise.all((await links.all()).map((l) => l.boundingBox()))) {
      expect(box, "primary nav link has no box").not.toBeNull();
      centerLeft = Math.min(centerLeft, box!.x);
      centerRight = Math.max(centerRight, box!.x + box!.width);
      heights.add(Math.round(box!.height));
    }

    // Every link the same height => none of them wrapped to a second line.
    // A wrapped label is the leading indicator that this row is out of room,
    // well before it's tight enough to actually overlap a neighbor.
    expect([...heights], "a primary nav link wrapped to two lines").toHaveLength(1);

    const endCluster = page.locator('nav[aria-label="Primary"]');
    const endBox = await endCluster.boundingBox();
    expect(endBox, "end cluster has no box").not.toBeNull();

    expect(
      headingBox!.x + headingBox!.width,
      "heading overlaps the primary nav links",
    ).toBeLessThanOrEqual(centerLeft);
    expect(
      centerRight,
      "primary nav links overlap the end cluster (address bar / search / account)",
    ).toBeLessThanOrEqual(endBox!.x);
  });
}
