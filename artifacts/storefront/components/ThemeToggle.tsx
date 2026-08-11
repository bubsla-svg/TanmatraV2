"use client";
// Header dark-mode control. The provider (components/theme-provider.tsx) has
// carried the infrastructure — data-theme attribute strategy, system-preference
// read, zero-flash pre-paint script — since before this control existed; this
// is the missing UI half. `theme` is next-themes' user CHOICE ("system" until
// they pick), `resolvedTheme` is what's actually painted — the icon and label
// must reflect the latter, or a system-dark user sees a sun on a dark page.
//
// "What's actually painted" includes the Stitch canvas: on a redesigned route
// with no stored choice the page is forced dark by data-stitch, not by
// data-theme, and the icon must say dark or the control lies (a moon on a
// near-black page). Tapping it then stores an explicit choice, which
// stitchCanvasForced() yields to — StitchScope drops the forced attribute and
// the whole canvas follows the toggle from that moment on.
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { stitchCanvasForced } from "@/lib/stitchRoutes";

export function ThemeToggle() {
  const pathname = usePathname();
  const { theme, resolvedTheme, setTheme } = useTheme();
  // next-themes resolves after mount (it reads localStorage/matchMedia
  // client-side); render a stable, theme-agnostic placeholder until then so
  // hydration never has to guess which icon the server didn't know either.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <span className="inline-block h-8 w-8" aria-hidden />;
  }

  const stored = theme === "light" || theme === "dark" ? theme : null;
  const isDark =
    resolvedTheme === "dark" || stitchCanvasForced(pathname ?? "", stored);

  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={isDark}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="touch-target-min rounded-md text-ink-muted transition-colors hover:text-ink"
    >
      {isDark ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
    </button>
  );
}
