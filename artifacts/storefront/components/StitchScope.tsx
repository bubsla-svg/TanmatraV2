"use client";
// Client: syncs a document-level attribute from route + theme state — both
// browser-only signals (usePathname after soft navigation, next-themes'
// localStorage read).
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { THEME_COLOR, stitchCanvasForced } from "@/lib/stitchRoutes";

/**
 * Keeps `data-stitch` on <html> truthful AFTER hydration. The pre-paint guard
 * script in app/layout.tsx runs exactly once per full page load — App Router
 * soft navigations never re-run it, so before this component existed the
 * attribute was frozen at whatever the entry route deserved: land on /menu
 * and every later page (including /account) stayed on the dark canvas; land
 * on /account and /menu rendered light. One stale attribute, two opposite
 * bugs, both reported 2026-08-11.
 *
 * Also the reactive half of the theme toggle: stitchCanvasForced() yields to
 * an explicit stored choice, so the first tap of Header's ThemeToggle removes
 * the forced canvas in the same frame next-themes repaints — the toggle now
 * visibly works on redesigned routes.
 *
 * The theme-color meta follows the same computed darkness so the browser
 * chrome agrees with the canvas on both halves of the lifecycle.
 */
export function StitchScope() {
  const pathname = usePathname();
  const { theme, resolvedTheme } = useTheme();

  useEffect(() => {
    const stored = theme === "light" || theme === "dark" ? theme : null;
    const forced = stitchCanvasForced(pathname ?? "", stored);
    const root = document.documentElement;
    if (forced) {
      root.setAttribute("data-stitch", "dark");
    } else {
      root.removeAttribute("data-stitch");
    }
    const dark = forced || resolvedTheme === "dark";
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", dark ? THEME_COLOR.dark : THEME_COLOR.light);
  }, [pathname, theme, resolvedTheme]);

  return null;
}
