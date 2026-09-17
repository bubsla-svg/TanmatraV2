"use client";
// Client: stamps a document-level attribute from the stored theme choice.
import { useEffect } from "react";
import { useTheme } from "next-themes";
import { THEME_COLOR, stitchCanvasForced } from "@/lib/stitchRoutes";

/**
 * The 404 page's canvas (audit 2026-09-17). Every consumer route paints the
 * Stitch dark canvas, but the pre-paint guard in app/layout.tsx and
 * StitchScope both decide by pathname against lib/stitchRoutes.ts — and a
 * mistyped URL matches nothing, so the 404 rendered light with dark chrome
 * and looked like a different product. Here the page itself asks for the
 * canvas, through the same rule (an explicit stored theme choice still
 * wins), and hands it back on unmount so the next soft navigation starts
 * clean. The first paint can still be light for one frame: the guard script
 * cannot know a path is a 404 before the server says so.
 */
export function NotFoundCanvas() {
  const { theme, resolvedTheme } = useTheme();
  useEffect(() => {
    const stored = theme === "light" || theme === "dark" ? theme : null;
    // "/menu" stands in for "a Stitch route": the rule only asks whether the
    // stored choice overrides the default canvas.
    const forced = stitchCanvasForced("/menu", stored);
    const root = document.documentElement;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (forced) {
      root.setAttribute("data-stitch", "dark");
      meta?.setAttribute("content", THEME_COLOR.dark);
    }
    return () => {
      if (forced) {
        root.removeAttribute("data-stitch");
        meta?.setAttribute("content", resolvedTheme === "dark" ? THEME_COLOR.dark : THEME_COLOR.light);
      }
    };
  }, [theme, resolvedTheme]);
  return null;
}
