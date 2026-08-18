/**
 * Frontend audit probes — geometry, layering and control-rendering checks run
 * against the LIVE DOM rather than against source.
 *
 * ONE self-contained function on purpose. `page.evaluate(fn)` serialises only
 * `fn`; any helper it closes over is undefined in the browser realm. So every
 * helper is nested inside `auditPage`, and the whole thing is dependency-free.
 *
 * Why measured, not reviewed: each defect class here was reported from a
 * screenshot, and a screenshot cannot tell "the banner overlaps the nav" from
 * "the banner sits just above it". Bounding boxes and hit-testing can.
 */

export interface Finding {
  probe: string;
  severity: "critical" | "high" | "medium" | "low";
  detail: string;
  selector?: string;
  metrics?: Record<string, number>;
}

export function auditPage(): Finding[] {
  const out: Finding[] = [];
  const INTERACTIVE =
    'a[href], button, input, select, textarea, [role="button"], [role="link"], [tabindex]:not([tabindex="-1"])';

  const describe = (el: Element): string => {
    const id = el.id ? `#${el.id}` : "";
    const tid = el.getAttribute("data-testid");
    const cls =
      typeof el.className === "string" && el.className
        ? `.${el.className.trim().split(/\s+/).slice(0, 3).join(".")}`
        : "";
    return `${el.tagName.toLowerCase()}${id}${tid ? `[data-testid="${tid}"]` : ""}${cls}`;
  };

  const visible = (el: Element): boolean => {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || s.opacity === "0") return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  /** Effective z-index: a z-index on a `static` element does nothing, which is
   *  itself part of the layering trap being audited. */
  const zOf = (el: Element): number => {
    let n: Element | null = el;
    while (n && n !== document.documentElement) {
      const s = getComputedStyle(n);
      if (s.position !== "static") {
        const z = parseInt(s.zIndex, 10);
        if (Number.isFinite(z)) return z;
      }
      n = n.parentElement;
    }
    return 0;
  };

  const lum = (color: string): number => {
    const m = color.match(/rgba?\(([^)]+)\)/);
    if (!m) return 1; // unknown → treat as light, never fabricate a finding
    const p = m[1]!.split(",").map((x) => parseFloat(x));
    const a = p[3] ?? 1;
    if (a === 0) return 1;
    return (0.2126 * (p[0] ?? 0) + 0.7152 * (p[1] ?? 0) + 0.0722 * (p[2] ?? 0)) / 255;
  };

  const all = Array.from(document.querySelectorAll<HTMLElement>("body *"));
  const interactive = Array.from(document.querySelectorAll<HTMLElement>(INTERACTIVE)).filter(visible);

  // ── 1. Controls PERMANENTLY occluded by pinned chrome ─────────────────────
  // "The Double Footer Trap", stated correctly. A fixed bottom nav always
  // covers whatever sits in the bottom ~64px of the viewport — that is what
  // "fixed" means, and the customer simply scrolls. Flagging it is how an
  // audit generates noise: an earlier cut of this probe reported 3 "critical"
  // collisions on /, /menu and /faq that were all just content mid-scroll.
  //
  // The real defect is content that can NEVER be revealed — still covered at
  // MAXIMUM scroll, with no further scrolling available. That is why this
  // probe requires `atMaxScroll`; the spec scrolls to the end before calling.
  // Geometry alone is still not enough either, so the overlap centre is
  // hit-tested: a `pointer-events: none` wrapper (how a correct floating pill
  // is layered) overlaps harmlessly and must not be reported.
  const atMaxScroll =
    window.scrollY + window.innerHeight >=
    Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) - 2;
  // When a modal dialog is open, everything BEHIND it is supposed to be
  // covered and inert — that is what a modal is. Auditing the background
  // against the scrim reports the scrim doing its job: measured on the dish
  // quick-view, that was 15 "critical" occlusions, all of them the overlay
  // and the drawer panel covering the menu page underneath. So when a dialog
  // is open, occlusion is only meaningful WITHIN it.
  const openDialog = document.querySelector<HTMLElement>(
    '[role="dialog"][data-state="open"], [aria-modal="true"], dialog[open]',
  );
  if (atMaxScroll) {
    const pinned = all.filter((el) => {
      const s = getComputedStyle(el);
      return (s.position === "fixed" || s.position === "sticky") && visible(el);
    });
    for (const bar of pinned) {
      const b = bar.getBoundingClientRect();
      for (const t of interactive) {
        if (bar.contains(t) || t.contains(bar)) continue;
        // Background-of-a-modal: not a defect, and not this probe's business.
        if (openDialog && !openDialog.contains(t)) continue;
        const r = t.getBoundingClientRect();
        const ix = Math.min(b.right, r.right) - Math.max(b.left, r.left);
        const iy = Math.min(b.bottom, r.bottom) - Math.max(b.top, r.top);
        if (ix <= 0 || iy <= 0) continue;
        const pct = (ix * iy) / Math.max(1, r.width * r.height);
        if (pct < 0.25) continue;
        const cx = Math.max(b.left, r.left) + ix / 2;
        const cy = Math.max(b.top, r.top) + iy / 2;
        if (cx < 0 || cy < 0 || cx > window.innerWidth || cy > window.innerHeight) continue;
        const hit = document.elementFromPoint(cx, cy);
        if (!hit || !(bar === hit || bar.contains(hit)) || t.contains(hit)) continue;
        out.push({
          probe: "occlusion",
          severity: pct > 0.6 ? "critical" : "high",
          detail: `at MAX scroll, pinned ${describe(bar)} (z=${zOf(bar)}) still covers ${Math.round(pct * 100)}% of ${describe(t)} and takes the tap — unreachable`,
          selector: describe(t),
          metrics: { overlapPct: Math.round(pct * 100), barZ: zOf(bar) },
        });
      }
    }
  }

  // ── 2. Trailing void below the last painted element ───────────────────────
  // "The Bottomless Scroll". Fixed/sticky chrome is excluded — it does not
  // extend the document.
  const docH = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
  let lowest = 0;
  let lowestEl = "(none)";
  for (const el of all) {
    const s = getComputedStyle(el);
    if (s.position === "fixed" || s.position === "sticky") continue;
    if (!visible(el)) continue;
    const paints =
      el.childElementCount === 0 ||
      s.backgroundImage !== "none" ||
      (s.backgroundColor !== "rgba(0, 0, 0, 0)" && s.backgroundColor !== "transparent");
    if (!paints) continue;
    const bottom = el.getBoundingClientRect().bottom + window.scrollY;
    if (bottom > lowest) {
      lowest = bottom;
      lowestEl = describe(el);
    }
  }
  const gap = docH - lowest;
  if (gap > window.innerHeight * 0.5) {
    out.push({
      probe: "trailing-void",
      severity: gap > window.innerHeight * 1.5 ? "high" : "medium",
      detail: `${Math.round(gap)}px of empty space below the last painted element (${lowestEl}) — ${(gap / window.innerHeight).toFixed(1)}x viewport height`,
      metrics: { gapPx: Math.round(gap), viewportH: window.innerHeight, docH: Math.round(docH) },
    });
  }

  // ── 3. Image boxes with no dimensional safeguard ──────────────────────────
  // "Missing Image Collapse". On this platform image failure is the COMMON
  // case — every dish `image` path resolves to an HTML shell the browser
  // cannot decode — so a box with no aspect-ratio collapses in production.
  for (const img of Array.from(document.querySelectorAll<HTMLImageElement>("img"))) {
    const r = img.getBoundingClientRect();
    if (r.height === 0 || r.width === 0) {
      out.push({
        probe: "image-collapse",
        severity: "high",
        detail: `<img> collapsed to ${Math.round(r.width)}x${Math.round(r.height)}: ${(img.getAttribute("src") ?? "(no src)").slice(0, 70)}`,
        selector: describe(img),
      });
      continue;
    }
    const s = getComputedStyle(img);
    const box = img.parentElement;
    const bs = box ? getComputedStyle(box) : null;
    const hasRatio = s.aspectRatio !== "auto" || (bs != null && bs.aspectRatio !== "auto");
    const hasFixedH =
      (/px$/.test(s.height) && parseFloat(s.height) > 0) ||
      (bs != null && /px$/.test(bs.height) && parseFloat(bs.height) > 0);
    const hasAttrs = img.hasAttribute("width") && img.hasAttribute("height");
    if (!hasRatio && !hasFixedH && !hasAttrs) {
      out.push({
        probe: "image-no-ratio",
        severity: "medium",
        detail: "no aspect-ratio, fixed height or width/height attrs — collapses or shifts when the image fails",
        selector: describe(img),
      });
    }
  }

  // ── 4. Tap targets ────────────────────────────────────────────────────────
  // Two thresholds, because they mean different things. WCAG 2.2 AA (SC 2.5.8
  // Target Size Minimum) is 24x24 — under that is a conformance failure. 44x44
  // is the iOS HIG comfort figure this mobile-first surface should meet; the
  // 24–44 band is a usability finding, not a violation, and is reported as
  // `medium` so a real AA failure is not buried among them.
  for (const el of interactive) {
    const r = el.getBoundingClientRect();
    if (r.width >= 44 && r.height >= 44) continue;
    if (el.tagName === "A" && el.closest("p")) continue; // inline prose link
    // A visually-hidden skip link is 1x1 by design until it takes focus —
    // measuring it unfocused reports the pattern working as intended.
    const cls = typeof el.className === "string" ? el.className : "";
    if (cls.includes("sr-only") || cls.includes("not-sr-only")) continue;
    const belowAA = r.height < 24 || r.width < 24;
    out.push({
      probe: "tap-target",
      severity: belowAA ? "high" : "medium",
      detail: `${Math.round(r.width)}x${Math.round(r.height)} — ${belowAA ? "below the WCAG 2.2 AA 24px minimum" : "below the 44px comfort floor"}: "${(el.textContent ?? "").trim().slice(0, 36)}"`,
      selector: describe(el),
      metrics: { w: Math.round(r.width), h: Math.round(r.height) },
    });
  }

  // ── 5. Native OS control rendering bleeding through the dark theme ────────
  const darkPage = lum(getComputedStyle(document.body).backgroundColor) < 0.5;
  for (const el of Array.from(document.querySelectorAll<HTMLElement>("select, input, textarea"))) {
    if (!visible(el)) continue;
    const s = getComputedStyle(el);
    const app = s.appearance || (s as unknown as Record<string, string>)["webkitAppearance"];
    if (el.tagName === "SELECT" && app !== "none") {
      out.push({
        probe: "native-select",
        severity: "medium",
        detail: `<select> keeps appearance:${app} — the OS menu renders over the custom UI`,
        selector: describe(el),
      });
    }
    if (darkPage && lum(s.backgroundColor) > 0.75) {
      out.push({
        probe: "input-light-on-dark",
        severity: "medium",
        detail: `control paints ${s.backgroundColor} on a dark page — native rendering not overridden`,
        selector: describe(el),
      });
    }
  }

  // ── 6. Competing primary CTAs in one viewport ─────────────────────────────
  const CTA =
    /^(add|add to cart|add combo|view cart|open full page|buy|order now|checkout|continue to payment|place order)/i;
  const ctas: string[] = [];
  for (const el of Array.from(document.querySelectorAll<HTMLElement>('button, a[href], [role="button"]'))) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) continue;
    const name = (el.getAttribute("aria-label") || el.textContent || "").trim();
    if (CTA.test(name)) ctas.push(name.slice(0, 28));
  }
  if (ctas.length >= 3) {
    out.push({
      probe: "cta-stacking",
      severity: "medium",
      detail: `${ctas.length} primary CTAs visible at once: ${ctas.join(" | ")}`,
      metrics: { count: ctas.length },
    });
  }

  return out;
}
