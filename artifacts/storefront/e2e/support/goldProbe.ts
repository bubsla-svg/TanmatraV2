import type { Page } from "@playwright/test";

export interface GoldElement {
  tag: string;
  label: string;
}

/**
 * D-08 / EC §4.2 — "one gold action per viewport". Counts distinct
 * interactive elements, visible within the current viewport, whose computed
 * background resolves to the SAME colour as a solid `var(--gold)` fill.
 *
 * A gold BORDER or a gold-tinted background (e.g. the `bg-gold/10` selection
 * style A4 introduces for pills/chips — see PersonalizedMenu.tsx,
 * PlanBuilder.tsx) deliberately does NOT count: those resolve to a distinct,
 * lower-alpha-blended `rgba(...)` from `getComputedStyle`, not the same
 * string a solid fill produces. That's the actual distinction the runbook
 * draws (border+tint+marker vs. solid fill) — this probe enforces it at the
 * pixel level rather than trusting class names, so it also catches `bg-gold`
 * literals AND the shadcn Button's `bg-primary` default variant (which
 * resolves through `--primary: var(--gold)`) uniformly.
 *
 * Disabled controls are excluded, matching ghost-ui.probes.ts's own
 * precedent (BUTTON_SELECTOR) — a disabled gold placeholder mid-hydration is
 * a loading skeleton, not a second competing action signal.
 */
export async function goldElementsInViewport(page: Page): Promise<GoldElement[]> {
  return page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.background = "var(--gold)";
    probe.style.position = "fixed";
    probe.style.visibility = "hidden";
    document.body.appendChild(probe);
    const goldRgb = getComputedStyle(probe).backgroundColor;
    probe.remove();

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const candidates = document.querySelectorAll<HTMLElement>(
      'button:not([disabled]):not([aria-disabled="true"]), a[href], [role="button"]:not([aria-disabled="true"])',
    );
    const found: GoldElement[] = [];
    for (const el of candidates) {
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      // In-viewport: any overlap with the visible window counts — a sticky/
      // fixed bar partially clipped at the fold still reads as "on screen".
      if (rect.bottom <= 0 || rect.top >= vh || rect.right <= 0 || rect.left >= vw) continue;
      if (style.backgroundColor !== goldRgb) continue;
      const label =
        (el.textContent || "").replace(/\s+/g, " ").trim() ||
        el.getAttribute("aria-label") ||
        "(unlabelled)";
      found.push({ tag: el.tagName.toLowerCase(), label: label.slice(0, 60) });
    }
    return found;
  });
}
